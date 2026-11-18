#include <Arduino.h>

// Reconstructed historical stage, not a recovered source snapshot.
// GPIO13: one second on, one second off.
static const uint8_t LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
