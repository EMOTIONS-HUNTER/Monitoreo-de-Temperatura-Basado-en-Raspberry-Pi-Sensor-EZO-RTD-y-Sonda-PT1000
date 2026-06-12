#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <stdlib.h>

#include "ezodo.h"

int getDO(int fd,double *oxygen)
{
    if(ioctl(fd,I2C_SLAVE,EZODO_I2C_ADDR)<0)
    {
        return -1;
    }

    char cmd[]="R";

    write(fd,cmd,strlen(cmd));

    usleep(1000000);

    unsigned char response[32];

    read(fd,response,sizeof(response));

    if(response[0]!=0x01)
    {
        return -1;
    }

    *oxygen = atof((char*)&response[1]);

    return 0;
}