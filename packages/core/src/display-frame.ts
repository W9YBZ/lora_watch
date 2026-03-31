import type { DeviceSnapshot } from "./device-simulator";
import { BleGattProfile } from "./protocol";

export interface DisplayFrameLine {
  y: number;
  text: string;
  tone: "primary" | "accent" | "muted";
}

export interface DisplayFrame {
  width: number;
  height: number;
  screen: string;
  lines: DisplayFrameLine[];
}

function line(y: number, text: string, tone: DisplayFrameLine["tone"] = "primary"): DisplayFrameLine {
  return { y, text, tone };
}

function screenTimeoutSeconds(profile: DeviceSnapshot["effectivePowerProfile"]): number {
  switch (profile) {
    case "performance":
      return 30;
    case "balanced":
      return 15;
    case "saver":
      return 8;
    case "emergency":
      return 10;
  }
}

export function buildDisplayFrame(snapshot: DeviceSnapshot): DisplayFrame {
  switch (snapshot.screen) {
    case "Boot":
      return {
        width: 200,
        height: 200,
        screen: snapshot.screen,
        lines: [
          line(0, "BOOT | lora_watch", "accent"),
          line(22, "200x200 serial e-ink", "primary"),
          line(44, "ESP32-S3 + BLE + LoRa + GPS", "primary"),
          line(66, "auto-enter home after splash", "muted")
        ]
      };
    case "Tracking":
      return {
        width: 200,
        height: 200,
        screen: snapshot.screen,
        lines: [
          line(0, "TRACKING", "accent"),
          line(24, `Mode: ${snapshot.trackingActive ? "ON" : "OFF"}`),
          line(48, `GPS: ${snapshot.gps.status}`),
          line(72, `Profile: ${snapshot.effectivePowerProfile}`),
          line(96, "M toggles tracking", "muted"),
          line(120, "EXIT returns home", "muted")
        ]
      };
    case "LocationDetail":
      return {
        width: 200,
        height: 200,
        screen: snapshot.screen,
        lines: [
          line(0, "LOCATION", "accent"),
          line(24, `GPS: ${snapshot.gps.status}`),
          line(48, `Lat: ${snapshot.gps.lastFix?.lat?.toFixed(5) ?? "0.00000"}`),
          line(66, `Lon: ${snapshot.gps.lastFix?.lon?.toFixed(5) ?? "0.00000"}`),
          line(84, `Alt: ${snapshot.gps.lastFix?.altM?.toFixed(1) ?? "0.0"}m`),
          line(102, `Sats: ${snapshot.gps.lastFix?.sats ?? 0}`),
          line(120, `HDOP: ${snapshot.gps.lastFix?.hdop?.toFixed(1) ?? "0.0"}`),
          line(138, `Unix: ${snapshot.deviceTimeS}`)
        ]
      };
    case "RadioStatus":
      return {
        width: 200,
        height: 200,
        screen: snapshot.screen,
        lines: [
          line(0, "RADIO", "accent"),
          line(24, `LoRa: ${snapshot.radio.status}`),
          line(48, `Last RX: ${snapshot.radio.lastRx?.payloadHex ?? "-"}`),
          line(72, `Alert: ${snapshot.lastAlert?.message ?? "-"}`),
          line(96, "BLE service:", "muted"),
          line(114, BleGattProfile.service, "muted")
        ]
      };
    case "Settings":
      return {
        width: 200,
        height: 200,
        screen: snapshot.screen,
        lines: [
          line(0, "SETTINGS", "accent"),
          line(24, `Profile: ${snapshot.effectivePowerProfile}`),
          line(48, `Timeout: ${screenTimeoutSeconds(snapshot.effectivePowerProfile)}s`),
          line(72, "Display: serial 200x200"),
          line(96, "Input: M / EXIT / UP / DOWN", "muted"),
          line(120, "Button-only navigation", "muted")
        ]
      };
    case "Home":
    default: {
      const cards = ["Tracking", "Location", "Radio", "Settings"];
      return {
        width: 200,
        height: 200,
        screen: "Home",
        lines: [
          line(0, snapshot.trackingActive ? "HOME | tracking active" : "HOME | tracking idle", "accent"),
          line(22, "card list", "muted"),
          ...cards.map((card, index) =>
            line(46 + index * 18, `${snapshot.selectedCard === card ? "> " : "  "}${card}`, snapshot.selectedCard === card ? "accent" : "primary")
          ),
          line(126, `GPS: ${snapshot.gps.status}`, "muted"),
          line(144, `LoRa: ${snapshot.radio.status}`, "muted"),
          line(162, `Power: ${snapshot.effectivePowerProfile}`, "muted"),
          line(180, "M=open | long M=toggle tracking", "muted")
        ]
      };
    }
  }
}
