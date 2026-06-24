async function updateNoteCount() {
  const count = await window.api.notes.count();
  const el = document.getElementById("note-count");

  if (el) {
    el.textContent = `${count} Notas`;
  }
}

let cachedSeasonInfo = null;

async function loadCloudSeasonInfo() {
    if (cachedSeasonInfo) return cachedSeasonInfo;
    try {
        const content = await window.api.fortnite.getSeasons(); 
        cachedSeasonInfo = content || {};
        return cachedSeasonInfo;
    } catch (e) {
        console.error("Erro ao buscar dados da internet:", e);
        return {};
    }
}

async function loadFortniteStats() {
  try {
    const data = await loadCloudSeasonInfo();

    if (!data || Object.keys(data).length === 0) {
      console.log("Nenhum dado de Fortnite encontrado ainda.");
      return; 
    }

    const keys = Object.keys(data);
    const chapters = new Set();
    
    keys.forEach(key => {
      const match = key.match(/^c(\d+)s(\d+)$/i);
      if (match) {
        const chapter = match[1];
        chapters.add(chapter);
      }
    });

    const totalSeasons = keys.length;
    const totalChapters = chapters.size;

    document.getElementById("season-count").textContent = `${totalSeasons + 20} Temporadas`;
    document.getElementById("chapter-count").textContent = `${totalChapters + 2} Capítulos`;

  } catch (error) {
    console.error("Erro ao calcular o progresso do Fortnite:", error);
  }
}

updateNoteCount();
loadFortniteStats();

function updateSepBar() {
    requestAnimationFrame(() => {
        const section = document.querySelector('.pages-section');
        const sepBar = document.querySelector('.sep-bar');
        const visible = Array.from(document.querySelectorAll('.pages-section .page'))
            .filter(el => el.offsetParent !== null).length;
        const total = document.querySelectorAll('.pages-section .page').length;

        if (!sepBar || !section) return;

        const ratio = visible / total;
        const rect = section.getBoundingClientRect();
        const vw = window.innerWidth / 100;

        sepBar.style.width = `${(rect.width / vw) * ratio}vw`;
        sepBar.style.marginLeft = `${(rect.left / vw) + (rect.width / vw) * (1 - ratio) / 2}vw`;
    });
}

function parseBRDate(dateStr) {
  if (!dateStr || !dateStr.includes("/")) return 0;

  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
}

let cachedGamesDB = null;
let cachedStatus = null;

async function loadGamesDB() {
    if (cachedGamesDB) {
        console.log("Trailers carregados do cache!");
        return cachedGamesDB;
    }
    try {
        const content = await window.api.fortnite.getGamesDB(); 
        cachedGamesDB = content || {};
        return cachedGamesDB;
    } catch (e) {
        console.error("Erro ao buscar trailers da internet:", e);
        return {};
    }
}

async function loadGames() {
    const data = await loadGamesDB();
    const stats = await loadStatus();

    const playingNow = document.querySelector(".playingNow-panel");

    if (!playingNow) return;

    playingNow.innerHTML = "";

    let listaStats = Array.isArray(stats) ? stats : (stats.games || []);
    const dbGames = data.games ? [...data.games] : [];

    let games = listaStats.map(localGame => {
        const gameNoDB = dbGames.find(g => 
            (localGame.appid && g.appid === localGame.appid) || 
            (localGame.name && g.name.toLowerCase() === localGame.name.toLowerCase())
        ) || {};

        return {
            ...gameNoDB,
            ...localGame
        };
    });

    const playing = games.filter(g => (g.status || "").toLowerCase().trim() === "jogando");
    let others = games.filter(g => (g.status || "").toLowerCase().trim() !== "jogando");

    const completedMap = new Map(
        games
            .filter(g => (g.status || "").toLowerCase() === "zerado")
            .sort((a, b) => parseBRDate(a.completeDate) - parseBRDate(b.completeDate))
            .map((g, i) => [g.appid || g.name, i + 1])
    );

    // Renderiza jogos sendo jogados
    for (const game of playing) {
        const card = await createGameCard(game, true);
        playingNow.appendChild(card);
    }

    // Tela vazia se não houver jogos jogando
    if (playingNow.childElementCount === 0) {
        const noGames = document.createElement("div");
        noGames.className = "playingNow-no-games";
        noGames.textContent = "Nenhum jogo sendo jogado.";
        playingNow.appendChild(noGames);
    }
}

async function createGameCard(game, isPlaying = false, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";

    const img = document.createElement("img");
    img.className = "game-cover";

    const localPath = await window.api.games.ensureCover({
        appid: game.appid,
        name: game.name,
        cover: game.cover
    });

    img.src = localPath ? `file://${localPath}` : "placeholder.jpg";

    const gameInfo = document.createElement("div");
    gameInfo.className = "game-info";

    const title = document.createElement("p");
    title.className = "game-title";
    title.textContent = game.name;

    const status = (game.status || "").toLowerCase().trim();

    const tag = document.createElement("span");
    tag.className = "status";

    const tagFill = document.createElement("span");
    tagFill.className = "status-fill";
    tagFill.style.width = (game.storyProgress || 0) + "%";

    gameInfo.appendChild(title);
    
    if (status === "jogando") {
        tag.classList.add("jogando");
        const statusPercentage = document.createElement("span");
        statusPercentage.className = "jogando-text";
        statusPercentage.textContent = `Progresso: ${(game.storyProgress || 0)}%`;
        gameInfo.appendChild(statusPercentage);
        gameInfo.appendChild(tag);
    }
    
    tag.appendChild(tagFill);

    div.appendChild(img);
    div.appendChild(gameInfo);

    return div;
}

async function loadStatus() {
    if (cachedStatus) {
        console.log("Reviews carregados do cache!");
        return cachedStatus;
    }
    try {
        const content = await window.electronAPI.json.load(`Games/status.json`);
        cachedStatus = content || {};
        return cachedStatus;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}

loadGames();

const playingNowTitle = document.getElementById('featured-title');


document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();

    const toggles = {
        'notes_on_home': document.getElementById('notes'),
        'backlog_on_home': document.getElementById('games'),
        'fortnite_on_home': document.getElementById('fortnite'),
        'playing_now_on_home': [
            document.querySelector('.page-infos'),
            document.querySelector('.sep-bar')
        ],
        'show_version': document.querySelector('.app-version')
    };

    const featuredPanels = {
        'none': [
            document.querySelector('.page-infos'),
            document.querySelector('.sep-bar')
        ],
        'playing_now': document.querySelector('.playingNow-panel'),
        'fn_fast_edit': document.querySelector('.recentSeason-panel')
    };

    const currentFeatured = config.featured;

    if (currentFeatured === 'none') {
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.playingNow-panel').style.display = 'none';
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
        document.querySelector('.sep-bar').style.visibility = 'hidden';
    } if (currentFeatured === 'fn_fast_edit') {
        inicializarTitulo();
        document.querySelector('.playingNow-panel').style.display = 'none';
    } if (currentFeatured === 'playing_now') {
        document.querySelector('#featured-title').innerHTML = `Jogando no momento<i id="playingNowSection-toggle" class="fa-solid fa-gamepad"></i>`;
        document.querySelector('.recentSeason-panel').style.display = 'none';
    } else {
        for (const [key, value] of Object.entries(featuredPanels)) {
            if (key === 'none') continue;
            const elements = Array.isArray(value) ? value : [value];

            elements.forEach(el => {
                if (el) {
                    el.style.display = key === currentFeatured ? '' : 'none';
                }
            });
        }
    }


    for (const [key, value] of Object.entries(toggles)) {
        if (!value) continue;

        const elements = Array.isArray(value) ? value : [value];

        elements.forEach(el => {
            if (el) {
                el.style.display = config[key] === false ? 'none' : '';
            }
        });
    }
    updateSepBar();
});

const FILE_STATS = "Fortnite/stats.json";

async function loadCloudSeasonInfo() {
    if (cachedSeasonInfo) return cachedSeasonInfo;
    try {
        const content = await window.api.fortnite.getSeasons(); 
        cachedSeasonInfo = content || {};
        return cachedSeasonInfo;
    } catch (e) {
        console.error("Erro ao buscar dados da internet:", e);
        return {};
    }
}

function getLatestSeason(data) {
    const parsed = Object.entries(data)
        .map(([key, value]) => {

            const match = key.match(
                /^c(\d+)(ms|s|og|remix)?(\d+)?$/i
            );

            if (!match) return null;

            return {
                key,
                data: value,
                chapter: Number(match[1]),
                type: match[2] || '',
                season: Number(match[3] || 0)
            };
        })
        .filter(Boolean);

    parsed.sort((a, b) => {

        if (a.chapter !== b.chapter) {
            return b.chapter - a.chapter;
        }

        return b.season - a.season;
    });

    return parsed[0] || null;
}

async function loadLatestFN() {
    
}

async function inicializarTitulo() {
    const seasons = await window.api.fortnite.getSeasons();
    const latest = getLatestSeason(seasons);

    if (!latest) return;

    const code = latest.key;

    const cloudData = await loadCloudSeasonInfo();
    const statsData = window.electronAPI.json.load(FILE_STATS);
    const stats = (statsData && typeof statsData === 'object' && !Array.isArray(statsData)) ? statsData : {};
    
    const infoTemporada = cloudData[code] || stats[code] || {};
    const seasonName = infoTemporada.name || "Temporada Atual";
    
    const titleEl = document.getElementById('featured-title');
    const img = document.getElementById('recentSeason-image');

    if (titleEl && img) {
        img.src = `assets://${code}.jpg`;
        titleEl.innerHTML = `Fortnite BR — Edição rápida<i class="fa-solid fa-square-poll-horizontal"></i>`;
    }

    const name = document.getElementById('recent-season-name');
    name.textContent = `${infoTemporada.name}`

    const levelsSpan = document.querySelector('.status-level');
    const winsSpan = document.querySelector('.status-win');

    if (levelsSpan) levelsSpan.id = `${code}-levels`;
    if (winsSpan) winsSpan.id = `${code}-wins`;

    preencherValores()
}

async function preencherValores() {
    const seasons = await window.api.fortnite.getSeasons();
    const latest = getLatestSeason(seasons);

    if (!latest) return;

    const code = latest.key;

    const statsData = await window.electronAPI.json.load(FILE_STATS);
    const stats = (statsData && typeof statsData === 'object' && !Array.isArray(statsData)) ? statsData : {};
    const data = stats[code] || {};

    const currentStats = stats[code];
    
    const levels = document.getElementById(`${code}-levels`);
    const wins = document.getElementById(`${code}-wins`);
    const levelsBar = document.querySelector('.level-progress-bar-fill');
    const levelsText = document.querySelector('.level-progress-text');
    
    if (levels) levels.textContent = data.levels || "0";
    if (levelsBar) levelsBar.style.width = `${(data.levels / 200) * 100}%`;
    if (levelsText) levelsText.textContent = `Passe: ${(data.levels / 200) * 100}% - ${data.levels} / 200`
    if (wins) wins.textContent = data.wins || "0";

    const levelAdd = document.querySelector('.statusLevel-add');
    const levelMinus = document.querySelector('.statusLevel-minus');
    const winAdd = document.querySelector('.statusWin-add');
    const winMinus = document.querySelector('.statusWin-minus');

    function updateStat(statKey, increment, displaySpan) {
        let currentValue = parseInt(currentStats[statKey]) || 0;
        if (currentValue + increment >= 0) {
            currentValue += increment;
            currentStats[statKey] = currentValue.toString(); 
            if (displaySpan) displaySpan.textContent = currentStats[statKey];
            if (typeof debouncedSave === "function") debouncedSave(code);
        }
    }
    const levelsSpan = document.querySelector('.status-level');
    const winsSpan = document.querySelector('.status-win');
    if (levelAdd) levelAdd.onclick = () => updateStat('levels', 1, levelsSpan);
    if (levelMinus) levelMinus.onclick = () => updateStat('levels', -1, levelsSpan);
    if (winAdd) winAdd.onclick = () => updateStat('wins', 1, winsSpan);
    if (winMinus) winMinus.onclick = () => updateStat('wins', -1, winsSpan);

    function debouncedSave(code) {
    clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        const levels = document.getElementById(`${code}-levels`)?.textContent || "0";
        const wins = document.getElementById(`${code}-wins`)?.textContent || "0";

        stats[code] = {
            ...stats[code],
            levels, 
            wins
        };

        try {
            await window.electronAPI.json.save(FILE_STATS, stats);
            
            console.log(`Fortnite - Dados da temporada ${code.toUpperCase().replace('S', 'T')} salvos com sucesso!`);
        } catch (err) {
            console.error(`Fortnite - Erro ao salvar dados da temporada ${code}:`, err);
        }
    }, 200);
}
}

let saveTimeout = null;

