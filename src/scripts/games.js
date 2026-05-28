function parseBRDate(dateStr) {
  if (!dateStr || !dateStr.includes("/")) return 0;

  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
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
        const content = await window.electronAPI.json.load(`Games/status.json`);
        cachedStatus = content || {};
        return cachedStatus;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}



// document.getElementById("add-game").addEventListener("click", async () => {
//   const name = document.getElementById("game-name").value;
//   const status = document.getElementById("game-status").value;

//   if (!name) return;

//   await window.api.games.add({
//     name,
//     status,
//     platform: "PC",
//     rating: 0,
//     notes: "",
//     completeDate: ""
//   });

//   loadGames();
// });
async function addNewGameToLibrary(gameName) {
    const globalDB = await loadGamesDB();
    let localStats = await loadStatus();

    let listaStats = Array.isArray(localStats) ? localStats : (localStats.games || []);

    const alreadyExists = listaStats.find(g => g.name.toLowerCase() === gameName.toLowerCase());
    if (alreadyExists) {
        alert("Você já tem esse jogo na sua biblioteca!");
        return;
    }

    const gameInDB = globalDB.games.find(g => g.name.toLowerCase() === gameName.toLowerCase());
    if (!gameInDB) {
        alert("Jogo não encontrado no Banco Global. Adicione no Gist primeiro!");
        return;
    }

    const newGameProfile = {
        name: gameInDB.name,
        appid: gameInDB.appid,
        status: "ajogar",
        rating: 0,
        completeDate: "",
        storyProgress: 0
    };

    listaStats.push(newGameProfile);

    await window.api.saveStatus(listaStats);

    await loadGames();
    alert(`${gameInDB.name} foi adicionado à sua biblioteca!`);
}

const gameList = document.getElementById("view-games");
const viewGridBtn = document.getElementById("view-grid");
const viewListBtn = document.getElementById("view-list");

viewGridBtn.addEventListener("click", () => {
  gameList.classList.remove("list");
  gameList.classList.add("grid");
  viewGridBtn.style.background = 'rgba(50, 50, 50, 0.4)';
  viewListBtn.style.background = 'rgba(20, 20, 20, 0.4)';
});

viewListBtn.addEventListener("click", () => {
  gameList.classList.remove("grid");
  gameList.classList.add("list");
  viewListBtn.style.background = 'rgba(50, 50, 50, 0.4)';
  viewGridBtn.style.background = 'rgba(20, 20, 20, 0.4)';
});

document.getElementById("realSorting-options")
  .addEventListener("change", loadGames);

document.getElementById('view-games').classList.add('grid');
loadGames();

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.sorting-options');
    const trigger = container.querySelector('.sortingOptions-trigger');
    const triggerText = trigger.querySelector('span');
    const triggerIcon = trigger.querySelector('i');
    const options = container.querySelectorAll('.sortingOptions-select li');
    const realSelect = document.getElementById('realSorting-options');

    trigger.addEventListener('click', (e) => {
        container.classList.toggle('open');

      if (triggerIcon.className == "fa-solid fa-angle-down") {
        triggerIcon.className = 'fa-solid fa-angle-up';
      } else {
        triggerIcon.className = 'fa-solid fa-angle-down';
      }

        e.stopPropagation();
    });

    options.forEach(option => {
        option.addEventListener('click', function() {
            const val = this.getAttribute('data-value');
            const text = this.textContent;

            triggerText.textContent = text;

            realSelect.value = val;

            realSelect.dispatchEvent(new Event('change'));

            options.forEach(li => li.classList.remove('selected'));
            this.classList.add('selected');

            container.classList.remove('open');
            triggerIcon.className = 'fa-solid fa-angle-up';
        });
    });

    

    document.addEventListener('click', () => {
        container.classList.remove('open');
        triggerIcon.className = 'fa-solid fa-angle-down';
    });
});

document.getElementById('playingNowSection-toggle').className = "fa-solid fa-angle-down";
document.querySelector('.playingNow-panel').style.display = "none";

const playingNowTitle = document.getElementById('playingNowSection-title');

playingNowTitle.addEventListener('click', () => {
  const toggle = document.getElementById('playingNowSection-toggle');
  const platingNow = document.querySelector('.playingNow-panel');
  const view = document.getElementById('view-games');

  if (toggle.className === "fa-solid fa-angle-up") {
    toggle.className = "fa-solid fa-angle-down";
    platingNow.style.display = "none";
  } else {
    toggle.className = "fa-solid fa-angle-up";
    platingNow.style.display = "flex";
  } 
});