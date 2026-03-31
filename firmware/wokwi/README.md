# Wokwi shell

This directory contains a first-phase Arduino/Wokwi shell for the wearable simulator.

## Hardware model

- `ESP32-S3-DevKitC-1`
- virtual `200x200` serial e-ink style display
- `4` buttons: `M`, `EXIT`, `UP`, `DOWN`

## Notes

- Wokwi does not directly simulate the exact target `200x200` serial panel, so this phase uses a serial-driven virtual display.
- The watch UI is rendered as structured `200x200` frame text in the Serial Monitor.
- The watch shell is button-only in this phase, and the serial bridge mirrors the same `M / EXIT / UP / DOWN` events.

## Serial bridge commands

Paste newline-delimited JSON commands into the Wokwi serial monitor:

```json
{"type":"ble.rx","kindId":3,"kindName":"TIME_SYNC","unixTimeS":1711900000,"timezoneOffsetMin":0}
{"type":"gps.fix","lat":51.5072,"lon":-0.1276,"altM":18,"sats":9,"hdop":1.1,"unixTimeS":1711900050}
{"type":"gps.loss","message":"GPS timeout"}
{"type":"lora.rx","payloadHex":"A10BEE","rssi":-112,"snr":7.5}
{"type":"lora.tx_result","ok":false,"message":"uplink timeout"}
{"type":"power.set","profile":"saver"}
{"type":"input.inject","event":"down","longPress":false}
{"type":"input.inject","event":"m","longPress":false}
{"type":"input.inject","event":"exit","longPress":false}
{"type":"input.inject","event":"m","longPress":true}
```

The browser console app produces the same command format in its `Packet log + Wokwi bridge` panel.
