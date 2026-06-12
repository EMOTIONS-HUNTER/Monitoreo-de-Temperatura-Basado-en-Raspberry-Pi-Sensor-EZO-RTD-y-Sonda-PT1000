#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <stdlib.h>

#include "ezoph.h"

int getPH(int fd, double *ph)
{
    if(ioctl(fd, I2C_SLAVE, EZOPH_I2C_ADDR) < 0)
    {
        perror("ioctl");
        return -1;
    }

    char cmd[] = "R";

    write(fd, cmd, strlen(cmd));

    usleep(1000000);

    unsigned char response[32];

    if(read(fd,response,sizeof(response)) < 0)
    {
        perror("read");
        return -1;
    }

    if(response[0] != 0x01)
    {
        return -1;
    }

    *ph = atof((char*)&response[1]);

    return 0;
}