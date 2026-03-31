# lora_watch

`lora_watch` is a phase-1 software simulation workspace for a wearable device built around:

- `ESP32-S3`
- `SX1262`
- `LC76G`
- Bluetooth Low Energy
- GPS
- LoRa
- buttons and a simple screen UI

This repository focuses on validating product logic before hardware bring-up. The current milestone is a software-first prototype that lets us iterate on UI flow, packet formats, power policy, and device abstractions without depending on real radio or GNSS silicon.

## Current scope

Phase 1 covers:

- UI logic and menu flow
- BLE application protocol and GATT profile shape
- button and menu state machine
- device packet format and codec
- power policy framework
- GPS and LoRa driver abstractions
- browser-based simulator console
- Wokwi-oriented firmware shell

Phase 1 intentionally does not include:

- real `SX1262` driver integration
- real `LC76G` driver integration
- OTA
- persistent storage
- production-grade mobile app integration
- production RF or GNSS validation

## Architecture

The repository is organized as a small `npm workspaces` monorepo:

```text
lora_watch/
├─ packages/core
├─ apps/console
└─ firmware/wokwi
```

### `packages/core`

Shared source of truth for:

- protocol constants and generated artifacts
- BLE UUIDs and packet kind IDs
- packet encode/decode logic
- menu state machine
- power policy engine
- GPS and LoRa driver abstractions
- software stub backends
- shared screen frame renderer for the simulated 200x200 display

### `apps/console`

React/Vite web simulator used to:

- compose BLE packets
- inject GPS and LoRa events
- inspect state snapshots
- preview the simulated 200x200 screen
- generate newline-delimited bridge commands for Wokwi serial input

### `firmware/wokwi`

Arduino/Wokwi shell for the embedded-facing prototype:

- `ESP32-S3` oriented
- button-driven navigation
- serial bridge command input
- virtual `200x200` serial e-ink style screen output

## Quick start

### Requirements

- `Node.js 20+`
- `npm`

### Install and run

```bash
npm install
npm run gen:protocol
npm test
npm run dev:console
```

The console app is served by Vite on:

- `http://localhost:5174/`

## Common commands

```bash
npm run build
npm test
npm run dev:console
npm run gen:protocol
npm run check
```

## Generated artifacts

The shared protocol contract is generated into:

- [`packages/core/generated/protocol-manifest.json`](/home/yuhui/software_ws/lora_watch/packages/core/generated/protocol-manifest.json)
- [`firmware/wokwi/generated/protocol_ids.h`](/home/yuhui/software_ws/lora_watch/firmware/wokwi/generated/protocol_ids.h)

Regenerate them with:

```bash
npm run gen:protocol
```

## What works today

- BLE packet composition and validation in the web console
- packet fragmentation/reassembly for simulated BLE MTU handling
- menu navigation with four-button input (`M / EXIT / UP / DOWN`)
- GPS fix and loss simulation
- LoRa RX and TX result simulation
- power profile switching and low-battery fallback policy
- Wokwi bridge command generation
- shared 200x200 screen preview in the browser

## Validation

The repository currently validates with:

- unit tests in `packages/core`
- console model tests in `apps/console`
- TypeScript no-emit checks
- generated artifact consistency checks

Run the full validation chain with:

```bash
npm run check
```

## Wokwi notes

The Wokwi shell is a first-stage integration target, not a production firmware baseline.

Because Wokwi does not directly provide the exact target `200x200` serial screen module, the current shell models the display as a serial-rendered virtual panel. That keeps the UI flow and command bridge stable while leaving room to swap in a real display transport later.

See:

- [`firmware/wokwi/README.md`](/home/yuhui/software_ws/lora_watch/firmware/wokwi/README.md)

## Roadmap

Near-term next steps likely include:

- defining a real serial display protocol
- refining the 200x200 wearable UI layout
- adding persistence and settings storage
- introducing real driver implementations behind the current interfaces
- preparing phone-side integration for BLE sync flows

## Versioning

This repository now has an initial `v0.1.0` milestone for the first complete software simulation baseline.
