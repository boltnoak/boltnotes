document.addEventListener('DOMContentLoaded', async () => {
    const versionEl = document.getElementById('app-version');
    if (!versionEl) return

    const version = await window.electronAPI.getAppVersion();
    if (versionEl) versionEl.innerText = `v${version}`;
});

const DOCS = 'documents://';

const docUrl = (filePath) =>
  DOCS + String(filePath).split('/').map(encodeURIComponent).join('/');

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    return { ok: false, status: 0, error: err, text: async () => '' };
  }
}

async function loadJson(filePath) {
  const res = await safeFetch(docUrl(filePath));
  if (!res.ok) return {};
  const text = await res.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

let jsonSaveQueue = Promise.resolve();

function saveJson(filePath, data) {
  const run = async () => {
    const res = await safeFetch(docUrl(filePath), {
      method: 'PUT',
      body: JSON.stringify(data, null, 2),
    });
    if (!res.ok) throw new Error(`Falha ao salvar ${filePath} (HTTP ${res.status})`);
    return true;
  };
  const result = jsonSaveQueue.then(run);
  jsonSaveQueue = result.catch(() => {});
  return result;
}

const IMG_EXTS = ['.jpg', '.png'];
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const PLACEHOLDER = 'assets/placeholder.png';

const gameImgUrl = (folder, file) => docUrl(`Games/${folder}/${file}`);
const cleanFile = (f) => String(f).replace(/[\\/]/g, '');

async function fileExists(url) {
  const res = await safeFetch(url, { method: 'HEAD' });
  return res.ok;
}

const findExistingCache = {}; // variável simples, não é função

async function findExisting(folder, baseName) {
  const key = folder + '/' + baseName;
  if (key in findExistingCache) return findExistingCache[key];

  let result = null;
  for (const ext of IMG_EXTS) {
    const url = gameImgUrl(folder, baseName + ext);
    if (await fileExists(url)) { result = url; break; }
  }

  findExistingCache[key] = result;
  return result;
}

async function downloadImage(url, folder, baseName, fallbackExt = '.jpg') {
  const existing = await findExisting(folder, baseName);
  if (existing) return existing;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = EXT_BY_MIME[type] || fallbackExt;
    const blob = await res.blob();

    const target = gameImgUrl(folder, baseName + ext);
    const put = await safeFetch(target, { method: 'PUT', body: blob });
    return put.ok ? target : null;
  } catch {
    return null;
  }
}

async function resolveImage({ folder, custom, fallbackUrls = [], baseName, defaultExt }) {
  if (custom) {
    if (/^https?:\/\//i.test(custom)) {
      const dl = await downloadImage(custom, folder, baseName, defaultExt);
      if (dl) return dl;
    } else {
      const f = cleanFile(custom);
      if (f.includes('.')) {
        const url = gameImgUrl(folder, f);
        if (await fileExists(url)) return url;
      } else {
        const found = await findExisting(folder, f);
        if (found) return found;
      }
    }
  }

  for (const url of fallbackUrls) {
    const dl = await downloadImage(url, folder, baseName, defaultExt);
    if (dl) return dl;
  }
  return null;
}

const steamCache = new Map();
const scoreCache = new Map();

async function detailScore(url) {
    if (scoreCache.has(url)) return scoreCache.get(url);
    const res = await fetch(url);
    const bmp = await createImageBitmap(await res.blob(), {
        resizeWidth: 80, resizeHeight: 45,
    });
    const ctx = new OffscreenCanvas(80, 45).getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, 80, 45).data;

    let diff = 0, n = 0;
    for (let i = 0; i < d.length - 4; i += 4) {
        diff += Math.abs(d[i] - d[i + 4]) + Math.abs(d[i + 1] - d[i + 5]) + Math.abs(d[i + 2] - d[i + 6]);
        n++;
    }
    const s = diff / n;
    scoreCache.set(url, s);
    return s;
}

async function getSteamAssets(appid) {
  if (!appid) return null;
  if (steamCache.has(appid)) return steamCache.get(appid);

  const promise = fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,background`)
    .then(res => res.json())
    .then(data => data[appid]?.success ? data[appid].data : null)
    .catch(() => null);

  steamCache.set(appid, promise);
  return promise;
}
async function pickBg(bgUrl) {
  if (!bgUrl || bgUrl.includes('generated')) return null;
  try {
    return (await detailScore(bgUrl)) < 6 ? null : bgUrl;
  } catch {
    return bgUrl;
  }
}

async function ensureCover({ appid, name, cover, hero, logo }) {
    const safeName = String(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const legacyCdn = appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}` : null;

    const [cachedCover, cachedHero] = await Promise.all([
        cover ? null : window.electronAPI.findCachedImage('Covers', safeName),
        hero ? null : window.electronAPI.findCachedImage('Backgrounds', safeName),
    ]);

    const getSteam = () => getSteamAssets(appid);

    const coverP = cachedCover ? Promise.resolve(cachedCover) : (async () => {
        const steam = cover ? null : await getSteam();
        return resolveImage({
        folder: 'Covers', custom: cover, baseName: safeName, defaultExt: '.jpg',
        fallbackUrls: [
            steam?.header_image,
            legacyCdn && `${legacyCdn}/library_600x900.jpg`,
            legacyCdn && `${legacyCdn}/header.jpg`,
        ].filter(Boolean),
        }).catch(() => null);
    })();

    const heroP = cachedHero ? Promise.resolve(cachedHero) : (async () => {
        let bgCandidate = null;
        if (!hero) {
        const steam = await getSteam();
        bgCandidate = await pickBg(steam?.background_raw || steam?.background);
        }
        return resolveImage({
            folder: 'Backgrounds', custom: hero, baseName: safeName, defaultExt: '.jpg',
            fallbackUrls: [bgCandidate, legacyCdn && `${legacyCdn}/library_hero.jpg`].filter(Boolean),
        }).catch(() => null);
    })();

    const [coverRes, heroRes] = await Promise.all([coverP, heroP]);
    return { cover: coverRes ?? PLACEHOLDER, hero: heroRes ?? PLACEHOLDER, logo: null };
}

async function addGame(newGameData, doHasCampaign, doHasAchievements, achieTotalCount) {
  try {
    let hasAchievements = false;
    let totalAchievements = 0;

    if (newGameData.appid) {
        try {
            const steam = await window.electronAPI.getSteamData(newGameData.appid);
            if (steam) {
                hasAchievements = steam.hasAchievements;
                totalAchievements = steam.totalAchievements;
            }
        } catch (e) {
            console.error(e);
        }
    }

    const asList = (v) => (Array.isArray(v) ? v : []);

    const gamesData = await loadJson('Games/games.json');
    const games = asList(gamesData.games);
    games.push({
        name: newGameData.name,
        appid: newGameData.appid || "",
        releaseDate: newGameData.releaseDate,
        developer: newGameData.developer,
        publisher: newGameData.publisher,
        ...(newGameData.cover && { cover: newGameData.cover }),
        ...(newGameData.hero && { hero: newGameData.hero }),
        ...(newGameData.custom && { custom: newGameData.custom }),
    });
    await saveJson('Games/games.json', { ...gamesData, games });

    const statusList = asList(await loadJson('Games/campaigns.json'));
    statusList.push({
      name: newGameData.name,
      status: 'ajogar',
      rating: 'null',
      completeDate: '',
      hasCampaign: doHasCampaign,
    });
    await saveJson('Games/campaigns.json', statusList);

    const achievementsList = asList(await loadJson('Games/achievements.json'));
    const entry = {
        name: newGameData.name,
        appid: newGameData.appid,
        hasAchievements,
        totalAchievements,
        unlockedAchievements: 0,
        achieStatus: 'aplatinar',
    };
    if (doHasAchievements) entry.hasAchievements = true;
    if (doHasAchievements && achieTotalCount) {
        entry.hasAchievements = true;
        entry.totalAchievements = achieTotalCount;
    }

    achievementsList.push(entry);
    await saveJson('Games/achievements.json', achievementsList);

    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar o jogo globalmente:', error);
    return { success: false, error: error.message };
  }
}