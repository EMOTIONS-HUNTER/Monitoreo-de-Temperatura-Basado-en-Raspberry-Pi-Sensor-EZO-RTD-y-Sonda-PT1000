#ifndef EZORTD_H
#define EZORTD_H

#define EZORTD_I2C_ADDR 0x66

int getTemperature(int fd, double *temperature);

#endif