const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');

fs.rmSync(OUTPUT_DIR, {
    recursive: true,
    force: true
});

fs.mkdirSync(OUTPUT_DIR, {
    recursive: true
});

function sha256(file) {
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex');
}

const manifest = {
    version: Date.now(),
    packages: []
};

for (const folder of fs.readdirSync(ASSETS_DIR)) {
    const source = path.join(ASSETS_DIR, folder);

    if (!fs.statSync(source).isDirectory()) {
        continue;
    }

    const zipName = `${folder}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    const zip = new AdmZip();
    zip.addLocalFolder(source);
    zip.writeZip(zipPath);

    const stat = fs.statSync(zipPath);

    manifest.packages.push({
        name: zipName,
        size: stat.size,
        hash: sha256(zipPath)
    });

    console.log(`✓ ${zipName}`);
}

fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
);

console.log('Manifest criado.');
