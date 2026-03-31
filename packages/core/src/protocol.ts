import { z } from "zod";

export const PROTOCOL_VERSION = 1;
export const DEFAULT_BLE_MTU = 180;
export const DEFAULT_SESSION_ID = 0x1001;

export const BleGattProfile = {
  service: "9c1f1000-3476-4f2f-9bce-7a6c5d4e1000",
  rx: "9c1f1001-3476-4f2f-9bce-7a6c5d4e1000",
  tx: "9c1f1002-3476-4f2f-9bce-7a6c5d4e1000",
  state: "9c1f1003-3476-4f2f-9bce-7a6c5d4e1000"
} as const;

export const SCREEN_IDS = [
  "Boot",
  "Home",
  "Tracking",
  "LocationDetail",
  "RadioStatus",
  "Settings"
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

export const INPUT_EVENTS = [
  "wake",
  "back",
  "confirm",
  "touch.tap",
  "touch.swipe_up",
  "touch.swipe_down",
  "timeout"
] as const;

export type InputEventType = (typeof INPUT_EVENTS)[number];

export const HOME_CARDS = [
  "Tracking",
  "Location",
  "Radio",
  "Settings"
] as const;

export type HomeCardId = (typeof HOME_CARDS)[number];

export enum PacketKind {
  HELLO = 0x01,
  HEARTBEAT = 0x02,
  TIME_SYNC = 0x03,
  CONFIG_GET = 0x10,
  CONFIG_SET = 0x11,
  TRACKING_STATE = 0x20,
  GPS_FIX = 0x21,
  ALERT = 0x22,
  ACK = 0x7e,
  ERROR = 0x7f
}

export const PACKET_KIND_NAMES: Record<PacketKind, string> = {
  [PacketKind.HELLO]: "HELLO",
  [PacketKind.HEARTBEAT]: "HEARTBEAT",
  [PacketKind.TIME_SYNC]: "TIME_SYNC",
  [PacketKind.CONFIG_GET]: "CONFIG_GET",
  [PacketKind.CONFIG_SET]: "CONFIG_SET",
  [PacketKind.TRACKING_STATE]: "TRACKING_STATE",
  [PacketKind.GPS_FIX]: "GPS_FIX",
  [PacketKind.ALERT]: "ALERT",
  [PacketKind.ACK]: "ACK",
  [PacketKind.ERROR]: "ERROR"
};

export const KNOWN_PACKET_KINDS = Object.values(PacketKind).filter(
  (value): value is PacketKind => typeof value === "number"
);

export const POWER_PROFILE_IDS = [
  "performance",
  "balanced",
  "saver",
  "emergency"
] as const;

export type PowerProfileId = (typeof POWER_PROFILE_IDS)[number];

export interface HelloPayload {
  deviceName: string;
  firmwareVersion: string;
  capabilities: string[];
}

export interface HeartbeatPayload {
  batteryPct: number;
  profile: PowerProfileId;
  trackingActive: boolean;
}

export interface TimeSyncPayload {
  unixTimeS: number;
  timezoneOffsetMin: number;
}

export interface ConfigGetPayload {
  keys: string[];
}

export interface ConfigSetPayload {
  powerProfile?: PowerProfileId;
  trackingIntervalS?: number;
  bleMtu?: number;
}

export interface TrackingStatePayload {
  active: boolean;
  reason: string;
}

export interface GpsFixPayload {
  lat: number;
  lon: number;
  altM: number;
  sats: number;
  hdop: number;
  unixTimeS: number;
}

export interface AlertPayload {
  level: "info" | "warn" | "critical";
  message: string;
}

export interface AckPayload {
  ackedSeq: number;
  status: "ok";
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type PayloadMap = {
  [PacketKind.HELLO]: HelloPayload;
  [PacketKind.HEARTBEAT]: HeartbeatPayload;
  [PacketKind.TIME_SYNC]: TimeSyncPayload;
  [PacketKind.CONFIG_GET]: ConfigGetPayload;
  [PacketKind.CONFIG_SET]: ConfigSetPayload;
  [PacketKind.TRACKING_STATE]: TrackingStatePayload;
  [PacketKind.GPS_FIX]: GpsFixPayload;
  [PacketKind.ALERT]: AlertPayload;
  [PacketKind.ACK]: AckPayload;
  [PacketKind.ERROR]: ErrorPayload;
};

export type ApplicationPayload =
  | HelloPayload
  | HeartbeatPayload
  | TimeSyncPayload
  | ConfigGetPayload
  | ConfigSetPayload
  | TrackingStatePayload
  | GpsFixPayload
  | AlertPayload
  | AckPayload
  | ErrorPayload;

export interface DevicePacket<TPayload = Uint8Array> {
  version: number;
  kind: PacketKind;
  flags: number;
  seq: number;
  session: number;
  timestampS: number;
  payloadLength: number;
  payload: TPayload;
  crc16: number;
}

export interface DecodedApplicationPacket<K extends PacketKind = PacketKind> {
  packet: DevicePacket<Uint8Array>;
  decodedPayload: PayloadMap[K];
}

const powerProfileSchema = z.enum(POWER_PROFILE_IDS);

const helloSchema = z.object({
  deviceName: z.string().min(1),
  firmwareVersion: z.string().min(1),
  capabilities: z.array(z.string())
});

const heartbeatSchema = z.object({
  batteryPct: z.number().min(0).max(100),
  profile: powerProfileSchema,
  trackingActive: z.boolean()
});

const timeSyncSchema = z.object({
  unixTimeS: z.number().int().nonnegative(),
  timezoneOffsetMin: z.number().int()
});

const configGetSchema = z.object({
  keys: z.array(z.string())
});

const configSetSchema = z.object({
  powerProfile: powerProfileSchema.optional(),
  trackingIntervalS: z.number().int().positive().optional(),
  bleMtu: z.number().int().min(20).max(512).optional()
});

const trackingStateSchema = z.object({
  active: z.boolean(),
  reason: z.string().min(1)
});

const gpsFixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altM: z.number(),
  sats: z.number().int().min(0),
  hdop: z.number().nonnegative(),
  unixTimeS: z.number().int().nonnegative()
});

const alertSchema = z.object({
  level: z.enum(["info", "warn", "critical"]),
  message: z.string().min(1)
});

const ackSchema = z.object({
  ackedSeq: z.number().int().nonnegative(),
  status: z.literal("ok")
});

const errorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
});

const payloadSchemas: Record<PacketKind, z.ZodTypeAny> = {
  [PacketKind.HELLO]: helloSchema,
  [PacketKind.HEARTBEAT]: heartbeatSchema,
  [PacketKind.TIME_SYNC]: timeSyncSchema,
  [PacketKind.CONFIG_GET]: configGetSchema,
  [PacketKind.CONFIG_SET]: configSetSchema,
  [PacketKind.TRACKING_STATE]: trackingStateSchema,
  [PacketKind.GPS_FIX]: gpsFixSchema,
  [PacketKind.ALERT]: alertSchema,
  [PacketKind.ACK]: ackSchema,
  [PacketKind.ERROR]: errorSchema
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function packetKindName(kind: PacketKind): string {
  return PACKET_KIND_NAMES[kind];
}

export function isKnownPacketKind(kind: number): kind is PacketKind {
  return KNOWN_PACKET_KINDS.includes(kind as PacketKind);
}

export function encodePayload<K extends PacketKind>(
  kind: K,
  payload: PayloadMap[K]
): Uint8Array {
  const schema = payloadSchemas[kind];
  const parsed = schema.parse(payload);
  return encoder.encode(JSON.stringify(parsed));
}

export function decodePayload<K extends PacketKind>(
  kind: K,
  payload: Uint8Array
): PayloadMap[K] {
  const schema = payloadSchemas[kind];
  const jsonText = decoder.decode(payload);
  const parsed = schema.parse(JSON.parse(jsonText));
  return parsed as PayloadMap[K];
}

export function createProtocolManifest() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    defaultBleMtu: DEFAULT_BLE_MTU,
    bleGattProfile: BleGattProfile,
    screens: [...SCREEN_IDS],
    homeCards: [...HOME_CARDS],
    inputEvents: [...INPUT_EVENTS],
    powerProfiles: [...POWER_PROFILE_IDS],
    packetKinds: KNOWN_PACKET_KINDS.map((kind) => ({
      id: kind,
      name: packetKindName(kind)
    }))
  };
}
