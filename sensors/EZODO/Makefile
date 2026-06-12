CC=gcc
CFLAGS=-I.

OBJ=main.o sensor.o

TARGET=sensor

%.o: %.c
	$(CC) -c -o $@ $< $(CFLAGS)

$(TARGET): $(OBJ)
	$(CC) -o $@ $^ $(CFLAGS)

clean:
	rm -f *.o $(TARGET)