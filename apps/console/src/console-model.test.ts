import { describe, expect, it } from "vitest";
import { ConsoleModel } from "./console-model";

describe("ConsoleModel", () => {
  it("applies TIME_SYNC packets and updates the snapshot", () => {
    const model = new ConsoleModel();

    model.sendBle("TIME_SYNC", JSON.stringify({ unixTimeS: 1711900000, timezoneOffsetMin: 0 }));

    expect(model.getViewState().snapshot.deviceTimeS).toBe(1711900000);
    expect(model.getViewState().logs[0]?.summary).toContain("ACK");
  });

  it("applies CONFIG_SET and reflects it in the snapshot", () => {
    const model = new ConsoleModel();

    model.sendBle(
      "CONFIG_SET",
      JSON.stringify({ powerProfile: "saver", trackingIntervalS: 120, bleMtu: 128 })
    );

    const snapshot = model.getViewState().snapshot;
    expect(snapshot.requestedPowerProfile).toBe("saver");
    expect(snapshot.config.trackingIntervalS).toBe(120);
    expect(snapshot.ble.mtu).toBe(128);
  });

  it("injects GPS fixes and alerts with matching logs", () => {
    const model = new ConsoleModel();

    model.injectGpsFix({
      lat: 51.5072,
      lon: -0.1276,
      altM: 18,
      sats: 9,
      hdop: 1.1,
      unixTimeS: 1711900050
    });
    model.sendBle("ALERT", JSON.stringify({ level: "warn", message: "GPS drift detected" }));

    const view = model.getViewState();
    expect(view.snapshot.gps.lastFix?.lat).toBe(51.5072);
    expect(view.snapshot.lastAlert?.message).toBe("GPS drift detected");
    expect(view.logs.some((entry) => entry.summary.includes("GPS_FIX"))).toBe(true);
    expect(view.logs.some((entry) => entry.summary.includes("ALERT"))).toBe(true);
  });
});
