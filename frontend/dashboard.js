const POLLING_INTERVAL_MS = 1000;
const HISTORY_POLLING_INTERVAL_MS = 10000;
const ALARM_CONFIG_FILE = "../config/alarms.json";
const WARNING_MARGIN_RATIO = 0.1;

const sensors = [
    {
        id: "temperature",
        name: "Temperature",
        file: "../data/EZORTD.json",
        key: "temperature",
        decimals: 3,
        valueElement: "temperature-value",
        stateElement: "temperature-state",
        cardElement: "card-temperature"
    },
    {
        id: "ph",
        name: "pH",
        file: "../data/EZOPH.json",
        key: "ph",
        decimals: 2,
        valueElement: "ph-value",
        stateElement: "ph-state",
        cardElement: "card-ph"
    },
    {
        id: "do",
        name: "Dissolved Oxygen",
        file: "../data/EZODO.json",
        key: "do",
        decimals: 2,
        valueElement: "do-value",
        stateElement: "do-state",
        cardElement: "card-do"
    },
    {
        id: "ec",
        name: "Conductivity",
        file: "../data/EZOEC.json",
        key: "ec",
        decimals: 0,
        valueElement: "ec-value",
        stateElement: "ec-state",
        cardElement: "card-ec"
    }
];

const historicalCharts = [
    {
        id: "temperature",
        title: "Temperature vs Time",
        file: "../logs/temperature.csv",
        valueKey: "temperature",
        unit: "degC",
        canvasElement: "temperature-chart",
        emptyElement: "temperature-chart-empty",
        color: "#097969"
    },
    {
        id: "ph-history",
        title: "pH vs Time",
        file: "../logs/ph.csv",
        valueKey: "ph",
        unit: "pH",
        canvasElement: "ph-chart",
        emptyElement: "ph-chart-empty",
        color: "#4f46e5"
    },
    {
        id: "do-history",
        title: "Dissolved Oxygen vs Time",
        file: "../logs/do.csv",
        valueKey: "do",
        unit: "mg/L",
        canvasElement: "do-chart",
        emptyElement: "do-chart-empty",
        color: "#0f766e"
    },
    {
        id: "ec-history",
        title: "Conductivity vs Time",
        file: "../logs/ec.csv",
        valueKey: "ec",
        unit: "uS/cm",
        canvasElement: "ec-chart",
        emptyElement: "ec-chart-empty",
        color: "#b97300"
    }
];

const chartInstances = new Map();

async function readSensor(sensor) {
    try {
        const response = await fetch(`${sensor.file}?t=${Date.now()}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawValue = Number(data[sensor.key]);

        if (!Number.isFinite(rawValue)) {
            throw new Error(`Invalid value for ${sensor.key}`);
        }

        return {
            ...sensor,
            online: true,
            numericValue: rawValue,
            value: rawValue.toFixed(sensor.decimals)
        };
    } catch (error) {
        console.warn(`${sensor.name} offline:`, error);

        return {
            ...sensor,
            online: false,
            numericValue: null,
            value: "OFFLINE"
        };
    }
}

function setSensorState(result) {
    const valueElement = document.getElementById(result.valueElement);
    const stateElement = document.getElementById(result.stateElement);
    const cardElement = document.getElementById(result.cardElement);
    const state = result.alarmState || (result.online ? "NORMAL" : "OFFLINE");
    const stateClass = state.toLowerCase();

    valueElement.textContent = result.value;
    stateElement.textContent = state;
    ["online", "normal", "warning", "critical", "offline"].forEach((className) => {
        stateElement.classList.toggle(className, className === stateClass);
        cardElement.classList.toggle(className, className === stateClass);
    });
}

function renderSystemStatus(results) {
    const activeSensors = results.filter((result) => result.online).length;
    const offlineSensors = results.length - activeSensors;
    const criticalSensors = results.filter((result) => result.alarmState === "CRITICAL").length;
    const warningSensors = results.filter((result) => result.alarmState === "WARNING").length;
    const allNormal = results.every((result) => result.alarmState === "NORMAL");
    const anyOnline = activeSensors > 0;
    const overallDot = document.getElementById("overall-dot");
    const overallStatus = document.getElementById("overall-status");
    const healthList = document.getElementById("sensor-health");

    document.getElementById("active-count").textContent =
        `${activeSensors} / ${results.length}`;
    document.getElementById("offline-count").textContent = String(offlineSensors);
    document.getElementById("last-update").textContent =
        new Date().toLocaleString();

    overallDot.classList.toggle("online", allNormal);
    overallDot.classList.toggle("warning", warningSensors > 0 && criticalSensors === 0);
    overallDot.classList.toggle("critical", criticalSensors > 0);
    overallDot.classList.toggle("offline", !anyOnline);

    if (criticalSensors > 0) {
        overallStatus.textContent = "CRITICAL ALARM";
    } else if (warningSensors > 0) {
        overallStatus.textContent = "WARNING ACTIVE";
    } else if (allNormal) {
        overallStatus.textContent = "ALL SYSTEMS NORMAL";
    } else if (anyOnline) {
        overallStatus.textContent = "PARTIAL DATA";
    } else {
        overallStatus.textContent = "SYSTEM OFFLINE";
    }

    healthList.innerHTML = results
        .map((result) => {
            const statusText = result.alarmState || (result.online ? "NORMAL" : "OFFLINE");
            const statusClass = statusText.toLowerCase();

            return `
                <li>
                    <span>${result.name}</span>
                    <span class="${statusClass}">${statusText}</span>
                </li>
            `;
        })
        .join("");
}

async function updateDashboard() {
    const [results, alarmConfig] = await Promise.all([
        Promise.all(sensors.map(readSensor)),
        readAlarmConfig()
    ]);
    const evaluatedResults = results.map((result) =>
        evaluateSensorAlarm(result, alarmConfig.thresholds)
    );

    evaluatedResults.forEach(setSensorState);
    renderSystemStatus(evaluatedResults);
    renderAlarmSummary(evaluatedResults, alarmConfig);
}

async function readAlarmConfig() {
    try {
        const response = await fetch(`${ALARM_CONFIG_FILE}?t=${Date.now()}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const thresholds = await response.json();

        return {
            loaded: true,
            thresholds
        };
    } catch (error) {
        console.warn("Alarm configuration unavailable:", error);

        return {
            loaded: false,
            thresholds: {}
        };
    }
}

function evaluateSensorAlarm(sensorResult, thresholds) {
    if (!sensorResult.online) {
        return {
            ...sensorResult,
            alarmState: "OFFLINE",
            alarmMessage: "Sensor data unavailable"
        };
    }

    const limits = thresholds[sensorResult.id];

    if (!isValidThreshold(limits)) {
        return {
            ...sensorResult,
            alarmState: "WARNING",
            alarmMessage: "Alarm limits unavailable"
        };
    }

    if (sensorResult.numericValue < limits.min || sensorResult.numericValue > limits.max) {
        return {
            ...sensorResult,
            alarmState: "CRITICAL",
            alarmMessage: buildAlarmMessage(sensorResult, limits, "outside")
        };
    }

    if (isNearThreshold(sensorResult.numericValue, limits)) {
        return {
            ...sensorResult,
            alarmState: "WARNING",
            alarmMessage: buildAlarmMessage(sensorResult, limits, "near")
        };
    }

    return {
        ...sensorResult,
        alarmState: "NORMAL",
        alarmMessage: "Within configured range"
    };
}

function isValidThreshold(limits) {
    return Boolean(limits) &&
        Number.isFinite(Number(limits.min)) &&
        Number.isFinite(Number(limits.max)) &&
        Number(limits.min) < Number(limits.max);
}

function isNearThreshold(value, limits) {
    const min = Number(limits.min);
    const max = Number(limits.max);
    const warningMargin = (max - min) * WARNING_MARGIN_RATIO;

    return value <= min + warningMargin || value >= max - warningMargin;
}

function buildAlarmMessage(sensorResult, limits, alarmType) {
    const direction = sensorResult.numericValue < limits.min ? "below" : "above";
    const range = `${limits.min} - ${limits.max}`;

    if (alarmType === "outside") {
        return `${sensorResult.value} is ${direction} configured range (${range})`;
    }

    return `${sensorResult.value} is near configured range (${range})`;
}

function getAlarmEvents(results) {
    return results
        .filter((result) => result.alarmState !== "NORMAL")
        .map((result) => ({
            sensorId: result.id,
            sensorName: result.name,
            severity: result.alarmState,
            value: result.value,
            message: result.alarmMessage,
            createdAt: new Date().toISOString()
        }));
}

function getOverallRiskLevel(results) {
    if (results.some((result) => result.alarmState === "CRITICAL")) {
        return "CRITICAL";
    }

    if (results.some((result) => result.alarmState === "WARNING")) {
        return "WARNING";
    }

    if (results.some((result) => result.alarmState === "OFFLINE")) {
        return "OFFLINE";
    }

    return "NORMAL";
}

function renderAlarmSummary(results, alarmConfig) {
    const criticalCount = results.filter((result) => result.alarmState === "CRITICAL").length;
    const warningCount = results.filter((result) => result.alarmState === "WARNING").length;
    const offlineCount = results.filter((result) => result.alarmState === "OFFLINE").length;
    const overallRisk = getOverallRiskLevel(results);
    const alarmEvents = getAlarmEvents(results);
    const riskElement = document.getElementById("overall-risk");
    const alarmList = document.getElementById("alarm-list");

    document.getElementById("critical-count").textContent = String(criticalCount);
    document.getElementById("warning-count").textContent = String(warningCount);
    document.getElementById("alarm-offline-count").textContent = String(offlineCount);
    document.getElementById("alarm-config-status").textContent =
        alarmConfig.loaded ? "loaded" : "unavailable";

    riskElement.textContent = overallRisk;
    ["risk-normal", "risk-warning", "risk-critical", "risk-offline"].forEach((className) => {
        riskElement.classList.remove(className);
    });
    riskElement.classList.add(`risk-${overallRisk.toLowerCase()}`);

    if (alarmEvents.length === 0) {
        alarmList.innerHTML = '<li class="alarm-empty">No active alarms</li>';
        return;
    }

    alarmList.innerHTML = alarmEvents
        .map((event) => `
            <li class="${event.severity.toLowerCase()}">
                <span>${event.sensorName}</span>
                <span>${event.severity}: ${event.message}</span>
            </li>
        `)
        .join("");
}

async function readHistoricalData(chartConfig) {
    try {
        const response = await fetch(`${chartConfig.file}?t=${Date.now()}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvText = await response.text();
        return parseHistoricalCsv(csvText, chartConfig.valueKey);
    } catch (error) {
        console.warn(`${chartConfig.title} unavailable:`, error);
        return [];
    }
}

function parseHistoricalCsv(csvText, valueKey) {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return [];
    }

    const firstRow = splitCsvLine(lines[0]);
    const lowerFirstRow = firstRow.map((cell) => cell.toLowerCase());
    const hasNamedHeader = lowerFirstRow.some((cell) =>
        ["timestamp", "time", "date", valueKey, "value", "reading"].some((candidate) =>
            cell.includes(candidate)
        )
    );
    const hasHeader = hasNamedHeader || !Number.isFinite(Number(firstRow[1]));
    const header = hasHeader ? firstRow.map((cell) => cell.toLowerCase()) : [];
    const rows = hasHeader ? lines.slice(1) : lines;
    const timestampIndex = getCsvColumnIndex(header, ["timestamp", "time", "date"], 0);
    const valueIndex = getCsvColumnIndex(header, [valueKey, "value", "reading"], 1);

    return rows
        .map((line) => splitCsvLine(line))
        .map((columns) => {
            const rawValue = Number(columns[valueIndex]);

            if (!Number.isFinite(rawValue)) {
                return null;
            }

            return {
                label: formatTimestamp(columns[timestampIndex]),
                value: rawValue
            };
        })
        .filter(Boolean);
}

function splitCsvLine(line) {
    return line
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function getCsvColumnIndex(header, candidates, fallbackIndex) {
    if (header.length === 0) {
        return fallbackIndex;
    }

    const index = header.findIndex((columnName) =>
        candidates.some((candidate) => columnName.includes(candidate))
    );

    return index >= 0 ? index : fallbackIndex;
}

function formatTimestamp(rawTimestamp) {
    if (!rawTimestamp) {
        return "";
    }

    const numericTimestamp = Number(rawTimestamp);

    if (Number.isFinite(numericTimestamp)) {
        if (numericTimestamp > 1000000000000) {
            return new Date(numericTimestamp).toLocaleTimeString();
        }

        if (numericTimestamp > 1000000000) {
            return new Date(numericTimestamp * 1000).toLocaleTimeString();
        }
    }

    const parsedDate = new Date(rawTimestamp);

    if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString();
    }

    return rawTimestamp;
}

function setChartAvailability(chartConfig, hasData) {
    const emptyElement = document.getElementById(chartConfig.emptyElement);
    const frameElement = emptyElement.closest(".chart-frame");

    frameElement.classList.toggle("empty", !hasData);
}

function buildChartDataset(chartConfig, points) {
    return {
        labels: points.map((point) => point.label),
        datasets: [
            {
                label: `${chartConfig.title} (${chartConfig.unit})`,
                data: points.map((point) => point.value),
                borderColor: chartConfig.color,
                backgroundColor: `${chartConfig.color}1f`,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 4,
                tension: 0.32,
                fill: true
            }
        ]
    };
}

function getChartOptions(chartConfig) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label(context) {
                        return `${context.parsed.y} ${chartConfig.unit}`;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 6
                },
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: false,
                ticks: {
                    callback(value) {
                        return `${value}`;
                    }
                }
            }
        }
    };
}

function renderHistoricalChart(chartConfig, points) {
    const chartLibraryReady = typeof Chart !== "undefined";
    const hasData = points.length > 0 && chartLibraryReady;
    const existingChart = chartInstances.get(chartConfig.id);

    setChartAvailability(chartConfig, hasData);

    if (!hasData) {
        return;
    }

    const chartData = buildChartDataset(chartConfig, points);

    if (existingChart) {
        existingChart.data = chartData;
        existingChart.update("none");
        return;
    }

    const canvas = document.getElementById(chartConfig.canvasElement);
    const chart = new Chart(canvas, {
        type: "line",
        data: chartData,
        options: getChartOptions(chartConfig)
    });

    chartInstances.set(chartConfig.id, chart);
}

async function updateHistoricalTrends() {
    const chartData = await Promise.all(
        historicalCharts.map(async (chartConfig) => ({
            chartConfig,
            points: await readHistoricalData(chartConfig)
        }))
    );

    chartData.forEach(({ chartConfig, points }) => {
        renderHistoricalChart(chartConfig, points);
    });
}

updateDashboard();
setInterval(updateDashboard, POLLING_INTERVAL_MS);

updateHistoricalTrends();
setInterval(updateHistoricalTrends, HISTORY_POLLING_INTERVAL_MS);

const chartCards = {
    temperature: document.getElementById("chart-card-temperature"),
    ph: document.getElementById("chart-card-ph"),
    do: document.getElementById("chart-card-do"),
    ec: document.getElementById("chart-card-ec")
};

document.querySelectorAll(".chart-filter").forEach((button) => {
    button.addEventListener("click", () => {
        const selected = button.dataset.chart;

        document.querySelectorAll(".chart-filter").forEach((btn) => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        if (selected === "all") {
            Object.values(chartCards).forEach((card) => {
                card.style.display = "";
            });
            return;
        }

        Object.entries(chartCards).forEach(([key, card]) => {
            card.style.display = key === selected ? "" : "none";
        });
    });
});