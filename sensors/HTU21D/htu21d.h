#ifndef HTU21D_H
#define HTU21D_H

// I2C Address
#define HTU21D_I2C_ADDR 0x40
// Commands
#define HTU21D_TEMP 0xE3
#define HTU21D_HUMID 0xE5
#define HTU21D_RESET 0xFE


// Function declarations:

// Temp
int getTemperature(int fd, double *temperature);
// Humidity
int getHumidity(int fd, double *humidity);

#endif // HTU21D_H
