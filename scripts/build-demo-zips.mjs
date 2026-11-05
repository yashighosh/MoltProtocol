import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const samples = [
  ["fixtures/demo/billing-legacy", "fixtures/demo/billing-legacy.zip"],
  ["fixtures/demo/inventory-legacy", "fixtures/demo/inventory-legacy.zip"],
];

function collect(directory) {
  const files = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const stat = statSync(absolute);
      if (stat.isSymbolicLink()) {
        throw new Error(`Refusing to zip a symlink: ${absolute}`);
      }
      if (stat.isDirectory()) {
        walk(absolute);
        continue;
      }
      const relative = path.relative(directory, absolute).split(path.sep).join("/");
      if (relative.startsWith("/") || relative.split("/").includes("..")) {
        throw new Error(`Unsafe zip path: ${relative}`);
      }
      files.push({ name: relative, data: readFileSync(absolute) });
    }
  };
  walk(directory);
  files.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  return files;
}

/** Stored zip with zeroed timestamps so the same tree always produces the same bytes. */
function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const data = entry.data;
    const name = Buffer.from(entry.name);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
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

for (const [source, target] of samples) {
  const directory = path.join(root, source);
  const entries = collect(directory);
  const archive = storedZip(entries);
  const destination = path.join(root, target);
  writeFileSync(destination, archive);
  console.log(`${target} ${archive.length} bytes ${entries.length} files`);
}
