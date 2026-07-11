const FILE = "Games/games.json";
const CAMPAIGNS_FILE = "Games/campaigns.json";
const ACHIEVEMENTS_FILE = "Games/achievements.json";

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
let cachedCampaignStatus = null;
let cachedAchieStatus = null;


async function loadGamesDB() {
    if (cachedGamesDB) {
        console.log("Reviews carregados do cache!");
        return cachedGamesDB;
    }
    try {
        const achievements = await window.electronAPI.json.load(`Games/games.json`);
        cachedGamesDB = achievements || {};
        return cachedGamesDB;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}
async function loadStatusAchie() {
    if (cachedAchieStatus) {
        return cachedAchieStatus;
    }
    try {
        const content = await window.electronAPI.json.load(`Games/achievements.json`);
        cachedAchieStatus = Array.isArray(content) ? content : [];
        return cachedAchieStatus;
    } catch (e) {
        console.error("Erro ao ler achievements.json:", e);
        return {};
    }
}
async function loadStatus() {
    if (cachedCampaignStatus) {
        return cachedCampaignStatus;
    }
    try {
        const content = await window.electronAPI.json.load(`Games/campaigns.json`);
        cachedCampaignStatus = content || {};
        return cachedCampaignStatus;
    } catch (e) {
        console.error("Erro ao ler campaigns.json:", e);
        return {};
    }
}

// async function loadGames() {
//     const data = await loadGamesDB();
//     const stats = await loadStatus();
//     const playingNow = document.querySelector(".playingNow-panel");

//     if (!playingNow) return;
//     playingNow.innerHTML = "";

//     let listaStats = Array.isArray(stats) ? stats : (stats.games || []);
//     const dbGames = data.games ? [...data.games] : [];

//     let games = listaStats.map(localGame => {
//         const gameNoDB = dbGames.find(g => 
//             (localGame.appid && g.appid === localGame.appid) || 
//             (localGame.name && g.name.toLowerCase() === localGame.name.toLowerCase())
//         ) || {};

//         return {
//             ...gameNoDB,
//             ...localGame
//         };
//     });

//     const playing = games.filter(g => (g.status || "").toLowerCase().trim() === "jogando");
//     for (const game of playing) {
//         const card = await createGameCard(game);
//         playingNow.appendChild(card);
//     }
//     if (playingNow.childElementCount === 0) {
//         const noGames = document.createElement("div");
//         noGames.className = "playingNow-no-games";
//         noGames.textContent = "Nenhum jogo sendo jogado.";
//         playingNow.appendChild(noGames);
//     }
// }
async function loadGames() {
    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(FILE),
        loadStatus()
    ]);

    const playingNow = document.querySelector(".playingNow-panel");
    if (!playingNow) return;

    playingNow.innerHTML = "";

    const listaStats = Array.isArray(stats) ? stats : (stats.games || []);
    const dbGames = data.games ? data.games : [];

    const dbByAppid = new Map();
    const dbByName = new Map();

    for (const g of dbGames) {
        if (g.appid != null) dbByAppid.set(String(g.appid), g);
        if (g.name) dbByName.set(g.name.toLowerCase(), g);
    }

    const games = listaStats.map(localGame => {
        const byAppid = localGame.appid != null ? dbByAppid.get(String(localGame.appid)) : null;
        const byName = localGame.name ? dbByName.get(localGame.name.toLowerCase()) : null;
        const gameNoDB = byAppid || byName || {};

        const combinedGame = { ...gameNoDB, ...localGame };

        const status = (combinedGame.status || "").toLowerCase().trim();
        combinedGame._status = status;

        return combinedGame;
    });

    const playing = [];

    for (const g of games) {
        if (g._status === "jogando") playing.push(g);
    }

    const completedMap = new Map(
        games
            .filter(g => g._status === "zerado")
            .sort((a, b) => (a._completeMs || 0) - (b._completeMs || 0))
            .map((g, i) => [g.appid || g.name, i + 1])
    );

    const playingCards = await Promise.all(
        playing.map(game => createGameCard(game, true))
    );

    const playingFragment = document.createDocumentFragment();
    for (const card of playingCards) playingFragment.appendChild(card);

    if (playingFragment.childElementCount === 0) {
        const noGames = document.createElement("div");
        noGames.className = "playingNow-no-games";
        noGames.textContent = "Nenhum jogo sendo jogado.";
        playingFragment.appendChild(noGames);
    }

    playingNow.appendChild(playingFragment);
}
async function createGameCard(game, isPlaying = false, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";
    const img = document.createElement("img");
    img.className = "game-cover";

    const { cover: localPath } = await window.api.games.ensureCover({
        appid: game.appid,
        name: game.name,
        cover: game.cover
    });

    img.src = localPath ? `file://${localPath}` : 'assets://placeholder.png';
    
    const gameInfo = document.createElement("div");
    gameInfo.className = "game-info";
    const title = document.createElement("p");
    title.className = "game-title";

    const status = (game.status || "").toLowerCase().trim();

    gameInfo.appendChild(title);

    if (status === "jogando") div.classList.add('jogando');

    title.textContent = game.name;
    div.dataset.id = game.name;

    div.appendChild(img);
    div.appendChild(gameInfo);

    div.addEventListener('click', () => openGamePopup(div,
        game.status,
        game.releaseDate,
        game.rating,
        game.developer,
        game.publisher
    ));

    return div;
}

async function openGamePopup(el, status, releaseDate, rating, developer, publisher) {
    const title = el.dataset.id;
    const name = el.dataset.id.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const popup = document.querySelector('.game-popup-div');
    popup.setAttribute('data-name', title);

    const banner = document.querySelector('.game-banner');
    const logo = document.querySelector('.game-logo');
    const devText = document.querySelector('.dev-name');
    const pubText = document.querySelector('.pub-name');
    const releaseDateText = document.querySelector('.game-releaseDate-text');
    const statusText = document.querySelector('.campaign-status-tag');
    const achieStatusText = document.querySelector('.achie-status-tag');
    const achieCount = document.querySelector('.achie-info-title-numbers');
    const achiePercentage = document.querySelector('.achie-percentage');
    const achieBarFill = document.querySelector('.achie-bar-fill');
    const achieTitle = document.querySelector('.achie-info-title');
    const achieInfo = document.querySelector('.achie-info');

    pubText.style.animation = '';
    devText.style.animation = '';
    achieStatusText.style.display = 'flex';

    let jogoEncontrado = null;
    let gameStatusFound = null;

    try {
        const games = await loadStatusAchie();
        jogoEncontrado = games.find(g => g.name === title);
        const gamesCamp = await loadStatus();
        gameStatusFound = gamesCamp.find(g => g.name === title);
    } catch (erro) { console.error("Erro ao carregar o JSON:", erro) }

    console.log(name, status, releaseDate, developer, publisher, rating);

    banner.src = `appdata:///game-heros/${name}.jpg`;
    const logoExists = await window.electronAPI.existsAppdata(`game-logos/${name}.png`);
    if (logoExists) {
        logo.src = `appdata:///game-logos/${name}.png`;
    } else {
        logo.src = '';
    }
    logo.alt = el.dataset.id;
    devText.textContent = developer;
    pubText.textContent = publisher;
    releaseDateText.textContent = releaseDate;

    const achieGame = jogoEncontrado;
    const gameCampaign = gameStatusFound;

    const total = achieGame.totalAchievements || 0;
    const unlocked = achieGame.unlockedAchievements || 0;
    achieCount.textContent = `${unlocked}/${total}`;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    achieBarFill.style.width = `${percentage}%`;
    achiePercentage.textContent = `${percentage}%`;

    const hasAchie = achieGame.hasAchievements;
    if (hasAchie) {
        achieTitle.style.display = 'flex';
        achieInfo.style.display = 'flex';
    } else {
        achieTitle.style.display = 'none';
        achieInfo.style.display = 'none';
        achieStatusText.style.display = 'none';
    }

    if (gameCampaign.status.toLowerCase() == 'zerado') {
        statusText.textContent = 'Zerado';
        statusText.classList.remove('ajogar');
        statusText.classList.remove('jogando');
        statusText.classList.add('zerado');
    }
    if (gameCampaign.status.toLowerCase() == 'jogando') {
        statusText.textContent = 'Jogando';
        statusText.classList.remove('ajogar');
        statusText.classList.add('jogando');
        statusText.classList.remove('zerado');
    }
    if (gameCampaign.status.toLowerCase() == 'ajogar') {
        statusText.textContent = 'Á Jogar';
        statusText.classList.add('ajogar');
        statusText.classList.remove('jogando');
        statusText.classList.remove('zerado');
    }

    if (jogoEncontrado && jogoEncontrado.achieStatus) {
        const achieStatus = jogoEncontrado.achieStatus.toLowerCase();

        if (achieStatus === 'platinado')  updateStatus(achieStatusText, 'platinado', 'Platinado');
        if (achieStatus === 'platinando') updateStatus(achieStatusText, 'platinando', 'Platinando');
        if (achieStatus === 'aplatinar')  updateStatus(achieStatusText, 'aplatinar', 'À Platinar');
    } else {
        achieStatusText.style.display = 'none';
    }

    popup.style.display = 'flex';
    const titleDiv = document.querySelector('.game-popup-title');

    requestAnimationFrame(() => {
        if (pubText.scrollWidth <= titleDiv.clientWidth) {
            pubText.style.animation = 'none';
        }
        if (devText.scrollWidth <= titleDiv.clientWidth) {
            devText.style.animation = 'none';
        }
    });
}

const closeGamePopup = document.querySelector('.game-popup-div');
closeGamePopup.addEventListener('click', (e) => {
    if (e.target === gamePopup) {
        
    }
});

const gamePopupDiv = document.querySelector('.game-popup-div');
const gamePopup = document.querySelector('.game-popup');
gamePopupDiv.addEventListener('click', (e) => {
    if (e.target === gamePopupDiv) {
        gamePopup.classList.add('is-closing');
        
        gamePopup.addEventListener('animationend', () => {
            gamePopupDiv.style.display = 'none';
            gamePopup.classList.remove('is-closing');
        }, { once: true });
    }
});

const statusBtn = document.querySelector('.campaign-status-tag');
const achieBtn = document.querySelector('.achie-status-tag');

async function updateStatusJSON(game, statusClass) {
    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(CAMPAIGNS_FILE),
        loadStatus()
    ]);

    const listaStats = Array.isArray(stats) ? stats : (stats.games || []);

    const nomeDoJogoProcurado = game;
    const novoStatus = statusClass;

    const jogoEncontrado = listaStats.find(jogo => jogo.name === nomeDoJogoProcurado);

    if (jogoEncontrado) {
        jogoEncontrado.status = statusClass;

        if (statusClass === "zerado") {
            const dataAtual = new Date();
            jogoEncontrado.completeDate = dataAtual.toLocaleDateString('pt-BR');
        } else {
            delete jogoEncontrado.completeDate; 
        }
        
        await window.electronAPI.json.save(CAMPAIGNS_FILE, listaStats);
        console.log(`Status de ${game} atualizado com sucesso!`);
        return true;
    } else {
        console.warn("Jogo não encontrado na lista.");
        return false;
    }
}
async function updateAchieJSON(game, statusClass) {
    const stats = await loadStatusAchie();

    const listStats = Array.isArray(stats) ? stats : (stats.games || []);

    const nomeDoJogoProcurado = game;
    const novoStatus = statusClass;

    const gameFoundAchie = listStats.find(jogo => jogo.name === nomeDoJogoProcurado);

    if (gameFoundAchie) {
        gameFoundAchie.achieStatus = statusClass;

        if (statusClass === "platinado") {
            const dateNow = new Date();
            gameFoundAchie.completeDate = dateNow.toLocaleDateString('pt-BR');
        }
        
        await window.electronAPI.json.save(ACHIEVEMENTS_FILE, listStats);
        console.log(`Status de ${game} atualizado com sucesso!`);
        return true;
    } else {
        console.warn("Jogo não encontrado na lista.");
        return false;
    }
}

const options = document.querySelector('.campaign-status-change');

statusBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (options.style.display === 'none') {
        options.style.display = 'flex';
        optionsAchie.style.display = 'none';
    } else {
        options.style.display = 'none';
    }
});

document.addEventListener('click', (event) => {
    if (!options.contains(event.target) && event.target !== statusBtn) {
        options.style.display = 'none';
    }
});

const optionAjogar = document.querySelector('.option-ajogar');
const optionJogando = document.querySelector('.option-jogando');
const optionZerado = document.querySelector('.option-zerado');

optionAjogar.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');

    await updateStatusJSON(game, "ajogar")
    updateStatus(statusText, "ajogar", "À Jogar")
    await loadGames();
})
optionJogando.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');

    await updateStatusJSON(game, "jogando")
    updateStatus(statusText, "jogando", "Jogando")
    await loadGames();
})
optionZerado.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');

    await updateStatusJSON(game, "zerado")
    updateStatus(statusText, "zerado", "Zerado")
    await loadGames();
})
const optionsAchie = document.querySelector('.achie-status-change');
const optionAplatinar = document.querySelector('.option-aplatinar');
const optionPlatinando = document.querySelector('.option-platinando');
const optionPlatinado = document.querySelector('.option-platinado');

achieBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (optionsAchie.style.display === 'none') {
        optionsAchie.style.display = 'flex';
        options.style.display = 'none';
    } else {
        optionsAchie.style.display = 'none';
    }
});

document.addEventListener('click', (event) => {
    if (!optionsAchie.contains(event.target) && event.target !== achieBtn) {
        optionsAchie.style.display = 'none';
    }
});

optionAplatinar.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.achie-status-tag');

    optionsAchie.style.display = 'none';
    
    await updateAchieJSON(game, "aplatinar")
    updateAchie(statusText, "aplatinar", "À Platinar")
    await loadGames();
    await loadGamesAchie();
})
optionPlatinando.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.achie-status-tag');

    optionsAchie.style.display = 'none';
    
    await updateAchieJSON(game, "platinando")
    updateAchie(statusText, "platinando", "Platinando")
    await loadGames();
    await loadGamesAchie();
})
optionPlatinado.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.achie-status-tag');

    optionsAchie.style.display = 'none';

    await updateAchieJSON(game, "platinado")
    updateAchie(statusText, "platinado", "Platinado")
    await loadGames();
    await loadGamesAchie();
})

function updateStatus(element, statusClass, text) {
    element.textContent = text;
    element.classList.remove('ajogar', 'jogando', 'zerado');
    if (statusClass) {
        element.classList.add(statusClass);
    }
}

function updateAchie(element, statusClass, text) {
    element.textContent = text;
    element.classList.remove('platinado', 'platinando', 'aplatinar');
    if (statusClass) {
        element.classList.add(statusClass);
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
        document.querySelector('#featured-title').innerHTML = `Jogando no momento<i class="fa-solid fa-gamepad"></i>`;
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
        img.style.backgroundImage = `url(assets://${code}.jpg)`;
        titleEl.innerHTML = `Fortnite BR — Edição rápida<i class="fa-solid fa-square-poll-horizontal"></i>`;
        document.querySelector('.shine-effect-v-latest-season').style.display = 'none'
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
    if (levelsText) levelsText.textContent = `Progresso - ${((data.levels / 200) * 100).toFixed(1)}%`
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

async function loadGamesTags() {
    const finishedCount = await window.api.games.finishedCount();
    const achieCount = await window.api.games.achieCount();

    const finished = document.getElementById('games-zerados');
    const achie = document.getElementById('games-platinados');

    finished.textContent = `${finishedCount} Zerados`;
    achie.textContent = `${achieCount} Platinados`;
}

loadGamesTags()

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
    try {
        const assetDir = await window.api.load('assets://');
        const seasons = await window.api.fortnite.getSeasons();

        const latest = getLatestSeason(seasons);

        if (!latest) return;

        const latestPathLobby = `assets://${latest.key}-lobby.jpg`;
        const latestPath = `assets://${latest.key}.jpg`;

        console.log(`Temporada mais recente do Fortnite: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);

        const banner = document.getElementById("latestSeasonBG");
        if (banner && latestPath) { banner.style.backgroundImage = `url('${latestPath}')`}

    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

loadLatestFN();