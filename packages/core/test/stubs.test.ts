import { describe, expect, it } from "vitest";
import { GpsStubDriver, LoraStubDriver } from "../src/stubs";

describe("GpsStubDriver", () => {
  it("moves from cold start to fix and handles signal loss", () => {
    const gps = new GpsStubDriver();
    const statuses: string[] = [];
    const fixes: number[] = [];
    const errors: string[] = [];

    gps.on("status", (status) => statuses.push(status));
    gps.on("fix", (fix) => fixes.push(fix.sats));
    gps.on("error", ({ message }) => errors.push(message));

    gps.start();
    gps.injectFix({
      lat: 51.5072,
      lon: -0.1276,
      altM: 18,
      sats: 9,
      hdop: 1.2,
      unixTimeS: 1711900000
    });
    gps.injectLoss("GPS timeout");

    expect(statuses).toContain("searching");
    expect(statuses).toContain("fixed");
    expect(statuses).toContain("lost");
    expect(fixes).toEqual([9]);
    expect(errors).toEqual(["GPS timeout"]);
  });
});

describe("LoraStubDriver", () => {
  it("reports send success, send failure, and RX frames", () => {
    const lora = new LoraStubDriver();
    const txResults: string[] = [];
    const rxFrames: string[] = [];

    lora.on("txDone", (result) => txResults.push(result.message));
    lora.on("rx", (frame) => rxFrames.push(frame.payloadHex));

    lora.configure({
      region: "EU868",
      spreadingFactor: 7,
      bandwidthKhz: 125,
      codingRate: "4/5"
    });
    lora.send(new Uint8Array([0x01]));
    lora.failNextSend("uplink timeout");
    lora.send(new Uint8Array([0x02]));
    lora.injectRx({
      payloadHex: "0AFFEE",
      rssi: -112,
      snr: 7.5
    });

    expect(txResults[0]).toContain("sent");
    expect(txResults[1]).toBe("uplink timeout");
    expect(rxFrames).toEqual(["0AFFEE"]);
  });
});
