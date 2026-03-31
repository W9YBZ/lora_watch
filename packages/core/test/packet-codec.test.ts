import { describe, expect, it } from "vitest";
import { DevicePacketCodec, PacketDecodeError } from "../src/packet-codec";
import { PacketKind } from "../src/protocol";

describe("DevicePacketCodec", () => {
  it("round-trips an application packet", () => {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.TIME_SYNC,
      seq: 1,
      session: 0x1001,
      timestampS: 1711900000,
      payload: {
        unixTimeS: 1711900000,
        timezoneOffsetMin: 60
      }
    });

    const decoded = DevicePacketCodec.decodeApplicationPacket(bytes);

    expect(decoded.packet.kind).toBe(PacketKind.TIME_SYNC);
    expect(decoded.decodedPayload).toEqual({
      unixTimeS: 1711900000,
      timezoneOffsetMin: 60
    });
  });

  it("rejects a corrupted crc", () => {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.HELLO,
      seq: 1,
      session: 0x1001,
      timestampS: 1,
      payload: {
        deviceName: "lora-watch",
        firmwareVersion: "0.1.0",
        capabilities: ["gps", "lora", "ble"]
      }
    });

    bytes[bytes.length - 1] ^= 0xff;

    expect(() => DevicePacketCodec.decodeApplicationPacket(bytes)).toThrow(PacketDecodeError);
  });

  it("rejects unsupported protocol versions", () => {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.CONFIG_GET,
      seq: 1,
      session: 0x1001,
      timestampS: 1,
      payload: {
        keys: ["powerProfile"]
      }
    });

    bytes[0] = 99;

    expect(() => DevicePacketCodec.decodeApplicationPacket(bytes)).toThrow("Unsupported protocol version");
  });

  it("rejects unknown packet kinds", () => {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.CONFIG_GET,
      seq: 1,
      session: 0x1001,
      timestampS: 1,
      payload: {
        keys: ["powerProfile"]
      }
    });

    bytes[1] = 0x55;
    bytes[bytes.length - 2] = 0;
    bytes[bytes.length - 1] = 0;

    expect(() => DevicePacketCodec.decodeApplicationPacket(bytes)).toThrow("Unknown packet kind");
  });

  it("fragments and reassembles packets", () => {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.ALERT,
      seq: 1,
      session: 0x1001,
      timestampS: 1,
      payload: {
        level: "critical",
        message: "A".repeat(220)
      }
    });

    const fragments = DevicePacketCodec.fragment(bytes, 60);

    expect(fragments.length).toBeGreaterThan(1);
    expect(DevicePacketCodec.reassemble(fragments)).toEqual(bytes);
  });
});
