import {
  type GpsDriverEvents,
  type GpsFix,
  type GpsStatus,
  type IGpsDriver,
  type ILoraDriver,
  type LoraConfig,
  type LoraDriverEvents,
  type LoraFrame,
  type LoraStatus,
  type LoraTxResult,
  TypedEventBus
} from "./drivers";

export class GpsStubDriver implements IGpsDriver {
  private readonly bus = new TypedEventBus<GpsDriverEvents>();

  private lastFix: GpsFix | null = null;

  private status: GpsStatus = "idle";

  start(): void {
    this.setStatus("searching");
  }

  stop(): void {
    this.setStatus("idle");
  }

  sleep(): void {
    this.setStatus("sleeping");
  }

  wake(): void {
    this.setStatus(this.lastFix ? "fixed" : "searching");
  }

  getLastFix(): GpsFix | null {
    return this.lastFix;
  }

  injectFix(fix: GpsFix): void {
    this.lastFix = fix;
    this.setStatus("fixed");
    this.bus.emit("fix", fix);
  }

  injectLoss(message: string): void {
    this.setStatus("lost");
    this.bus.emit("error", { message });
  }

  injectError(message: string): void {
    this.bus.emit("error", { message });
  }

  on<K extends keyof GpsDriverEvents>(
    event: K,
    listener: (payload: GpsDriverEvents[K]) => void
  ): () => void {
    return this.bus.on(event, listener);
  }

  private setStatus(status: GpsStatus): void {
    this.status = status;
    this.bus.emit("status", status);
  }
}

export class LoraStubDriver implements ILoraDriver {
  private readonly bus = new TypedEventBus<LoraDriverEvents>();

  private status: LoraStatus = "idle";

  private config: LoraConfig = {
    region: "EU868",
    spreadingFactor: 7,
    bandwidthKhz: 125,
    codingRate: "4/5"
  };

  private nextSendFailure: string | null = null;

  configure(config: LoraConfig): void {
    this.config = config;
    this.setStatus("listening");
  }

  send(_payload: Uint8Array): void {
    if (this.status === "sleeping") {
      this.bus.emit("error", { message: "LoRa radio is sleeping" });
      return;
    }

    this.setStatus("tx-pending");
    if (this.nextSendFailure) {
      const result: LoraTxResult = {
        ok: false,
        message: this.nextSendFailure
      };
      this.nextSendFailure = null;
      this.bus.emit("txDone", result);
      this.setStatus("listening");
      return;
    }

    const result: LoraTxResult = {
      ok: true,
      message: `sent @ ${this.config.region} SF${this.config.spreadingFactor}`
    };
    this.bus.emit("txDone", result);
    this.setStatus("listening");
  }

  sleep(): void {
    this.setStatus("sleeping");
  }

  wake(): void {
    this.setStatus("listening");
  }

  injectRx(frame: LoraFrame): void {
    this.bus.emit("rx", frame);
  }

  failNextSend(message: string): void {
    this.nextSendFailure = message;
  }

  injectError(message: string): void {
    this.bus.emit("error", { message });
  }

  on<K extends keyof LoraDriverEvents>(
    event: K,
    listener: (payload: LoraDriverEvents[K]) => void
  ): () => void {
    return this.bus.on(event, listener);
  }

  private setStatus(status: LoraStatus): void {
    this.status = status;
    this.bus.emit("status", status);
  }
}
