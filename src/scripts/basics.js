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

async function ensureCover({ appid, name, cover, hero, logo }) {
  const safeName = String(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const steam = appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}` : null;

  const [coverRes, heroRes, logoRes] = await Promise.allSettled([
    resolveImage({
      folder: 'Covers', custom: cover, baseName: safeName, defaultExt: '.jpg',
      fallbackUrls: steam ? [`${steam}/header.jpg`] : [],
    }),
    resolveImage({
      folder: 'Heros', custom: hero, baseName: safeName, defaultExt: '.jpg',
      fallbackUrls: steam ? [`${steam}/library_hero.jpg`, `${steam}/page_bg_generated_v6b.jpg`] : [],
    }),
    resolveImage({
      folder: 'Logos', custom: logo, baseName: safeName, defaultExt: '.png',
      fallbackUrls: steam ? [`${steam}/logo.png`] : [],
    }),
  ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

  return {
    cover: coverRes ?? PLACEHOLDER,
    hero: heroRes ?? PLACEHOLDER,
    logo: logoRes ?? null,
  };
}

async function addGame(newGameData, doHasCampaign) {
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
      appid: newGameData.appid,
      releaseDate: newGameData.releaseDate,
      developer: newGameData.developer,
      publisher: newGameData.publisher,
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
    achievementsList.push({
      name: newGameData.name,
      appid: newGameData.appid,
      hasAchievements,
      totalAchievements,
      unlockedAchievements: 0,
      achieStatus: 'aplatinar',
    });
    await saveJson('Games/achievements.json', achievementsList);

    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar o jogo globalmente:', error);
    return { success: false, error: error.message };
  }
}