const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { execSync } = require('child_process');

const ASSETS_DIR = path.resolve('assets');
const OUTPUT_DIR = path.resolve('dist-assets');
const STATE_FILE = path.resolve('scripts/assets-state.json');

function loadState() {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function hashFolder(folderPath) {
    const hash = crypto.createHash('sha256');
    const files = fs.readdirSync(folderPath).sort();
    for (const file of files) {
        const full = path.join(folderPath, file);
        if (fs.statSync(full).isFile()) {
            hash.update(fs.readFileSync(full));
        }
    }
    return hash.digest('hex');
}

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
        const FIXED_DATE = new Date('2000-01-01T00:00:00Z');

        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(source, false, (data) => { data.date = FIXED_DATE; return data; });
        archive.finalize();
        output.on('close', resolve);
        output.on('error', reject);
    });
}

async function main() {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const state = loadState();
    const manifest = { version: Date.now(), packages: [] };
    const changed = [];

    for (const folder of fs.readdirSync(ASSETS_DIR)) {
        const source = path.join(ASSETS_DIR, folder);
        if (!fs.statSync(source).isDirectory()) continue;

        const folderHash = await hashFolder(source);
        const zipName = `${folder}.zip`;
        const zipPath = path.join(OUTPUT_DIR, zipName);

        if (state[folder] === folderHash) {
            console.log(`= ${zipName} (sem mudanças, pulando upload)`);
        } else {
            console.log(`↑ ${zipName} (mudou, vai fazer upload)`);
            changed.push({ zipName, zipPath });
        }

        await zipFolder(source, zipPath);

        manifest.packages.push({
            name: zipName,
            size: fs.statSync(zipPath).size,
            hash: await sha256(zipPath)
        });

        // atualiza o estado
        state[folder] = folderHash;
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    // upload só dos que mudaram + manifest
    if (changed.length === 0) {
        console.log('Nenhuma pasta mudou. Atualizando apenas o manifest...');
        execSync(`gh release upload assets ${OUTPUT_DIR}/manifest.json --repo boltnoak/boltnotes-assets --clobber`, { stdio: 'inherit' });
    } else {
        const files = changed.map(c => c.zipPath).join(' ');
        execSync(`gh release upload assets ${files} ${OUTPUT_DIR}/manifest.json --repo boltnoak/boltnotes-assets --clobber`, { stdio: 'inherit' });
    }

    saveState(state);
    console.log('Concluído!');
}

main().catch(console.error);