#include <stdio.h>
#include <fcntl.h>

#include "ezoec.h"

int main()
{
    int fd = open("/dev/i2c-1",O_RDWR);

    double ec;

    getEC(fd,&ec);

    printf("{ \"ec\": %.3f }\n",ec);

    return 0;
}