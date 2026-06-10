CC=gcc
CFLAGS=-I.
DEPS =
OBJ = main.o htu21d.o
EXTRA_LIBS=-li2c

%.o: %.c $(DEPS)
	$(CC) -c -o $@ $< $(CFLAGS)

HTU21D: $(OBJ)
	$(CC) -o $@ $^ $(CFLAGS) $(EXTRA_LIBS)

.PHONY: clean

clean:
	rm -f HTU21D $(OBJ)
