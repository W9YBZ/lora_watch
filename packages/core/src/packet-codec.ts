import { crc16Ccitt } from "./crc16";
import {
  DEFAULT_BLE_MTU,
  decodePayload,
  encodePayload,
  isKnownPacketKind,
  type DecodedApplicationPacket,
  type DevicePacket,
  type PacketKind,
  type PayloadMap,
  PROTOCOL_VERSION
} from "./protocol";

const HEADER_SIZE = 13;
const CRC_SIZE = 2;

export class PacketDecodeError extends Error {}

export interface EncodePacketInput<K extends PacketKind> {
  kind: K;
  flags?: number;
  seq: number;
  session: number;
  timestampS: number;
  payload: PayloadMap[K];
}

export const DevicePacketCodec = {
  encodeApplicationPacket<K extends PacketKind>(input: EncodePacketInput<K>): Uint8Array {
    const payload = encodePayload(input.kind, input.payload);
    return encodeRawPacket({
      version: PROTOCOL_VERSION,
      kind: input.kind,
      flags: input.flags ?? 0,
      seq: input.seq,
      session: input.session,
      timestampS: input.timestampS,
      payloadLength: payload.length,
      payload,
      crc16: 0
    });
  },
  decodeApplicationPacket(packetBytes: Uint8Array): DecodedApplicationPacket {
    const packet = decodeRawPacket(packetBytes);
    const decodedPayload = decodePayload(packet.kind, packet.payload);
    return {
      packet,
      decodedPayload
    };
  },
  encodeRawPacket,
  decodeRawPacket,
  fragment(packetBytes: Uint8Array, mtu = DEFAULT_BLE_MTU): Uint8Array[] {
    if (mtu <= 0) {
      throw new Error("MTU must be positive");
    }

    const fragments: Uint8Array[] = [];
    for (let offset = 0; offset < packetBytes.length; offset += mtu) {
      fragments.push(packetBytes.slice(offset, offset + mtu));
    }
    return fragments;
  },
  reassemble(fragments: Uint8Array[]): Uint8Array {
    const totalLength = fragments.reduce((sum, fragment) => sum + fragment.length, 0);
    const packet = new Uint8Array(totalLength);
    let offset = 0;

    for (const fragment of fragments) {
      packet.set(fragment, offset);
      offset += fragment.length;
    }

    return packet;
  }
};

export function encodeRawPacket(packet: DevicePacket<Uint8Array>): Uint8Array {
  const totalLength = HEADER_SIZE + packet.payload.length + CRC_SIZE;
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, packet.version);
  view.setUint8(1, packet.kind);
  view.setUint8(2, packet.flags);
  view.setUint16(3, packet.seq, true);
  view.setUint16(5, packet.session, true);
  view.setUint32(7, packet.timestampS, true);
  view.setUint16(11, packet.payload.length, true);
  bytes.set(packet.payload, HEADER_SIZE);

  const crc = crc16Ccitt(bytes.slice(0, totalLength - CRC_SIZE));
  view.setUint16(totalLength - CRC_SIZE, crc, true);

  return bytes;
}

export function decodeRawPacket(packetBytes: Uint8Array): DevicePacket<Uint8Array> {
  if (packetBytes.length < HEADER_SIZE + CRC_SIZE) {
    throw new PacketDecodeError("Packet too short");
  }

  const view = new DataView(packetBytes.buffer, packetBytes.byteOffset, packetBytes.byteLength);
  const version = view.getUint8(0);

  if (version !== PROTOCOL_VERSION) {
    throw new PacketDecodeError(`Unsupported protocol version: ${version}`);
  }

  const kind = view.getUint8(1);
  if (!isKnownPacketKind(kind)) {
    throw new PacketDecodeError(`Unknown packet kind: ${kind}`);
  }

  const payloadLength = view.getUint16(11, true);
  const expectedLength = HEADER_SIZE + payloadLength + CRC_SIZE;
  if (packetBytes.length !== expectedLength) {
    throw new PacketDecodeError("Packet length mismatch");
  }

  const actualCrc = view.getUint16(expectedLength - CRC_SIZE, true);
  const expectedCrc = crc16Ccitt(packetBytes.slice(0, expectedLength - CRC_SIZE));
  if (actualCrc !== expectedCrc) {
    throw new PacketDecodeError("CRC mismatch");
  }

  return {
    version,
    kind,
    flags: view.getUint8(2),
    seq: view.getUint16(3, true),
    session: view.getUint16(5, true),
    timestampS: view.getUint32(7, true),
    payloadLength,
    payload: packetBytes.slice(HEADER_SIZE, HEADER_SIZE + payloadLength),
    crc16: actualCrc
  };
}
