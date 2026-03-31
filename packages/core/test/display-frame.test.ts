import { describe, expect, it } from "vitest";
import { buildDisplayFrame } from "../src/display-frame";
import type { DeviceSnapshot } from "../src/device-simulator";
import { PowerPolicyEngine } from "../src/power-policy";

function makeSnapshot(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    screen: "Home",
    selectedCard: "Tracking",
    trackingActive: false,
    requestedPowerProfile: "balanced",
    effectivePowerProfile: "balanced",
    batteryPct: 78,
    powerPolicy: PowerPolicyEngine.evaluate("balanced", 78),
    gps: {
      status: "idle",
      lastFix: null,
      lastError: null
    },
    radio: {
      status: "idle",
      lastRx: null,
      lastTxResult: null,
      lastError: null
    },
    ble: {
      mtu: 180,
      lastKind: null
    },
    config: {
      powerProfile: "balanced",
      trackingIntervalS: 30,
      bleMtu: 180
    },
    deviceTimeS: 1711900000,
    lastAlert: null,
    ...overrides
  };
}

describe("buildDisplayFrame", () => {
  it("renders the selected home card", () => {
    const frame = buildDisplayFrame(makeSnapshot({ selectedCard: "Radio" }));

    expect(frame.width).toBe(200);
    expect(frame.height).toBe(200);
    expect(frame.lines.some((entry) => entry.text.includes("> Radio"))).toBe(true);
  });

  it("renders location details from the latest GPS fix", () => {
    const frame = buildDisplayFrame(
      makeSnapshot({
        screen: "LocationDetail",
        gps: {
          status: "fixed",
          lastFix: {
            lat: 51.5072,
            lon: -0.1276,
            altM: 18,
            sats: 9,
            hdop: 1.1,
            unixTimeS: 1711900000
          },
          lastError: null
        }
      })
    );

    expect(frame.lines.some((entry) => entry.text.includes("Lat: 51.50720"))).toBe(true);
    expect(frame.lines.some((entry) => entry.text.includes("Sats: 9"))).toBe(true);
  });
});
