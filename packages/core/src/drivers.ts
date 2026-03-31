import type { PowerProfileId } from "./protocol";

export interface GpsFix {
  lat: number;
  lon: number;
  altM: number;
  sats: number;
  hdop: number;
  unixTimeS: number;
}

export type GpsStatus = "idle" | "searching" | "fixed" | "lost" | "sleeping";

export interface GpsDriverEvents {
  fix: GpsFix;
  error: { message: string };
  status: GpsStatus;
}

export interface LoraFrame {
  payloadHex: string;
  rssi: number;
  snr: number;
}

export interface LoraTxResult {
  ok: boolean;
  message: string;
}

export type LoraStatus = "idle" | "listening" | "tx-pending" | "sleeping";

export interface LoraConfig {
  region: string;
  spreadingFactor: number;
  bandwidthKhz: number;
  codingRate: string;
}

export interface LoraDriverEvents {
  rx: LoraFrame;
  txDone: LoraTxResult;
  error: { message: string };
  status: LoraStatus;
}

export interface SubscribeLike<TEvents> {
  on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): () => void;
}

export interface IGpsDriver extends SubscribeLike<GpsDriverEvents> {
  start(): void;
  stop(): void;
  sleep(): void;
  wake(): void;
  getLastFix(): GpsFix | null;
}

export interface ILoraDriver extends SubscribeLike<LoraDriverEvents> {
  configure(config: LoraConfig): void;
  send(payload: Uint8Array): void;
  sleep(): void;
  wake(): void;
}

type Listener<TPayload> = (payload: TPayload) => void;

export class TypedEventBus<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    const current = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    current.add(listener as Listener<unknown>);
    this.listeners.set(event, current);

    return () => {
      current.delete(listener as Listener<unknown>);
      if (current.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      (listener as Listener<TEvents[K]>)(payload);
    }
  }
}

export interface DeviceConfig {
  powerProfile: PowerProfileId;
  trackingIntervalS: number;
  bleMtu: number;
}
