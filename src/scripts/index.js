async function updateNoteCount() {
  const count = await window.api.notes.count();
  const el = document.getElementById("note-count");

  if (el) {
    el.textContent = `${count} Notas`;
  }
}

const startingScreen = document.getElementById('starting-screen');

const loadingDetails = document.getElementById('loading-details');
const progressBarFill = document.getElementById('progress-bar-fill');

window.addEventListener('load', async () => {
    const isReady = await window.electronAPI.checkAssetsStatus();
    
    if (!startingScreen) return;

    if (isReady) {
        startingScreen.style.display = 'none';
    } else {
        startingScreen.style.display = 'flex';
        startingScreen.classList.remove('hidden');
    }
});

window.electronAPI.onAssetsProgress((() => {
    let lastUpdate = 0;

    return (data) => {
        const now = Date.now();
        if (now - lastUpdate < 200) return;
        lastUpdate = now;

        const mb = (data.downloaded / 1024 / 1024).toFixed(1);
        const totalMb = data.total ? (data.total / 1024 / 1024).toFixed(1) : '?';

        loadingDetails.textContent = `Baixando ${data.package} (${data.percent ?? '...'}%) — ${mb} MB / ${totalMb} MB`;

        if (data.percent !== null) {
            progressBarFill.style.width = `${data.percent}%`;
        }
    };
})());

window.electronAPI.onAssetsReady(() => {
    document.getElementById('loading-title').textContent = "Tudo pronto!";
    loadingDetails.textContent = "";
    progressBarFill.style.width = "100%";
    
    setTimeout(() => {
        startingScreen.style.opacity = "0";
        setTimeout(() => {
            startingScreen.style.display = "none";
        }, 500);
    }, 500);
});

window.electronAPI.onAssetsError((errorMsg) => {
    loadingDetails.textContent = `${errorMsg}`;
    loadingDetails.style.color = "var(--red)";
    document.querySelector('.shine-effect').style.display = 'none';
    progressBarFill.style.width = '100%';
    progressBarFill.style.backgroundColor = "var(--red)";
    
    setTimeout(() => {
        startingScreen.style.opacity = "0";
        setTimeout(() => { startingScreen.style.display = "none"; }, 500);
    }, 3000);
});

async function loadFortniteStats() {
  try {
    const data = await window.electronAPI.json.load('Fortnite/reviews.json');

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

document.addEventListener('DOMContentLoaded', async () => {
  const versao = await window.api.getAppVersion();
  
  const elementoVersao = document.getElementById('app-version');
  if (elementoVersao) {
    elementoVersao.innerText = `v${versao}`;
  }
});

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
});

window.onload = function () {
    const loadingScreen = document.getElementById('loading-screen');
    
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        
        setTimeout(() => {
            loadingScreen.remove();
        }, 200);
    }
};