#include <stdio.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>

#include "ezortd.h"

int main()
{
    int fd;

    fd = open("/dev/i2c-1", O_RDWR);

    if(fd < 0)
    {
        fprintf(stderr,
                "ERROR: Unable to access EZO RTD: %s\n",
                strerror(errno));
        return -1;
    }

    double temperature = 0;

    if(getTemperature(fd, &temperature) < 0)
    {
        fprintf(stderr,
                "ERROR: Failed to read temperature\n");
        return -1;
    }

    printf("{ ");
    printf("\"temperature\": %.3f ", temperature);
    printf("}");

    return 0;
}