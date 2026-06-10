CC=gcc
CFLAGS=-I.
OBJ=main.o ezortd.o

%.o: %.c
	$(CC) -c -o $@ $< $(CFLAGS)

EZORTD: $(OBJ)
	$(CC) -o $@ $^ $(CFLAGS)

clean:
	rm -f EZORTD *.o