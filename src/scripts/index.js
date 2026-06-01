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
    
    if (isReady) {
        document.getElementById('starting-screen').style.display = 'none';
    } else {
        document.getElementById('starting-screen').style.display = 'flex';
    }
});

window.electronAPI.onAssetsProgress((data) => {
    loadingDetails.textContent = `Baixando ${data.package} (${data.percent}%) (${mb} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`;
    
    if (data.percent !== null) {
        progressBarFill.style.width = `${data.percent}%`;
    }
});

window.electronAPI.onAssetsReady(() => {
    loadingDetails.textContent = "Tudo pronto!";
    progressBarFill.style.width = "100%";
    
    setTimeout(() => {
        startingScreen.style.opacity = "0";
        setTimeout(() => {
            startingScreen.style.display = "none";
        }, 500);
    }, 500);
});

window.electronAPI.onAssetsError((errorMsg) => {
    loadingDetails.textContent = `Erro ao baixar arquivos: ${errorMsg}`;
    loadingDetails.style.color = "#ff4444";
    progressBarFill.style.backgroundColor = "#ff4444";
    
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

async function loadGamesStats() {
  try {
    const res = await fetch(`documents://Games/status.json`);
    
    if (!res.ok) {
      throw new Error(`Erro ao carregar: ${res.status}`);
    }

    const data = await res.json();

    const lista = Array.isArray(data) ? data : (data.games || []);

    const totalZerados = lista.filter(g =>
      (g.status || "").toLowerCase().trim() === "zerado"
    ).length;

    const elemento = document.getElementById("games-zerados");
    if (elemento) {
      elemento.textContent = `${totalZerados} Zerados`;
    }
  } catch (err) {
    console.error("Não foi possível carregar os status dos jogos:", err);
    document.getElementById("games-zerados").textContent = "0 Zerados";
  }
}

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
    const list = document.getElementById("view-games");

    if (!playingNow || !list) return;

    playingNow.innerHTML = "";
    list.innerHTML = "";

    // 1. Pega as suas duas listas
    let listaStats = Array.isArray(stats) ? stats : (stats.games || []);
    const dbGames = data.games ? [...data.games] : [];

    // ==========================================
    // 2. A NOVA LÓGICA DE MESCLAGEM
    // ==========================================
    // Agora nós percorremos a SUA lista pessoal, ignorando os jogos do DB que você não tem.
    let games = listaStats.map(localGame => {
        // Procura no DB global se existe a "ficha" desse jogo para pegar a capa e o appid oficial
        const gameNoDB = dbGames.find(g => 
            (localGame.appid && g.appid === localGame.appid) || 
            (localGame.name && g.name.toLowerCase() === localGame.name.toLowerCase())
        ) || {};

        // Retorna o seu jogo com as informações extras da nuvem (como a capa)
        return {
            ...gameNoDB,    // Traz: appid, cover (da nuvem, se existir)
            ...localGame    // Traz: name, status, rating, completeDate, storyProgress (do seu PC)
        };
    });

    // ==========================================
    // 3. DAQUI PARA BAIXO O CÓDIGO CONTINUA IGUAL
    // ==========================================
    const sort = document.getElementById("realSorting-options")?.value || "date-recent";

    const playing = games.filter(g => (g.status || "").toLowerCase().trim() === "jogando");
    let others = games.filter(g => (g.status || "").toLowerCase().trim() !== "jogando");

    // Lógica de Ordenação
    if (sort === "date-recent") {
        others.sort((a, b) => parseBRDate(b.completeDate) - parseBRDate(a.completeDate));
    } else if (sort === "date-old") {
        others.sort((a, b) => parseBRDate(a.completeDate) - parseBRDate(b.completeDate));
    } else if (sort === "rating-high") {
        others.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "rating-low") {
        others.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    }

    const isGrid = list.classList.contains("grid");

    if (isGrid) {
        const order = { "ajogar": 0, "zerado": 1 };
        others.sort((a, b) => {
            const sa = (a.status || "").toLowerCase().trim();
            const sb = (b.status || "").toLowerCase().trim();
            return (order[sa] !== undefined ? order[sa] : 99) - (order[sb] !== undefined ? order[sb] : 99);
        });
    }

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

    // Renderiza o resto
    for (const game of others) {
        const index = completedMap.get(game.appid || game.name) || null;
        const card = await createGameCard(game, false, index);
        list.appendChild(card);
    }
}

async function createGameCard(game, isPlaying = false, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";

    const img = document.createElement("img");
    img.className = "game-cover";

    // O await aqui garante que a capa seja carregada do disco antes de renderizar
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

    const status = (game.status || "").toLowerCase().trim();

    const tag = document.createElement("span");
    tag.className = "status";

    const tagFill = document.createElement("span");
    tagFill.className = "status-fill";
    tagFill.style.width = (game.storyProgress || 0) + "%";

    // Adiciona a classe de cor apropriada
    if (status === "jogando") tag.classList.add("jogando");
    else if (status === "zerado") tag.classList.add("zerado");
    else if (status === "ajogar") tag.classList.add("ajogar");
    else if (status === "wishlist") tag.classList.add("wishlist");

    // Se estiver jogando, mostra a porcentagem na tag
    if (status === "jogando") {
        const statusPercentage = document.createElement("span");
        statusPercentage.className = "status-percentage";
        statusPercentage.textContent = (game.storyProgress || 0) + "%";
        tag.appendChild(statusPercentage);
    }

    title.textContent = game.name;

    // Lógica para mostrar o número (Index) no modo Lista
    const listElement = document.getElementById("view-games");
    const isListView = listElement ? listElement.classList.contains("list") : false;

    if (completedIndex !== null && isListView && !isPlaying) {
        const index = document.createElement("span");
        index.className = "sort-number";
        index.textContent = `#${completedIndex} `;
        title.prepend(index);
    }

    gameInfo.appendChild(title);

    // Lógica de texto complementar do status
    if (status === "zerado") {
        tag.textContent = game.completeDate || "";
        gameInfo.appendChild(tag);
    } else if (status === "ajogar") {
        const statusText = document.createElement("span");
        statusText.className = "ajogar-text";
        statusText.textContent = `A Jogar (${game.storyProgress || 0}%)`;
        gameInfo.appendChild(statusText);
        gameInfo.appendChild(tag);
    } else {
        // Se for "jogando" ou "wishlist", mantém o texto base
        if (status !== "jogando") tag.textContent = game.status;
        gameInfo.appendChild(tag);
    }
    
    // Adiciona a barra de progresso dentro da tag
    tag.appendChild(tagFill);

    div.appendChild(img);
    div.appendChild(gameInfo);

    return div;
}

let cachedGamesDB = null;
let cachedStatus = null;

async function loadStatus() {
    if (cachedStatus) {
        console.log("Reviews carregados do cache!");
        return cachedStatus;
    }
    try {
        const content = await window.electronAPI.json.load(`documents://Games/status.json`);
        cachedStatus = content || {};
        return cachedStatus;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}

updateNoteCount();
// loadGames();
// loadGamesStats();
loadFortniteStats();

document.addEventListener('DOMContentLoaded', async () => {
  const versao = await window.api.getAppVersion();
  
  const elementoVersao = document.getElementById('app-version');
  if (elementoVersao) {
    elementoVersao.innerText = `v${versao}`;
  }
});