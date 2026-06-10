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
                time_t now = time(NULL);
                struct tm *t = localtime(&now);

                char timestamp[32];

                strftime(timestamp,
                         sizeof(timestamp),
                         "%Y-%m-%d %H:%M:%S",
                         t);
                fprintf(f,
                        "{ \"temperature\": %.3f }\n",
                        temperature);

                fclose(f);
            }
        }

        FILE *log = fopen(
            "/home/cristian/airquality/basic-ui-dashboard/logs/temp.csv",
            "a");

        if (log)
        {
            time_t now = time(NULL);
            struct tm *t = localtime(&now);

            char timestamp[32];

            strftime(timestamp,
                     sizeof(timestamp),
                     "%Y-%m-%d %H:%M:%S",
                     t);

            fprintf(log,
                    "%ld,%.3f\n",
                    now,
                    temperature);

            fclose(log);
        }

        sleep(1);
    }

    return 0;
}
