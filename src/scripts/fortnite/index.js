let cachedSeasons = null;

async function loadCloudSeasonInfo() {
    if (cachedSeasons) return cachedSeasons;

    const config = await window.electronAPI.config.getConfig();
    const language = config.language || "pt-BR";

    const url = `https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-seasons-${language}.json`;

    const content = await fetchWithCache(url, `fn-seasons-${language}`);
    cachedSeasons = content || {};
    return cachedSeasons;
}

async function getLatestSeason() {
    const seasons = await loadCloudSeasonInfo();
    const [key, value] = Object.entries(seasons)[0] || [];

    return key ? {key, data: value} : null;
}

async function loadBanner() {
        const latest = await getLatestSeason();
        if (!latest) return;

        console.log(`Temporada mais recente: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);
        document.getElementById("latestSeasonBG").style.backgroundImage = `url('assets://fortnite-${latest.key}-assets/${latest.key}.jpg')`;
}
async function loadSidebarChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
            .filter(Boolean)
    )].sort((a, b) => {
        const numA = parseInt(a.replace('c', ''), 10);
        const numB = parseInt(b.replace('c', ''), 10);
        return numB - numA;
    });
    const chaptersHtml = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a class="sidebar-btn sidebar-btn-chapter" data-chapter="${number}" data-nav="pages/fortnite-chapter.html?num=${number}">
                    <p class="sidebar-btn-number">${number}</p>
                    <span><span data-i18n="fn-chapter">Capítulo</span> ${number}</span>
                </a>`;
    }).join('');
    if (window.parent && typeof window.parent.setFortniteChapters === 'function') {
        window.parent.setFortniteChapters(chaptersHtml);
        const urlParams = new URLSearchParams(window.location.search);
        const currentNum = urlParams.get('num');
        if (currentNum) {
            window.parent.document.querySelectorAll('.sidebar-btn-chapter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.chapter === currentNum);
            });
        }
    }
}
async function loadChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
    )];

    document.querySelector('.chapter-section').innerHTML = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a id="chapter" data-chapter="${number}" href="pages/fortnite-chapter.html?num=${number}">
                    <div class="chapter-image-div">
                        <img class="chapter-image" src="assets://fn-chapter-covers/chapter${number}-cover.jpg">
                    </div>
                    <p class="title"><span data-i18n="fn-chapter">Capítulo</span> ${number}</p>
                </a>`;
    }).join('');
    applyLocale();
}

// loadBanner();
// loadChapters();
// loadSidebarChapters();

const DOCS_BASE = 'documents://Fortnite/Assets';
const REMOTE_BASE = 'https://github.com/boltnoak/boltnotes-assets/releases/download/assets';
const docsUrl = (p) => `${DOCS_BASE}/${p}`;

async function readLocalManifest() {
  try {
    const res = await fetch(docsUrl('manifest.json'), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch { return null; } // na primeira vez não existe
}

async function writeDoc(path, data) {
  const res = await fetch(docsUrl(path), { method: 'PUT', body: data });
  if (!res.ok) throw new Error(`Gravar ${path}: HTTP ${res.status}`);
}

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- ZIP mínimo (métodos 0 = store e 8 = deflate) ----
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
    if (name.endsWith('/')) continue; // pasta

    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    entries.push({ name, method, raw: bytes.subarray(start, start + csize) });
  }
  return entries;
}

async function inflateRaw(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}
// ------------------------------------------------------

async function installPackage(pkg) {
  const res = await fetch(`${REMOTE_BASE}/${pkg.name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if ((await sha256(buf)) !== pkg.hash) throw new Error('hash não confere');

  const folder = pkg.name.replace(/\.zip$/, '');
  for (const f of readZipEntries(buf)) {
    const data = f.method === 0 ? f.raw : await inflateRaw(f.raw);
    // se o zip já vier com a pasta raiz, não duplica
    const rel = f.name.startsWith(`${folder}/`) ? f.name : `${folder}/${f.name}`;
    await writeDoc(rel, data);
  }
}

async function syncFortniteAssets(onProgress) {
  let remote;
  try {
    const res = await fetch(`${REMOTE_BASE}/manifest.json`, { cache: 'no-store' });
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
      // salva a cada pacote: se fechar no meio, retoma de onde parou
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

async function initFortnitePage() {
  await Promise.all([loadBanner(), loadChapters(), loadSidebarChapters()]);
}

async function bootFortnite() {
  const screen = document.getElementById('loading-screen');
  const content = document.querySelector('.banner-bg');
  const content2 = document.querySelector('.chapter-section');
  const text = document.getElementById('loading-text');
  const progress = document.querySelector('.progress');
  const bar = document.getElementById('fortnite-progress');

  try {
    await syncFortniteAssets(({ done, total }) => {
      progress.classList.add('active');
      const mb = (n) => (n / 1048576).toFixed(1);
      text.textContent = `${mb(done)} / ${mb(total)} MB`;
      bar.style.width = `${(done / total) * 100}%`;
    });
    await initFortnitePage();
    content.style.display = 'flex';
    content2.style.display = 'grid';
  } catch (err) {
    text.textContent = err.message;
    return;
  }

  content.classList.add('visible');
  screen.classList.add('hide');
  screen.addEventListener('transitionend', () => screen.remove(), { once: true });
}

bootFortnite();