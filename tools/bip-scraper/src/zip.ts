// Minimalny czytnik ZIP: wystarczy do rozpakowania spisu podmiotow
// (jeden plik XML, kompresja deflate). Swiadomie bez zaleznosci npm.
//
// Obslugiwane: metoda 0 (store) i 8 (deflate), bez szyfrowania i ZIP64.

import zlib from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Zawartosc archiwum jako mapa nazwa -> bajty. */
export function unzip(buf: Buffer): Map<string, Buffer> {
  // EOCD jest na koncu pliku; komentarz moze go przesunac, wiec skanujemy wstecz.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP: brak End of Central Directory");

  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  const files = new Map<string, Buffer>();
  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIG) {
      throw new Error("ZIP: uszkodzony wpis central directory");
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");

    if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) {
      throw new Error(`ZIP: uszkodzony local header dla ${name}`);
    }
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    if (method === 8) files.set(name, zlib.inflateRawSync(raw));
    else if (method === 0) files.set(name, Buffer.from(raw));
    else throw new Error(`ZIP: nieobslugiwana metoda kompresji ${method} (${name})`);

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
