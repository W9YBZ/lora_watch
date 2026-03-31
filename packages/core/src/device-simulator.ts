import {
  type DeviceConfig,
  type GpsFix,
  type LoraFrame,
  type LoraTxResult
} from "./drivers";
import { GpsStubDriver, LoraStubDriver } from "./stubs";
import { createStartedMenuActor, snapshotMenu, type MenuInputEvent } from "./menu-machine";
import { DevicePacketCodec } from "./packet-codec";
import { PowerPolicyEngine } from "./power-policy";
import {
  DEFAULT_BLE_MTU,
  DEFAULT_SESSION_ID,
  PacketKind,
  packetKindName,
  type AlertPayload,
  type ConfigSetPayload,
  type DecodedApplicationPacket,
  type DevicePacket,
  type GpsFixPayload,
  type TimeSyncPayload,
  type PowerProfileId,
  type ScreenId,
  type TrackingStatePayload
} from "./protocol";

export interface PacketLogEntry {
  id: number;
  timestampS: number;
  direction: "ble-rx" | "ble-tx" | "gps" | "lora" | "system";
  summary: string;
  kind?: PacketKind;
}

export interface DeviceSnapshot {
  screen: ScreenId;
  selectedCard: string;
  trackingActive: boolean;
  requestedPowerProfile: PowerProfileId;
  effectivePowerProfile: PowerProfileId;
  batteryPct: number;
  powerPolicy: ReturnType<typeof PowerPolicyEngine.evaluate>;
  gps: {
    status: string;
    lastFix: GpsFix | null;
    lastError: string | null;
  };
  radio: {
    status: string;
    lastRx: LoraFrame | null;
    lastTxResult: LoraTxResult | null;
    lastError: string | null;
  };
  ble: {
    mtu: number;
    lastKind: string | null;
  };
  config: DeviceConfig;
  deviceTimeS: number;
  lastAlert: AlertPayload | null;
}

type DeviceListener = (snapshot: DeviceSnapshot, logs: PacketLogEntry[]) => void;

export class DeviceSimulator {
  private readonly gps = new GpsStubDriver();

  private readonly lora = new LoraStubDriver();

  private readonly menuActor = createStartedMenuActor();

  private readonly listeners = new Set<DeviceListener>();

  private readonly logs: PacketLogEntry[] = [];

  private nextSeq = 1;

  private nextLogId = 1;

  private snapshot: DeviceSnapshot = {
    screen: "Boot",
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
      mtu: DEFAULT_BLE_MTU,
      lastKind: null
    },
    config: {
      powerProfile: "balanced",
      trackingIntervalS: 30,
      bleMtu: DEFAULT_BLE_MTU
    },
    deviceTimeS: 0,
    lastAlert: null
  };

  constructor() {
    this.gps.on("status", (status) => {
      this.snapshot.gps.status = status;
      this.publish();
    });
    this.gps.on("fix", (fix) => {
      this.snapshot.gps.lastFix = fix;
      this.snapshot.gps.lastError = null;
      this.log("gps", `Fix ${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`);
      this.emitTelemetryPacket(PacketKind.GPS_FIX, {
        lat: fix.lat,
        lon: fix.lon,
        altM: fix.altM,
        sats: fix.sats,
        hdop: fix.hdop,
        unixTimeS: fix.unixTimeS
      });
      this.publish();
    });
    this.gps.on("error", ({ message }) => {
      this.snapshot.gps.lastError = message;
      this.log("gps", message);
      this.publish();
    });

    this.lora.on("status", (status) => {
      this.snapshot.radio.status = status;
      this.publish();
    });
    this.lora.on("rx", (frame) => {
      this.snapshot.radio.lastRx = frame;
      this.snapshot.radio.lastError = null;
      this.log("lora", `RX ${frame.payloadHex} RSSI ${frame.rssi} SNR ${frame.snr}`);
      this.publish();
    });
    this.lora.on("txDone", (result) => {
      this.snapshot.radio.lastTxResult = result;
      this.log("lora", result.message);
      this.publish();
    });
    this.lora.on("error", ({ message }) => {
      this.snapshot.radio.lastError = message;
      this.log("lora", message);
      this.publish();
    });
  }

  subscribe(listener: DeviceListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot(), this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): DeviceSnapshot {
    return structuredClone(this.snapshot);
  }

  getLogs(): PacketLogEntry[] {
    return this.logs.map((entry) => ({ ...entry }));
  }

  processBlePacket(packetBytes: Uint8Array): DecodedApplicationPacket {
    const decoded = DevicePacketCodec.decodeApplicationPacket(packetBytes);
    this.snapshot.ble.lastKind = packetKindName(decoded.packet.kind);
    this.log("ble-rx", `${packetKindName(decoded.packet.kind)} seq=${decoded.packet.seq}`, decoded.packet.kind);
    this.applyPacket(decoded);
    this.publish();
    return decoded;
  }

  processBleFragments(fragments: Uint8Array[]): DecodedApplicationPacket {
    return this.processBlePacket(DevicePacketCodec.reassemble(fragments));
  }

  dispatchInput(event: MenuInputEvent): void {
    this.menuActor.send(event);
    const menuSnapshot = snapshotMenu(this.menuActor);
    this.snapshot.screen = menuSnapshot.screen;
    this.snapshot.selectedCard = menuSnapshot.selectedCard;
    this.snapshot.trackingActive = menuSnapshot.trackingActive;
    this.log("system", `Input ${event.type}`);
    this.publish();
  }

  setBatteryPct(batteryPct: number): void {
    this.snapshot.batteryPct = batteryPct;
    this.refreshPowerDecision();
  }

  setPowerProfile(profile: PowerProfileId): void {
    this.snapshot.config.powerProfile = profile;
    this.snapshot.requestedPowerProfile = profile;
    this.refreshPowerDecision();
    this.log("system", `Power profile => ${profile}`);
  }

  injectGpsFix(fix: GpsFix): void {
    this.gps.injectFix(fix);
  }

  injectGpsLoss(message = "GPS signal lost"): void {
    this.gps.injectLoss(message);
  }

  injectLoraRx(frame: LoraFrame): void {
    this.lora.injectRx(frame);
  }

  injectLoraTxResult(ok: boolean, message: string): void {
    if (!ok) {
      this.lora.failNextSend(message);
    }
    this.lora.send(new Uint8Array([0xaa]));
  }

  createOutboundCommand(command: Record<string, unknown>): string {
    return JSON.stringify(command);
  }

  private applyPacket(decoded: DecodedApplicationPacket): void {
    switch (decoded.packet.kind) {
      case PacketKind.TIME_SYNC: {
        const payload = decoded.decodedPayload as TimeSyncPayload;
        this.snapshot.deviceTimeS = payload.unixTimeS;
        this.emitAck(decoded.packet);
        break;
      }
      case PacketKind.CONFIG_SET:
        this.applyConfig(decoded.decodedPayload as ConfigSetPayload);
        this.emitAck(decoded.packet);
        break;
      case PacketKind.ALERT:
        this.snapshot.lastAlert = decoded.decodedPayload as AlertPayload;
        this.emitAck(decoded.packet);
        break;
      case PacketKind.TRACKING_STATE: {
        const payload = decoded.decodedPayload as TrackingStatePayload;
        this.snapshot.trackingActive = payload.active;
        this.log("system", `Tracking => ${payload.active ? "on" : "off"} (${payload.reason})`);
        this.emitAck(decoded.packet);
        break;
      }
      case PacketKind.CONFIG_GET:
        this.emitAck(decoded.packet);
        break;
      case PacketKind.HELLO:
      case PacketKind.HEARTBEAT:
      case PacketKind.GPS_FIX:
      case PacketKind.ACK:
      case PacketKind.ERROR:
        break;
    }
  }

  private applyConfig(payload: ConfigSetPayload): void {
    if (payload.powerProfile) {
      this.snapshot.config.powerProfile = payload.powerProfile;
      this.snapshot.requestedPowerProfile = payload.powerProfile;
    }
    if (payload.trackingIntervalS) {
      this.snapshot.config.trackingIntervalS = payload.trackingIntervalS;
    }
    if (payload.bleMtu) {
      this.snapshot.config.bleMtu = payload.bleMtu;
      this.snapshot.ble.mtu = payload.bleMtu;
    }
    this.refreshPowerDecision();
  }

  private emitTelemetryPacket(kind: PacketKind.GPS_FIX, payload: GpsFixPayload): void {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind,
      seq: this.nextSeq,
      session: DEFAULT_SESSION_ID,
      timestampS: payload.unixTimeS,
      payload
    });
    const packet = DevicePacketCodec.decodeApplicationPacket(bytes);
    this.log("ble-tx", `${packetKindName(kind)} seq=${packet.packet.seq}`, kind);
    this.nextSeq += 1;
  }

  private emitAck(packet: DevicePacket<Uint8Array>): void {
    const bytes = DevicePacketCodec.encodeApplicationPacket({
      kind: PacketKind.ACK,
      seq: this.nextSeq,
      session: packet.session,
      timestampS: packet.timestampS,
      payload: {
        ackedSeq: packet.seq,
        status: "ok"
      }
    });
    const ack = DevicePacketCodec.decodeApplicationPacket(bytes);
    this.log("ble-tx", `${packetKindName(PacketKind.ACK)} ack=${packet.seq}`, PacketKind.ACK);
    this.nextSeq = ack.packet.seq + 1;
  }

  private refreshPowerDecision(): void {
    this.snapshot.powerPolicy = PowerPolicyEngine.evaluate(
      this.snapshot.requestedPowerProfile,
      this.snapshot.batteryPct
    );
    this.snapshot.effectivePowerProfile = this.snapshot.powerPolicy.effectiveProfile;
    this.publish();
  }

  private log(direction: PacketLogEntry["direction"], summary: string, kind?: PacketKind): void {
    this.logs.unshift({
      id: this.nextLogId,
      timestampS: this.snapshot.deviceTimeS,
      direction,
      summary,
      kind
    });
    this.logs.splice(40);
    this.nextLogId += 1;
  }

  private publish(): void {
    const menuSnapshot = snapshotMenu(this.menuActor);
    this.snapshot.screen = menuSnapshot.screen;
    this.snapshot.selectedCard = menuSnapshot.selectedCard;
    const frozenSnapshot = this.getSnapshot();
    const frozenLogs = this.getLogs();
    for (const listener of this.listeners) {
      listener(frozenSnapshot, frozenLogs);
    }
  }
}
