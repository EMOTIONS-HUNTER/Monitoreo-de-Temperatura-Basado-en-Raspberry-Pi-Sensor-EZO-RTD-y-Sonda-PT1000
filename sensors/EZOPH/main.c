#include <stdio.h>
#include <fcntl.h>
#include <string.h>
#include <errno.h>

#include "ezoph.h"

int main()
{
    int fd = open("/dev/i2c-1",O_RDWR);

    if(fd < 0)
    {
        fprintf(stderr,"%s\n",strerror(errno));
        return -1;
    }

    double ph;

    if(getPH(fd,&ph) < 0)
    {
        return -1;
    }

    printf("{ \"ph\": %.3f }\n",ph);

    return 0;
}