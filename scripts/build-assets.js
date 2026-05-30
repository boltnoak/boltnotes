const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function zipFolder(source, zipPath) {
  const zip = new AdmZip();

  const FIXED_DATE = new Date('2000-01-01T00:00:00Z');

  const addDir = (dirPath, zipRelative) => {
    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      const relPath = zipRelative ? `${zipRelative}/${entry}` : entry;
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        addDir(fullPath, relPath);
      } else {
        const data = fs.readFileSync(fullPath);
        zip.addFile(relPath, data);

        // fixa o timestamp do entry
        const zipEntry = zip.getEntry(relPath);
        if (zipEntry) {
          zipEntry.header.time = FIXED_DATE;
        }
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

    zipFolder(source, zipPath);

    manifest.packages.push({
      name: zipName,
      size: fs.statSync(zipPath).size,
      hash: sha256(zipPath)
    });

    console.log(`✓ ${zipName}`);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Manifest criado.');
}

main();