#include <Arduino.h>

// Ping-pong running LED (forward then backward)
//   forward : D13 -> D12 -> D14
//   backward: D14 -> D12 -> D13
// Each LED stays on for 100 ms; the sequence is 13,12,14,12,13,12,14,...
static const uint8_t LED_PINS[] = {13, 12, 14};
static const uint8_t LED_COUNT = sizeof(LED_PINS) / sizeof(LED_PINS[0]);

static const uint32_t STEP_MS = 100;

static int8_t step = 0;   // index into LED_PINS
static int8_t dir = 1;    // +1 forward, -1 backward

static void allOff() {
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    digitalWrite(LED_PINS[i], LOW);
  }
}

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  Serial.println("ESP32 ping-pong LED: D13 -> D12 -> D14 -> D12 -> ... 100 ms/step");
}

void loop() {
  uint8_t pin = LED_PINS[step];

  digitalWrite(pin, HIGH);
  Serial.printf("LED ON  D%u (GPIO%u)  dir=%s\n", pin, pin, dir > 0 ? "fwd" : "back");
  delay(STEP_MS);
  digitalWrite(pin, LOW);

  // Bounce at both ends (endpoints are shown once per pass)
  if (step >= (int8_t)(LED_COUNT - 1)) {
    dir = -1;
  } else if (step <= 0) {
    dir = 1;
  }
  step += dir;

  if (step < 0) step = 0;
  if (step > (int8_t)(LED_COUNT - 1)) step = LED_COUNT - 1;
}
