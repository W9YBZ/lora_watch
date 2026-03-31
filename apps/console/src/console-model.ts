import protocolManifest from "../../../packages/core/generated/protocol-manifest.json";
import {
  DEFAULT_SESSION_ID,
  DevicePacketCodec,
  DeviceSimulator,
  type DeviceSnapshot,
  type GpsFix,
  type InputEventType,
  type PacketKind,
  type PacketLogEntry,
  type PowerProfileId
} from "@lora-watch/core";

export interface ConsoleViewState {
  manifest: typeof protocolManifest;
  snapshot: DeviceSnapshot;
  logs: PacketLogEntry[];
  bridgeCommands: string[];
}

type ConsoleListener = (viewState: ConsoleViewState) => void;

export class ConsoleModel {
  private readonly simulator = new DeviceSimulator();

  private readonly listeners = new Set<ConsoleListener>();

  private viewState: ConsoleViewState;

  private nextSeq = 1;

  constructor() {
    this.viewState = {
      manifest: protocolManifest,
      snapshot: this.simulator.getSnapshot(),
      logs: this.simulator.getLogs(),
      bridgeCommands: []
    };

    this.simulator.subscribe((snapshot, logs) => {
      this.viewState = {
        ...this.viewState,
        snapshot,
        logs
      };
      this.publish();
    });
  }

  subscribe(listener: ConsoleListener): () => void {
    this.listeners.add(listener);
    listener(this.getViewState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getViewState(): ConsoleViewState {
    return {
      manifest: this.viewState.manifest,
      snapshot: structuredClone(this.viewState.snapshot),
      logs: this.viewState.logs.map((entry) => ({ ...entry })),
      bridgeCommands: [...this.viewState.bridgeCommands]
    };
  }

  packetKindNames(): string[] {
    return this.viewState.manifest.packetKinds.map((entry) => entry.name);
  }

  powerProfiles(): PowerProfileId[] {
    return [...this.viewState.manifest.powerProfiles] as PowerProfileId[];
  }

  inputEvents(): InputEventType[] {
    return [...this.viewState.manifest.inputEvents] as InputEventType[];
  }

  defaultPayloadForKind(kindName: string): string {
    switch (kindName) {
      case "TIME_SYNC":
        return JSON.stringify({ unixTimeS: 1711900000, timezoneOffsetMin: 0 }, null, 2);
      case "CONFIG_SET":
        return JSON.stringify({ powerProfile: "balanced", trackingIntervalS: 30, bleMtu: 180 }, null, 2);
      case "ALERT":
        return JSON.stringify({ level: "warn", message: "LoRa uplink delayed" }, null, 2);
      case "TRACKING_STATE":
        return JSON.stringify({ active: true, reason: "console-test" }, null, 2);
      case "CONFIG_GET":
        return JSON.stringify({ keys: ["powerProfile", "trackingIntervalS", "bleMtu"] }, null, 2);
      case "HELLO":
        return JSON.stringify(
          {
            deviceName: "lora_watch",
            firmwareVersion: "0.1.0",
            capabilities: ["gps", "ble", "lora", "serial-display-200x200", "buttons"]
          },
          null,
          2
        );
      case "HEARTBEAT":
        return JSON.stringify({ batteryPct: 78, profile: "balanced", trackingActive: false }, null, 2);
      default:
        return JSON.stringify({}, null, 2);
    }
  }

  sendBle(kindName: string, payloadText: string): void {
    const entry = this.viewState.manifest.packetKinds.find((candidate) => candidate.name === kindName);
    if (!entry) {
      throw new Error(`Unsupported packet kind: ${kindName}`);
    }

    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    const packet = DevicePacketCodec.encodeApplicationPacket({
      kind: entry.id as PacketKind,
      seq: this.nextSeq,
      session: DEFAULT_SESSION_ID,
      timestampS: Number(payload.unixTimeS ?? this.viewState.snapshot.deviceTimeS ?? Math.floor(Date.now() / 1000)),
      payload: payload as never
    });
    const fragments = DevicePacketCodec.fragment(packet, this.viewState.snapshot.ble.mtu);

    this.simulator.processBleFragments(fragments);
    this.pushBridgeCommand({
      type: "ble.rx",
      kindId: entry.id,
      kindName,
      ...payload
    });
    this.nextSeq += 1;
  }

  injectGpsFix(fix: GpsFix): void {
    this.simulator.injectGpsFix(fix);
    this.pushBridgeCommand({
      type: "gps.fix",
      ...fix
    });
  }

  injectGpsLoss(message: string): void {
    this.simulator.injectGpsLoss(message);
    this.pushBridgeCommand({
      type: "gps.loss",
      message
    });
  }

  injectLoraRx(payloadHex: string, rssi: number, snr: number): void {
    this.simulator.injectLoraRx({ payloadHex, rssi, snr });
    this.pushBridgeCommand({
      type: "lora.rx",
      payloadHex,
      rssi,
      snr
    });
  }

  injectLoraTxResult(ok: boolean, message: string): void {
    this.simulator.injectLoraTxResult(ok, message);
    this.pushBridgeCommand({
      type: "lora.tx_result",
      ok,
      message
    });
  }

  setPowerProfile(profile: PowerProfileId): void {
    this.simulator.setPowerProfile(profile);
    this.pushBridgeCommand({
      type: "power.set",
      profile
    });
  }

  injectInput(eventType: InputEventType, longPress = false): void {
    const event =
      eventType === "confirm"
        ? { type: "confirm" as const, longPress }
        : ({ type: eventType } as const);

    this.simulator.dispatchInput(event);
    this.pushBridgeCommand({
      type: "input.inject",
      event: eventType,
      longPress
    });
  }

  private pushBridgeCommand(command: Record<string, unknown>): void {
    this.viewState = {
      ...this.viewState,
      bridgeCommands: [JSON.stringify(command), ...this.viewState.bridgeCommands].slice(0, 40)
    };
    this.publish();
  }

  private publish(): void {
    const snapshot = this.getViewState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
