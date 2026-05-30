const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver'); // Substituímos o adm-zip pelo archiver

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');

// Limpa a pasta de output
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
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', reject);

    archive.pipe(output);

    const FIXED_DATE = new Date('2000-01-01T00:00:00Z');

    archive.directory(source, false, (data) => {
      data.date = FIXED_DATE;
      return data;
    });

    archive.finalize();

    // espera o arquivo ser completamente fechado no disco
    output.on('close', resolve);
    output.on('error', reject);
  });
}


async function main() {
  const manifest = { version: Date.now(), packages: [] };

  for (const folder of fs.readdirSync(ASSETS_DIR)) {
    const source = path.join(ASSETS_DIR, folder);
    if (!fs.statSync(source).isDirectory()) continue;

    const zipName = `${folder}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    console.log(`[Empacotando] ${zipName}...`);
    
    // Como o archiver usa streams, precisamos de um await aqui
    await zipFolder(source, zipPath);

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

  console.log('Manifest criado com sucesso.');
}

main().catch(console.error);