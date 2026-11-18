# Wiring and safe diagnostics

## Sensor

```text
ESP32 3V3  ───────────── module +
ESP32 GND  ───────────── module −
ESP32 GPIO27 ─────────── module S
```

Check labels on the actual breakout. Do not infer the order from wire colors or a photo alone. Many breakout boards contain a data pull-up already. If the confirmed sensor datasheet requires an external pull-up, connect the appropriate resistor between signal and **3.3 V**, not 5 V.

GPIO34 cannot generate the required LOW start pulse. GPIO27 supports both output and input, so the MCU can initiate a transaction and then receive the sensor's pulses.

The repository retains the development name DHT12. Confirm the marking/datasheet before selecting another library or relying on decimal resolution. DHT11, DHT22 and DHT12 do not all share the same data encoding or supported interfaces.

## LED chain

```text
GPIO13 ── 220–330 Ω ── LED anode → cathode ── GND
GPIO12 ── 220–330 Ω ── LED anode → cathode ── GND
GPIO14 ── 220–330 Ω ── LED anode → cathode ── GND
```

The resistor may be on either side of each LED, but must be in series. Do not connect LEDs without current limiting. GPIO12 is a strapping pin; avoid an external HIGH at boot. Disconnect power before rewiring.

## If GPIO14's LED stays dark

1. Confirm the GPIO14 header using this specific board's pinout.
2. Check LED polarity, series resistor, breadboard rails and common ground.
3. Power off and swap the LED/jumper with a known-working LED connection.
4. Measure the pin voltage with an appropriate meter if needed.
5. Use the optional diagnostic only after disconnecting the sensor and other peripherals.

**Diagnostic warning:** the `diag` environment actively drives GPIO12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, **27**, 32, 33, 4, 5 and 2. It is a standalone bench test, not safe to run indiscriminately on a connected circuit. Never drive against another powered output.

Reading back `1` after HIGH and `0` after LOW only confirms the input sees those logic levels in that test. It does **not** prove correct LED current, no short under all conditions, no damaged pad, or that the external LED is wired to that pin.

## Serial output

Use **115200 baud**, close competing serial monitors before flashing, and check the configured port. If readable output is mixed with garbage or duplicates, investigate serial settings, USB/adapter, power/reset behavior and cabling. Do not dismiss repeated boot messages as harmless without investigation.
