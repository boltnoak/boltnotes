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

const playingNowTitle = document.getElementById('playingNowSection-title');


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

// document.getElementById('playingNowSection-title').innerHTML = 'Temporada 3 - No Corre<i class="fa-solid fa-bars-progress"></i>'