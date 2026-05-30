const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function zipFolder(source, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    // data fixa em todos os entries = zip determinístico
    archive.directory(source, false, (entry) => {
      entry.date = new Date('2000-01-01T00:00:00Z');
      return entry;
    });

    archive.finalize();
  });
}

async function main() {
  const manifest = {
    version: Date.now(),
    packages: []
  };

  for (const folder of fs.readdirSync(ASSETS_DIR)) {
    const source = path.join(ASSETS_DIR, folder);

    if (!fs.statSync(source).isDirectory()) continue;

    const zipName = `${folder}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    await zipFolder(source, zipPath);

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