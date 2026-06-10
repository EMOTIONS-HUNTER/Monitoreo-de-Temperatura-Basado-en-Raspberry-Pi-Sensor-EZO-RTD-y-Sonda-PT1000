#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <stdlib.h>

#include "ezortd.h"

int getTemperature(int fd, double *temperature)
{
    if(ioctl(fd, I2C_SLAVE, EZORTD_I2C_ADDR) < 0)
    {
        perror("ioctl");
        return -1;
    }

    char cmd[] = "R";

    if(write(fd, cmd, strlen(cmd)) < 0)
    {
        perror("write");
        return -1;
    }

    usleep(1000000);

    unsigned char response[32];

    int n = read(fd, response, sizeof(response));

    if(n < 0)
    {
        perror("read");
        return -1;
    }

    if(response[0] != 0x01)
    {
        fprintf(stderr,"EZO error code: %d\n", response[0]);
        return -1;
    }

    *temperature = atof((char *)&response[1]);

    return 0;
}