import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";
import { buildDisplayFrame, type GpsFix, type InputEventType, type PowerProfileId } from "@lora-watch/core";
import { ConsoleModel, type ConsoleViewState } from "./console-model";
import "./styles.css";

const initialGpsFix: GpsFix = {
  lat: 51.5072,
  lon: -0.1276,
  altM: 18,
  sats: 9,
  hdop: 1.1,
  unixTimeS: 1711900000
};

export function App() {
  const modelRef = useRef<ConsoleModel | null>(null);
  if (!modelRef.current) {
    modelRef.current = new ConsoleModel();
  }

  const model = modelRef.current;
  const [view, setView] = useState<ConsoleViewState>(() => model.getViewState());
  const [selectedKind, setSelectedKind] = useState(() => model.packetKindNames()[2] ?? "TIME_SYNC");
  const [payloadText, setPayloadText] = useState(() => model.defaultPayloadForKind(selectedKind));
  const [gpsFix, setGpsFix] = useState<GpsFix>(initialGpsFix);
  const [gpsLossMessage, setGpsLossMessage] = useState("GPS timeout");
  const [loraPayloadHex, setLoraPayloadHex] = useState("A10BEE");
  const [loraRssi, setLoraRssi] = useState("-112");
  const [loraSnr, setLoraSnr] = useState("7.5");
  const [txOk, setTxOk] = useState(true);
  const [txMessage, setTxMessage] = useState("uplink ok");
  const [selectedProfile, setSelectedProfile] = useState<PowerProfileId>(view.snapshot.requestedPowerProfile);
  const [selectedInputEvent, setSelectedInputEvent] = useState<InputEventType>("wake");
  const [longPress, setLongPress] = useState(false);
  const displayFrame = buildDisplayFrame(view.snapshot);

  useEffect(() => {
    return model.subscribe((next) => {
      startTransition(() => {
        setView(next);
        setSelectedProfile(next.snapshot.requestedPowerProfile);
      });
    });
  }, [model]);

  function onBleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.sendBle(selectedKind, payloadText);
  }

  function onGpsFixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.injectGpsFix({
      ...gpsFix,
      lat: Number(gpsFix.lat),
      lon: Number(gpsFix.lon),
      altM: Number(gpsFix.altM),
      sats: Number(gpsFix.sats),
      hdop: Number(gpsFix.hdop),
      unixTimeS: Number(gpsFix.unixTimeS)
    });
  }

  function onGpsLossSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.injectGpsLoss(gpsLossMessage);
  }

  function onLoraRxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.injectLoraRx(loraPayloadHex, Number(loraRssi), Number(loraSnr));
  }

  function onLoraTxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.injectLoraTxResult(txOk, txMessage);
  }

  function onProfileChange(profile: PowerProfileId) {
    setSelectedProfile(profile);
    model.setPowerProfile(profile);
  }

  function onInputInject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    model.injectInput(selectedInputEvent, longPress);
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Phase 1 Simulator</p>
          <h1>lora_watch control deck</h1>
          <p className="subtle">
            UI logic, BLE packets, menu state, power policy, and Wokwi bridge commands all ride on the
            same shared core.
          </p>
        </div>
        <div className="heroCards">
          <article>
            <span>Screen</span>
            <strong>{view.snapshot.screen}</strong>
          </article>
          <article>
            <span>Tracking</span>
            <strong>{view.snapshot.trackingActive ? "active" : "idle"}</strong>
          </article>
          <article>
            <span>Power</span>
            <strong>{view.snapshot.effectivePowerProfile}</strong>
          </article>
        </div>
      </header>

      <section className="toolbar">
        <label>
          Power Profile
          <select
            value={selectedProfile}
            onChange={(event) => onProfileChange(event.target.value as PowerProfileId)}
          >
            {model.powerProfiles().map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        </label>
        <form className="toolbarForm" onSubmit={onInputInject}>
          <label>
            Input Event
            <select
              value={selectedInputEvent}
              onChange={(event) => setSelectedInputEvent(event.target.value as InputEventType)}
            >
              {model.inputEvents().map((inputEvent) => (
                <option key={inputEvent} value={inputEvent}>
                  {inputEvent}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={longPress}
              onChange={(event) => setLongPress(event.target.checked)}
            />
            long press
          </label>
          <button type="submit">Inject input</button>
        </form>
      </section>

      <main className="grid">
        <section className="panel">
          <div className="panelHeader">
            <h2>Screen simulator</h2>
            <span>
              {displayFrame.width}x{displayFrame.height} serial e-ink
            </span>
          </div>
          <div className="screenPreview">
            <div className="screenShell">
              <div className="screenFrame">
                {displayFrame.lines.map((entry, index) => (
                  <div
                    key={`${entry.y}-${index}`}
                    className={`screenLine screenLine--${entry.tone}`}
                    style={{ top: `${(entry.y / displayFrame.height) * 100}%` }}
                  >
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="screenLegend">
              <strong>{view.snapshot.screen}</strong>
              <span>selected card: {view.snapshot.selectedCard}</span>
              <span>tracking: {view.snapshot.trackingActive ? "active" : "idle"}</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>BLE RX composer</h2>
            <span>{view.snapshot.ble.mtu} byte MTU</span>
          </div>
          <form onSubmit={onBleSubmit}>
            <label>
              Packet kind
              <select
                value={selectedKind}
                onChange={(event) => {
                  const nextKind = event.target.value;
                  setSelectedKind(nextKind);
                  setPayloadText(model.defaultPayloadForKind(nextKind));
                }}
              >
                {model.packetKindNames().map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payload JSON
              <textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={14} />
            </label>
            <button type="submit">Send BLE packet</button>
          </form>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>GPS injection</h2>
            <span>{view.snapshot.gps.status}</span>
          </div>
          <form className="stack" onSubmit={onGpsFixSubmit}>
            <div className="twoCol">
              <label>
                Lat
                <input
                  value={gpsFix.lat}
                  onChange={(event) => setGpsFix({ ...gpsFix, lat: Number(event.target.value) })}
                />
              </label>
              <label>
                Lon
                <input
                  value={gpsFix.lon}
                  onChange={(event) => setGpsFix({ ...gpsFix, lon: Number(event.target.value) })}
                />
              </label>
              <label>
                Alt M
                <input
                  value={gpsFix.altM}
                  onChange={(event) => setGpsFix({ ...gpsFix, altM: Number(event.target.value) })}
                />
              </label>
              <label>
                Sats
                <input
                  value={gpsFix.sats}
                  onChange={(event) => setGpsFix({ ...gpsFix, sats: Number(event.target.value) })}
                />
              </label>
              <label>
                HDOP
                <input
                  value={gpsFix.hdop}
                  onChange={(event) => setGpsFix({ ...gpsFix, hdop: Number(event.target.value) })}
                />
              </label>
              <label>
                Unix Time
                <input
                  value={gpsFix.unixTimeS}
                  onChange={(event) => setGpsFix({ ...gpsFix, unixTimeS: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit">Inject GPS fix</button>
            </div>
          </form>
          <form className="stack inlineForm" onSubmit={onGpsLossSubmit}>
            <label>
              Loss message
              <input value={gpsLossMessage} onChange={(event) => setGpsLossMessage(event.target.value)} />
            </label>
            <button type="submit">Inject GPS loss</button>
          </form>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>LoRa injection</h2>
            <span>{view.snapshot.radio.status}</span>
          </div>
          <form className="stack inlineForm" onSubmit={onLoraRxSubmit}>
            <label>
              Payload Hex
              <input value={loraPayloadHex} onChange={(event) => setLoraPayloadHex(event.target.value)} />
            </label>
            <label>
              RSSI
              <input value={loraRssi} onChange={(event) => setLoraRssi(event.target.value)} />
            </label>
            <label>
              SNR
              <input value={loraSnr} onChange={(event) => setLoraSnr(event.target.value)} />
            </label>
            <button type="submit">Inject LoRa RX</button>
          </form>
          <form className="stack inlineForm" onSubmit={onLoraTxSubmit}>
            <label className="checkbox">
              <input type="checkbox" checked={txOk} onChange={(event) => setTxOk(event.target.checked)} />
              tx ok
            </label>
            <label>
              Result message
              <input value={txMessage} onChange={(event) => setTxMessage(event.target.value)} />
            </label>
            <button type="submit">Inject LoRa TX result</button>
          </form>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>State snapshot</h2>
            <span>Protocol v{view.manifest.protocolVersion}</span>
          </div>
          <pre>{JSON.stringify(view.snapshot, null, 2)}</pre>
        </section>

        <section className="panel wide">
          <div className="panelHeader">
            <h2>Packet log + Wokwi bridge</h2>
            <span>{view.logs.length} recent entries</span>
          </div>
          <div className="logGrid">
            <div>
              <h3>Packet log</h3>
              <ul className="logList">
                {view.logs.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.direction}</strong>
                    <span>{entry.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Paste into Wokwi serial</h3>
              <textarea readOnly rows={18} value={view.bridgeCommands.join("\n")} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
