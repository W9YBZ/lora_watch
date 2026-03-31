# lora_watch

Phase 1 software simulation workspace for an `ESP32-S3 + SX1262 + LC76G` wearable.

## What is included

- `packages/core`: protocol definitions, packet codecs, menu state machine, power policy engine, driver abstractions, and software stubs
- `apps/console`: React/Vite simulator console for BLE, GPS, LoRa, and UI state validation
- `firmware/wokwi`: Arduino/Wokwi shell for an `ESP32-S3` prototype using a virtual `200x200` serial e-ink style display

## Quick start

```bash
npm install
npm run gen:protocol
npm test
npm run dev:console
```

## Root scripts

- `npm run build`
- `npm test`
- `npm run dev:console`
- `npm run gen:protocol`
- `npm run check`
