#include <Arduino.h>
#include "generated/protocol_ids.h"

namespace {
constexpr int PIN_M = 16;
constexpr int PIN_EXIT = 17;
constexpr int PIN_UP = 18;
constexpr int PIN_DOWN = 8;

constexpr unsigned long LONG_PRESS_MS = 700;
constexpr unsigned long BOOT_SPLASH_MS = 900;

constexpr int DISPLAY_WIDTH = 200;
constexpr int DISPLAY_HEIGHT = 200;

enum ScreenId {
  SCREEN_BOOT,
  SCREEN_HOME,
  SCREEN_TRACKING,
  SCREEN_LOCATION,
  SCREEN_RADIO,
  SCREEN_SETTINGS
};

struct WatchState {
  ScreenId screen = SCREEN_BOOT;
  int selectedCardIndex = 0;
  bool trackingActive = false;
  String powerProfile = "balanced";
  String gpsStatus = "idle";
  String radioStatus = "idle";
  String lastAlert = "-";
  String loraPayloadHex = "-";
  float lat = 0.0f;
  float lon = 0.0f;
  float altM = 0.0f;
  float hdop = 0.0f;
  int sats = 0;
  unsigned long deviceTimeS = 0;
  bool dirty = true;
  unsigned long lastInteractionMs = 0;
} state;

struct ButtonState {
  int pin = -1;
  bool wasPressed = false;
  unsigned long pressedAt = 0;
};

class SerialInkDisplay {
 public:
  void begin() {
    Serial.begin(115200);
    Serial.println();
    Serial.println("[display] serial e-ink stub ready");
    Serial.print("[display] resolution=");
    Serial.print(DISPLAY_WIDTH);
    Serial.print("x");
    Serial.println(DISPLAY_HEIGHT);
  }

  void render(const WatchState &snapshot) {
    Serial.println();
    Serial.println("=== DISPLAY FRAME 200x200 ===");

    switch (snapshot.screen) {
      case SCREEN_BOOT:
        bootFrame();
        break;
      case SCREEN_HOME:
        homeFrame(snapshot);
        break;
      case SCREEN_TRACKING:
        trackingFrame(snapshot);
        break;
      case SCREEN_LOCATION:
        locationFrame(snapshot);
        break;
      case SCREEN_RADIO:
        radioFrame(snapshot);
        break;
      case SCREEN_SETTINGS:
        settingsFrame(snapshot);
        break;
    }

    Serial.println("=== END FRAME ===");
  }

 private:
  void line(int y, const String &text) {
    Serial.print("[0,");
    Serial.print(y);
    Serial.print("] ");
    Serial.println(text);
  }

  void bootFrame() {
    line(0, "BOOT | lora_watch");
    line(22, "200x200 serial e-ink");
    line(44, "ESP32-S3 + BLE + LoRa + GPS");
    line(66, "auto-enter home after splash");
  }

  void homeFrame(const WatchState &snapshot) {
    line(0, snapshot.trackingActive ? "HOME | tracking active" : "HOME | tracking idle");
    line(22, "card list");

    static const char *cards[] = {"Tracking", "Location", "Radio", "Settings"};
    for (int index = 0; index < 4; index += 1) {
      String prefix = index == snapshot.selectedCardIndex ? "> " : "  ";
      line(46 + index * 18, prefix + cards[index]);
    }

    line(126, "GPS: " + snapshot.gpsStatus);
    line(144, "LoRa: " + snapshot.radioStatus);
    line(162, "Power: " + snapshot.powerProfile);
    line(180, "M=open | long M=toggle tracking");
  }

  void trackingFrame(const WatchState &snapshot) {
    line(0, "TRACKING");
    line(24, String("Mode: ") + (snapshot.trackingActive ? "ON" : "OFF"));
    line(48, "GPS: " + snapshot.gpsStatus);
    line(72, "Profile: " + snapshot.powerProfile);
    line(96, "M toggles tracking");
    line(120, "EXIT returns home");
  }

  void locationFrame(const WatchState &snapshot) {
    line(0, "LOCATION");
    line(24, "GPS: " + snapshot.gpsStatus);
    line(48, "Lat: " + String(snapshot.lat, 5));
    line(66, "Lon: " + String(snapshot.lon, 5));
    line(84, "Alt: " + String(snapshot.altM, 1) + "m");
    line(102, "Sats: " + String(snapshot.sats));
    line(120, "HDOP: " + String(snapshot.hdop, 1));
    line(138, "Unix: " + String(snapshot.deviceTimeS));
  }

  void radioFrame(const WatchState &snapshot) {
    line(0, "RADIO");
    line(24, "LoRa: " + snapshot.radioStatus);
    line(48, "Last RX: " + snapshot.loraPayloadHex);
    line(72, "Alert: " + snapshot.lastAlert);
    line(96, "BLE service:");
    line(114, LW_BLE_SERVICE_UUID);
  }

  void settingsFrame(const WatchState &snapshot) {
    line(0, "SETTINGS");
    line(24, "Profile: " + snapshot.powerProfile);
    line(48, "Timeout: " + String(screenTimeoutMs(snapshot.powerProfile) / 1000) + "s");
    line(72, "Display: serial 200x200");
    line(96, "Input: M / EXIT / UP / DOWN");
    line(120, "Button-only navigation");
  }

  unsigned long screenTimeoutMs(const String &profile) {
    if (profile == "performance") {
      return 30000UL;
    }
    if (profile == "balanced") {
      return 15000UL;
    }
    if (profile == "saver") {
      return 8000UL;
    }
    return 10000UL;
  }
};

SerialInkDisplay display;
ButtonState mButton{PIN_M, false, 0};
ButtonState exitButton{PIN_EXIT, false, 0};
ButtonState upButton{PIN_UP, false, 0};
ButtonState downButton{PIN_DOWN, false, 0};

String serialBuffer;
unsigned long bootAt = 0;

String extractRawField(const String &json, const String &field) {
  const String needle = "\"" + field + "\"";
  int index = json.indexOf(needle);
  if (index < 0) {
    return "";
  }

  index = json.indexOf(':', index);
  if (index < 0) {
    return "";
  }

  index += 1;
  while (index < json.length() && isspace(json[index])) {
    index += 1;
  }

  if (index >= json.length()) {
    return "";
  }

  if (json[index] == '"') {
    const int start = index + 1;
    int end = start;
    while (end < json.length() && json[end] != '"') {
      end += 1;
    }
    return json.substring(start, end);
  }

  int end = index;
  while (end < json.length() && json[end] != ',' && json[end] != '}') {
    end += 1;
  }
  return json.substring(index, end);
}

String readStringField(const String &json, const String &field, const String &fallback = "") {
  const String value = extractRawField(json, field);
  return value.length() == 0 ? fallback : value;
}

long readLongField(const String &json, const String &field, long fallback = 0) {
  const String value = extractRawField(json, field);
  return value.length() == 0 ? fallback : value.toInt();
}

float readFloatField(const String &json, const String &field, float fallback = 0.0f) {
  const String value = extractRawField(json, field);
  return value.length() == 0 ? fallback : value.toFloat();
}

bool readBoolField(const String &json, const String &field, bool fallback = false) {
  const String value = extractRawField(json, field);
  if (value.length() == 0) {
    return fallback;
  }
  return value == "true";
}

unsigned long screenTimeoutMs() {
  if (state.powerProfile == "performance") {
    return 30000UL;
  }
  if (state.powerProfile == "balanced") {
    return 15000UL;
  }
  if (state.powerProfile == "saver") {
    return 8000UL;
  }
  return 10000UL;
}

void noteInteraction() {
  state.lastInteractionMs = millis();
}

void markDirty() {
  state.dirty = true;
}

void selectNextCard(int direction) {
  state.selectedCardIndex = (state.selectedCardIndex + direction + 4) % 4;
  noteInteraction();
  markDirty();
}

void openSelectedCard() {
  switch (state.selectedCardIndex) {
    case 0:
      state.screen = SCREEN_TRACKING;
      break;
    case 1:
      state.screen = SCREEN_LOCATION;
      break;
    case 2:
      state.screen = SCREEN_RADIO;
      break;
    default:
      state.screen = SCREEN_SETTINGS;
      break;
  }
  noteInteraction();
  markDirty();
}

void applyInputEvent(const String &eventName, bool longPress = false) {
  if (eventName == "timeout") {
    state.screen = SCREEN_BOOT;
    markDirty();
    return;
  }

  if (state.screen == SCREEN_BOOT) {
    state.screen = SCREEN_HOME;
    noteInteraction();
    markDirty();
    return;
  }

  if (eventName == "exit") {
    if (state.screen == SCREEN_HOME) {
      state.screen = SCREEN_BOOT;
    } else {
      state.screen = SCREEN_HOME;
    }
    noteInteraction();
    markDirty();
    return;
  }

  if (eventName == "up") {
    if (state.screen == SCREEN_HOME) {
      selectNextCard(-1);
    }
    return;
  }

  if (eventName == "down") {
    if (state.screen == SCREEN_HOME) {
      selectNextCard(1);
    }
    return;
  }

  if (eventName == "m" && longPress && state.screen == SCREEN_HOME) {
    state.trackingActive = !state.trackingActive;
    noteInteraction();
    markDirty();
    return;
  }

  if (eventName == "m") {
    if (state.screen == SCREEN_HOME) {
      openSelectedCard();
    } else if (state.screen == SCREEN_TRACKING) {
      state.trackingActive = !state.trackingActive;
      noteInteraction();
      markDirty();
    }
    return;
  }
}

void renderScreen() {
  if (!state.dirty) {
    return;
  }

  display.render(state);
  state.dirty = false;
}

void applyBleCommand(const String &json) {
  const int kindId = readLongField(json, "kindId", -1);

  if (kindId == LW_KIND_TIME_SYNC) {
    state.deviceTimeS = readLongField(json, "unixTimeS", state.deviceTimeS);
  } else if (kindId == LW_KIND_CONFIG_SET) {
    state.powerProfile = readStringField(json, "powerProfile", state.powerProfile);
  } else if (kindId == LW_KIND_ALERT) {
    const String level = readStringField(json, "level", "info");
    const String message = readStringField(json, "message", "-");
    state.lastAlert = level + ": " + message;
  } else if (kindId == LW_KIND_TRACKING_STATE) {
    state.trackingActive = readBoolField(json, "active", state.trackingActive);
  }

  Serial.print("ACK kindId=");
  Serial.println(kindId);
  noteInteraction();
  markDirty();
}

void applyCommand(const String &json) {
  const String type = readStringField(json, "type", "");

  if (type == "ble.rx") {
    applyBleCommand(json);
  } else if (type == "gps.fix") {
    state.gpsStatus = "fixed";
    state.lat = readFloatField(json, "lat", state.lat);
    state.lon = readFloatField(json, "lon", state.lon);
    state.altM = readFloatField(json, "altM", state.altM);
    state.hdop = readFloatField(json, "hdop", state.hdop);
    state.sats = readLongField(json, "sats", state.sats);
    state.deviceTimeS = readLongField(json, "unixTimeS", state.deviceTimeS);
    noteInteraction();
    markDirty();
  } else if (type == "gps.loss") {
    state.gpsStatus = "lost";
    state.lastAlert = readStringField(json, "message", "GPS timeout");
    noteInteraction();
    markDirty();
  } else if (type == "lora.rx") {
    state.radioStatus = "rx";
    state.loraPayloadHex = readStringField(json, "payloadHex", "-");
    noteInteraction();
    markDirty();
  } else if (type == "lora.tx_result") {
    const bool ok = readBoolField(json, "ok", true);
    state.radioStatus = ok ? "tx-ok" : "tx-fail";
    state.lastAlert = readStringField(json, "message", ok ? "uplink ok" : "uplink failed");
    noteInteraction();
    markDirty();
  } else if (type == "power.set") {
    state.powerProfile = readStringField(json, "profile", state.powerProfile);
    noteInteraction();
    markDirty();
  } else if (type == "input.inject") {
    applyInputEvent(readStringField(json, "event", "m"), readBoolField(json, "longPress", false));
  }
}

void handleSerial() {
  while (Serial.available() > 0) {
    const char incoming = static_cast<char>(Serial.read());
    if (incoming == '\n') {
      const String command = serialBuffer;
      serialBuffer = "";
      if (command.length() > 0) {
        applyCommand(command);
      }
    } else if (incoming != '\r') {
      serialBuffer += incoming;
    }
  }
}

void handleButton(ButtonState &button, const String &eventName) {
  const bool pressed = digitalRead(button.pin) == LOW;
  if (pressed && !button.wasPressed) {
    button.wasPressed = true;
    button.pressedAt = millis();
  }

  if (!pressed && button.wasPressed) {
    const unsigned long heldMs = millis() - button.pressedAt;
    button.wasPressed = false;
    applyInputEvent(eventName, eventName == "m" && heldMs >= LONG_PRESS_MS);
  }
}

void enforceTimeout() {
  if (state.screen == SCREEN_BOOT) {
    if (millis() - bootAt >= BOOT_SPLASH_MS) {
      applyInputEvent("m");
    }
    return;
  }

  if (millis() - state.lastInteractionMs >= screenTimeoutMs()) {
    applyInputEvent("timeout");
  }
}
}  // namespace

void setup() {
  pinMode(PIN_M, INPUT_PULLUP);
  pinMode(PIN_EXIT, INPUT_PULLUP);
  pinMode(PIN_UP, INPUT_PULLUP);
  pinMode(PIN_DOWN, INPUT_PULLUP);

  display.begin();
  bootAt = millis();
  noteInteraction();
  renderScreen();
  Serial.println("lora_watch Wokwi shell ready");
}

void loop() {
  handleSerial();
  handleButton(mButton, "m");
  handleButton(exitButton, "exit");
  handleButton(upButton, "up");
  handleButton(downButton, "down");
  enforceTimeout();
  renderScreen();
  delay(16);
}
