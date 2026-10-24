const DOCS_BASE = 'documents://Fortnite/Assets';
const REMOTE_BASE = 'https://github.com/boltnoak/boltnotes-assets/releases/download/assets';
const docsUrl = (p) => `${DOCS_BASE}/${p}`;

async function readLocalManifest() {
  try {
    const res = await fetch(docsUrl('manifest.json'), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function writeDoc(path, data) {
  const res = await fetch(docsUrl(path), { method: 'PUT', body: data });
  if (!res.ok) throw new Error(`Gravar ${path}: HTTP ${res.status}`);
}

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readZipEntries(buf) {
  const v = new DataView(buf), bytes = new Uint8Array(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('ZIP inválido');

  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const td = new TextDecoder();
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompido');
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const elen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const off = v.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;

    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    entries.push({ name, method, raw: bytes.subarray(start, start + csize) });
  }
  return entries;
}

async function inflateRaw(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}

async function installPackage(pkg) {
  const res = await fetch(`${REMOTE_BASE}/${pkg.name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if ((await sha256(buf)) !== pkg.hash) throw new Error('hash dont match');

  for (const f of readZipEntries(buf)) {
    const data = f.method === 0 ? f.raw : await inflateRaw(f.raw);
    await writeDoc(f.name, data);
  }
}

async function fetchWithTimeout(url, options = {}, ms = 2000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function syncFortniteAssets(onProgress) {
  const localManifest = await readLocalManifest();

  if (!navigator.onLine) {
    if (localManifest) return { offline: true };
    throw new Error('Sem conexão e sem assets locais do Fortnite.');
  }

  let remote;
  try {
    const res = await fetchWithTimeout(`${REMOTE_BASE}/manifest.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remote = await res.json();
    if (!Array.isArray(remote?.packages)) throw new Error('Manifest remoto inválido.');
  } catch (err) {
    console.warn('Assets - manifest remoto indisponível:', err.message);
    if (await readLocalManifest()) return { offline: true };
    throw new Error('Sem conexão e sem assets locais do Fortnite.');
  }

  const local = (await readLocalManifest()) || { version: 0, packages: [] };
  const localHash = new Map(local.packages.map((p) => [p.name, p.hash]));
  const pending = remote.packages.filter((p) => localHash.get(p.name) !== p.hash);
  if (!pending.length) return { updated: false };

  const totalBytes = pending.reduce((n, p) => n + p.size, 0);
  let doneBytes = 0;
  onProgress?.({ done: 0, total: totalBytes, count: pending.length });

  const installed = new Map(localHash);
  const failed = [];

  for (const pkg of pending) {
    try {
      await installPackage(pkg);
      installed.set(pkg.name, pkg.hash);
      await writeDoc('manifest.json', JSON.stringify({
        version: local.version,
        packages: [...installed].map(([name, hash]) => ({ name, hash })),
      }));
    } catch (err) {
      console.error(`Assets - ${pkg.name}:`, err.message);
      failed.push(pkg.name);
    }
    doneBytes += pkg.size;
    onProgress?.({ done: doneBytes, total: totalBytes, count: pending.length });
  }

  if (failed.length) throw new Error(`Falha ao baixar: ${failed.join(', ')}`);

  await writeDoc('manifest.json', JSON.stringify({
    version: remote.version,
    packages: remote.packages.map(({ name, hash }) => ({ name, hash })),
  }));
  return { updated: true };
}