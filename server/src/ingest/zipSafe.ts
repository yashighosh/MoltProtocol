import { createRequire } from "node:module";
import { crc32 } from "node:zlib";

const require = createRequire(import.meta.url);

type ZipEntry = {
  entryName: string;
  isDirectory: boolean;
  header: { size: number; compressedSize: number };
  getData: () => Buffer;
};

type ZipArchive = {
  getEntries: () => ZipEntry[];
};

type ZipCtor = {
  new (buffer?: Buffer): ZipArchive & { addFile: (name: string, data: Buffer) => void; toBuffer: () => Buffer };
};

const AdmZip = require("adm-zip") as ZipCtor;

export const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 400;
export const MAX_COMPRESSION_RATIO = 80;
export const MAX_SINGLE_FILE_BYTES = 1_000_000;

export type ZipLimits = {
  maxUncompressedBytes?: number;
  maxFiles?: number;
  maxCompressionRatio?: number;
  maxSingleFileBytes?: number;
};

export type ZipEntryMeta = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

export function isUnsafeZipPath(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return true;
  return normalized.split("/").some((part) => part === "..");
}

export function assessEntries(entries: ZipEntryMeta[], limits: ZipLimits = {}): { ok: true } | { ok: false; reason: string } {
  const maxUncompressed = limits.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES;
  const maxFiles = limits.maxFiles ?? MAX_FILES;
  const maxRatio = limits.maxCompressionRatio ?? MAX_COMPRESSION_RATIO;
  const maxSingle = limits.maxSingleFileBytes ?? MAX_SINGLE_FILE_BYTES;
  const files = entries.filter((entry) => !entry.name.endsWith("/"));

  if (files.length > maxFiles) {
    return { ok: false, reason: `Archive rejected: more than ${maxFiles} files.` };
  }

  let uncompressed = 0;
  let compressed = 0;
  for (const entry of files) {
    if (isUnsafeZipPath(entry.name)) {
      return { ok: false, reason: `Archive rejected: path traversal entry "${entry.name}".` };
    }
    if (entry.uncompressedSize > maxSingle) {
      return { ok: false, reason: `Archive rejected: "${entry.name}" exceeds the per-file size limit.` };
    }
    uncompressed += entry.uncompressedSize;
    compressed += Math.max(entry.compressedSize, 1);
    if (uncompressed > maxUncompressed) {
      return { ok: false, reason: "Archive rejected: uncompressed size exceeds the 20 MB budget." };
    }
  }

  if (files.length > 0 && uncompressed / compressed > maxRatio) {
    return { ok: false, reason: "Archive rejected: compression ratio looks like a zip bomb." };
  }

  return { ok: true };
}

export function rawZipEntryNames(buffer: Buffer): string[] | { error: string } {
  let end = -1;
  const lower = Math.max(0, buffer.length - 22 - 65535);
  for (let index = buffer.length - 22; index >= lower; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) return { error: "Archive is corrupted and could not be opened." };
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      return { error: "Archive is corrupted and could not be opened." };
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const start = offset + 46;
    names.push(buffer.subarray(start, start + nameLength).toString("utf8"));
    offset = start + nameLength + extraLength + commentLength;
  }
  return names;
}

/** Builds a stored zip without rewriting entry names. Tests use this for traversal payloads. */
export function storedZip(entries: { name: string; data: string | Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const name = Buffer.from(entry.name);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localRecord = Buffer.concat([local, name, data]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(localRecord);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }
  const directory = Buffer.concat(centrals);
  const trailer = Buffer.alloc(22);
  trailer.writeUInt32LE(0x06054b50, 0);
  trailer.writeUInt16LE(entries.length, 8);
  trailer.writeUInt16LE(entries.length, 10);
  trailer.writeUInt32LE(directory.length, 12);
  trailer.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, trailer]);
}

export function readZip(buffer: Buffer, limits?: ZipLimits): { files: { path: string; bytes: Buffer }[] } | { error: string } {
  const declared = rawZipEntryNames(buffer);
  if ("error" in declared) return declared;
  for (const name of declared) {
    if (isUnsafeZipPath(name)) return { error: `Archive rejected: path traversal entry "${name}".` };
  }

  let zip: ZipArchive;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { error: "Archive is corrupted and could not be opened." };
  }

  const entries = zip.getEntries().filter((entry) => !entry.isDirectory && !entry.entryName.endsWith("/"));
  const assessment = assessEntries(
    entries.map((entry) => ({
      name: entry.entryName,
      compressedSize: entry.header.compressedSize,
      uncompressedSize: entry.header.size,
    })),
    limits,
  );
  if (!assessment.ok) return { error: assessment.reason };

  return {
    files: entries.map((entry) => ({
      path: entry.entryName.replace(/\\/g, "/").replace(/^\.\//, ""),
      bytes: entry.getData(),
    })),
  };
}

export function zipBuffers(files: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}
