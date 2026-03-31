import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  BleGattProfile,
  createProtocolManifest,
  PACKET_KIND_NAMES,
  PROTOCOL_VERSION,
  type PacketKind
} from "../src/index.js";

const rootDir = path.resolve(import.meta.dirname, "../../..");
const manifestPath = path.join(rootDir, "packages/core/generated/protocol-manifest.json");
const headerPath = path.join(rootDir, "firmware/wokwi/generated/protocol_ids.h");

function createHeader(): string {
  const lines = [
    "#ifndef LORA_WATCH_PROTOCOL_IDS_H",
    "#define LORA_WATCH_PROTOCOL_IDS_H",
    "",
    `#define LW_PROTOCOL_VERSION ${PROTOCOL_VERSION}`,
    `#define LW_BLE_SERVICE_UUID "${BleGattProfile.service}"`,
    `#define LW_BLE_RX_UUID "${BleGattProfile.rx}"`,
    `#define LW_BLE_TX_UUID "${BleGattProfile.tx}"`,
    `#define LW_BLE_STATE_UUID "${BleGattProfile.state}"`,
    ""
  ];

  for (const [rawKind, name] of Object.entries(PACKET_KIND_NAMES)) {
    const kind = Number(rawKind) as PacketKind;
    lines.push(`#define LW_KIND_${name} 0x${kind.toString(16).padStart(2, "0").toUpperCase()}`);
  }

  lines.push("", "#endif");
  return `${lines.join("\n")}\n`;
}

async function writeIfChanged(filePath: string, nextContents: string, checkOnly: boolean): Promise<boolean> {
  let previous = "";
  try {
    previous = await readFile(filePath, "utf8");
  } catch {
    previous = "";
  }

  if (previous === nextContents) {
    return false;
  }

  if (checkOnly) {
    throw new Error(`Generated artifact is out of date: ${path.relative(rootDir, filePath)}`);
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, nextContents, "utf8");
  return true;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const manifestContents = `${JSON.stringify(createProtocolManifest(), null, 2)}\n`;
  const headerContents = createHeader();

  const manifestChanged = await writeIfChanged(manifestPath, manifestContents, checkOnly);
  const headerChanged = await writeIfChanged(headerPath, headerContents, checkOnly);

  if (!checkOnly) {
    console.log(
      JSON.stringify(
        {
          manifestPath: path.relative(rootDir, manifestPath),
          headerPath: path.relative(rootDir, headerPath),
          updated: manifestChanged || headerChanged
        },
        null,
        2
      )
    );
  }
}

await main();
