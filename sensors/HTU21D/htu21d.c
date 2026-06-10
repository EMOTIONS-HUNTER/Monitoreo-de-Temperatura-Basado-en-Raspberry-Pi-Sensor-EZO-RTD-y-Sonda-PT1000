#include <unistd.h> //to send commands to and receive from I2C device
#include <sys/ioctl.h>//setting up and controlling the I2C device settings
#include <linux/i2c-dev.h>//definitions for system calls and structures specific to I2C
#include <i2c/smbus.h>//SMBus commands in a more standardized way for I2C
#include <stdio.h>//perror

#include "htu21d.h" // my own header file

// Reset function:
int reset(int fd)
{
	if(0 > ioctl(fd, I2C_SLAVE, HTU21D_I2C_ADDR))
	{
		perror("Failed to open the bus");
		return -1;
	}
	i2c_smbus_write_byte(fd, HTU21D_RESET);
	return 0;
}

// Get temperature:
int getTemperature(int fd, double *temperature)
{
	reset(fd);
	char buf[3];
	__s32 res = i2c_smbus_read_i2c_block_data(fd, HTU21D_TEMP,3,buf);
	if(res<0)
	{
		perror("Failed to read from the device");
		return -1;
	}
	*temperature = -46.85 + 175.72 * (buf[0]*256 + buf[1]) / 65536.0;
	return 0;
}


// Get humidity:
int getHumidity(int fd, double *humidity)
{
	reset(fd);
	char buf[3];
	__s32 res = i2c_smbus_read_i2c_block_data(fd, HTU21D_HUMID, 3, buf);
	if(res<0)
	{
		perror("Failed to read from the device");
		return -1;
	}
	*humidity = -6 + 125 * (buf[0]*256 + buf[1]) / 65536.0;
	return 0;
}


