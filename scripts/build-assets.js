const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function zipFolder(source, zipPath) {
  const zip = new AdmZip();
  const FIXED_DATE = new Date('2000-01-01T00:00:00Z');

  const addDir = (dirPath, zipRelative) => {
    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      const relPath = zipRelative ? `${zipRelative}/${entry}` : entry;

      if (fs.statSync(fullPath).isDirectory()) {
        addDir(fullPath, relPath);
      } else {
        const data = fs.readFileSync(fullPath);
        zip.addFile(relPath, data);
        const zipEntry = zip.getEntry(relPath);
        if (zipEntry) zipEntry.header.time = FIXED_DATE;
      }
    }
  };

  addDir(source, '');
  zip.writeZip(zipPath);
}

async function main() {
  const manifest = { version: Date.now(), packages: [] };

  for (const folder of fs.readdirSync(ASSETS_DIR)) {
    const source = path.join(ASSETS_DIR, folder);
    if (!fs.statSync(source).isDirectory()) continue;

    const zipName = `${folder}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    console.log(`[Empacotando] ${zipName}...`);
    zipFolder(source, zipPath);

    manifest.packages.push({
      name: zipName,
      size: fs.statSync(zipPath).size,
      hash: await sha256(zipPath)
    });

    console.log(`✓ ${zipName}`);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Manifest criado.');
}

main().catch(console.error);
