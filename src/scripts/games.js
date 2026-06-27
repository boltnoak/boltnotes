const FILE = "Games/games.json";

function parseBRDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
}

async function loadGames() {
    const data = await window.electronAPI.json.load(FILE);
    const stats = await loadStatus();

    const playingNow = document.querySelector(".playingNow-panel");
    const list = document.getElementById("view-games");

    if (!playingNow || !list) return;

    playingNow.innerHTML = "";
    list.innerHTML = "";

    let listaStats = Array.isArray(stats) ? stats : (stats.games || []);
    const dbGames = data.games ? [...data.games] : [];

    let games = listaStats.map(localGame => {
        const gameNoDB = dbGames.find(g => 
            (localGame.appid && g.appid === localGame.appid) || 
            (localGame.name && g.name.toLowerCase() === localGame.name.toLowerCase())
        ) || {};

        const combinedGame = {
            ...gameNoDB,
            ...localGame
        };

        combinedGame.isPreOrder = false;

        const currentStatus = (combinedGame.status || "").toLowerCase().trim();
        const hasProgress = (combinedGame.storyProgress || 0) > 0;

        // Se o jogo já tem status ativo ou progresso, ele NUNCA é pré-venda
        if (currentStatus === "zerado" || currentStatus === "jogando" || hasProgress) {
            combinedGame.isPreOrder = false;
        } 
        // Só analisa a data se ela existir e for no formato correto com barras
        else if (combinedGame.releaseDate && combinedGame.releaseDate.includes("/")) {
            const parts = combinedGame.releaseDate.split('/');
            
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);

                const gameDate = new Date(y, m, d);
                
                if (!isNaN(gameDate.getTime())) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    gameDate.setHours(0, 0, 0, 0);

                    // SÓ FICA PRE-ORDER SE A DATA DO JOGO FOR DEPOIS DA DATA ATUAL (FUTURO)
                    if (gameDate.getTime() > hoje.getTime()) {
                        combinedGame.isPreOrder = true;
                    }
                }
            }
        }

        return combinedGame;
    });

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

    const localPath = await window.api.games.ensureCover({
        appid: game.appid,
        name: game.name,
        cover: game.cover
    });

    if (game.isPreOrder === true) {
        div.classList.add("pre-order");
    }

    img.src = localPath ? `file://${localPath}` : '';
    
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

    gameInfo.appendChild(title);

    // Adiciona a classe de cor apropriada
    if (status === "jogando") tag.classList.add("jogando");
    else if (status === "zerado") tag.classList.add("zerado");
    else if (status === "ajogar") tag.classList.add("ajogar");
    else if (status === "wishlist") tag.classList.add("wishlist");

    // Se estiver jogando, mostra a porcentagem na tag
    if (status === "jogando") {
        const statusPercentage = document.createElement("span");
        statusPercentage.className = "jogando-text";
        statusPercentage.textContent = `Progresso: ${(game.storyProgress || 0)}%`;
        gameInfo.appendChild(statusPercentage);
        gameInfo.appendChild(tag);
    }

    title.textContent = game.name;

    // Lógica para mostrar o número (Index) no modo Lista
    const listElement = document.getElementById("view-games");
    const isListView = listElement ? listElement.classList.contains("list") : false;

    if (completedIndex !== null && isListView) {
        const index = document.createElement("span");
        index.className = "sort-number";
        index.textContent = `#${completedIndex}`;
        title.prepend(index);
    }

    // Lógica de texto complementar do status
    if (status === "zerado") {
        const statusText = document.createElement("span");
        statusText.className = "zerado-text";
        statusText.textContent = game.completeDate || "";
        gameInfo.appendChild(statusText);
        gameInfo.appendChild(tag);
    } else if (status === "ajogar") {
        const statusText = document.createElement("span");
        statusText.className = "ajogar-text";
        statusText.textContent = `A Jogar (${game.storyProgress || 0}%)`;
        gameInfo.appendChild(statusText);
        gameInfo.appendChild(tag);
        div.classList.add('ajogarGame')
    } else {
        if (status !== "jogando") tag.textContent = game.status;
        gameInfo.appendChild(tag);
    }

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
        const content = await window.electronAPI.json.load(`Games/campaigns.json`);
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


const steamDbBtn = document.querySelector('.steamdb-btn');

steamDbBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const url = steamDbBtn.getAttribute('href');
    if (url) {
      window.api.openLink(url); 
    }
});

const gameList = document.getElementById("view-games");
const viewGridBtn = document.getElementById("view-grid");
const viewListBtn = document.getElementById("view-list");

viewGridBtn.addEventListener("click", () => {
  gameList.classList.remove("list");
  gameList.classList.add("grid");
  viewGridBtn.classList.add('active');
  viewListBtn.classList.remove('active');
});

viewListBtn.addEventListener("click", () => {
  gameList.classList.remove("grid");
  gameList.classList.add("list");
  viewGridBtn.classList.remove('active');
  viewListBtn.classList.add('active');
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

document.getElementById('steamdb-btn').addEventListener('click', () => {
    event.preventDefault(); 

    const gameNameInput = document.getElementById('gameName');
    const name = gameNameInput ? gameNameInput.value.trim() : '';

    if (!name) {
        alert('Por favor, digite o nome do jogo primeiro para pesquisar no SteamDB.');
        return;
    }

    const searchName = name.trim().replace(/ /g, '+');

    const searchBtn = document.getElementById('steamdb-btn');

    const url = `https://steamdb.info/search/?a=all&q=${searchName}`;

    window.api.openLink(url);
});

document.getElementById('addGameBtn').addEventListener('click', async () => {
    const nameInput = document.getElementById('gameName').value.trim();
    const appIdInput = document.getElementById('gameAppId').value.trim();

    if (!nameInput) {
        alert('AppID não definido.');
        return;
    }

    const newGame = {
        name: nameInput,
        appid: appIdInput ? parseInt(appIdInput) : null,
        releaseDate: "",
        developer: "",
        publisher: ""
    };

    const addBtn = document.getElementById('addGameBtn');
    addBtn.style.pointerEvents = 'none';
    addBtn.style.opacity = '0.25';

    if (newGame.appid) {
        const steamData = await window.api.games.getSteamData(newGame.appid);
        
        if (steamData) {
            newGame.releaseDate = steamData.releaseDate;
            newGame.developer = steamData.developer;
            newGame.publisher = steamData.publisher;
        }
    }

    const response = await window.api.games.addGame(newGame);

    if (response.success) {
        window.location.reload();
    } else {
        alert('Erro ao salvar o jogo: ' + response.error);
    }

    addBtn.style.pointerEvents = 'auto';
    addBtn.style.opacity = '1';
});