export function crc16Ccitt(data: Uint8Array): number {
  let crc = 0xffff;

  for (const byte of data) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc & 0xffff;
}
