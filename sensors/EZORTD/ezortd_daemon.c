#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <time.h>

#include "ezortd.h"

int main()
{
    int fd;

    fd = open("/dev/i2c-1", O_RDWR);

    if (fd < 0)
    {
        perror("open");
        return -1;
    }

    while (1)
    {
        double temperature;

        if (getTemperature(fd, &temperature) == 0)
        {
            FILE *f = fopen(
                "/home/cristian/airquality/basic-ui-dashboard/data/EZORTD.json",
                "w");

            if (f)
            {
                fprintf(f,
                        "{ \"temperature\": %.3f }\n",
                        temperature);

                fclose(f);
            }

            FILE *log = fopen(
                "/home/cristian/airquality/basic-ui-dashboard/logs/temperature.csv",
                "a+");

            if (log)
            {
                time_t now = time(NULL);

                fseek(log, 0, SEEK_END);

                if (ftell(log) == 0)
                {
                    fprintf(log, "timestamp,value\n");
                }

                fprintf(log,
                        "%ld,%.3f\n",
                        now,
                        temperature);

                fclose(log);
            }
        }

        sleep(1);
    }

    return 0;
}
