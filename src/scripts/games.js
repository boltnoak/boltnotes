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

    for (const game of playing) {
        const card = await createGameCard(game, true);
        playingNow.appendChild(card);
    }

    if (playingNow.childElementCount === 0) {
        const noGames = document.createElement("div");
        noGames.className = "playingNow-no-games";
        noGames.textContent = "Nenhum jogo sendo jogado.";
        playingNow.appendChild(noGames);
    }

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

    img.src = localPath ? `file://${localPath}` : 'assets://placeholder.png';
    
    const gameInfo = document.createElement("div");
    gameInfo.className = "game-info";

    const title = document.createElement("p");
    title.className = "game-title";

    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-div';

    const status = (game.status || "").toLowerCase().trim();

    const tag = document.createElement("span");
    tag.className = "status";

    const rating = document.createElement("span");
    rating.className = "rating";

    const tagFill = document.createElement("span");
    tagFill.className = "status-fill";
    tagFill.style.width = (game.storyProgress || 0) + "%";

    gameInfo.appendChild(title);
    gameInfo.appendChild(rating);
    gameInfo.appendChild(statusDiv);

    const ratingUnderlineOpacity = '70%,transparent'
    if (game.rating >= 0) {
        rating.textContent = 'Horrivél';
        rating.style.color = 'var(--red)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--red-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 2) {
        rating.textContent = 'Ruim';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--red-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 4) {
        rating.textContent = 'Ok';
        rating.style.color = 'var(--orange)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--orange-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 6) {
        rating.textContent = 'Bom';
        rating.style.color = 'var(--blue)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--blue-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 7) {
        rating.textContent = 'Muito bom';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--blue-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating >= 8) {
        rating.textContent = 'Ótimo';
        rating.style.color = 'var(--green-light)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--green-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating == 10) {
        rating.textContent = 'Excelente';
        rating.style.color = 'var(--yellow)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--yellow-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating <= "") {
        rating.textContent = 'Sem nota';
        rating.style.color = 'var(--text-dark-gray)';
        rating.style.textDecoration = 'none';
    }

    if (status === "jogando") tag.classList.add("jogando");
    else if (status === "zerado") tag.classList.add("zerado");
    else if (status === "ajogar") tag.classList.add("ajogar");
    else if (status === "wishlist") tag.classList.add("wishlist");

    if (status === "jogando") {
        const statusPercentage = document.createElement("span");
        statusPercentage.className = "jogando-text";
        statusPercentage.textContent = `Progresso: ${(game.storyProgress || 0)}%`;
        statusDiv.appendChild(statusPercentage);
        statusDiv.appendChild(tag);
    }

    title.textContent = game.name;

    const listElement = document.getElementById("view-games");
    const isListView = listElement ? listElement.classList.contains("list") : false;

    if (completedIndex !== null && isListView) {
        const index = document.createElement("span");
        index.className = "sort-number";
        index.textContent = `#${completedIndex}`;
        title.prepend(index);
    }

    if (status === "zerado") {
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.textContent = game.completeDate || "";
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('zerado')
    } else if (status === "ajogar") {
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.textContent = `A Jogar (${game.storyProgress || 0}%)`;
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('ajogar')
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
let cachedCampaignStatus = null;
let cachedAchieStatus = null;

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

async function loadGamesAchie() {
    const data = await window.electronAPI.json.load(FILE);
    const stats = await loadStatusAchie();

    const list = document.getElementById("view-achie");

    if (!list) return;

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

        if (currentStatus === "platinado" || currentStatus === "platinando" || hasProgress) {
            combinedGame.isPreOrder = false;
        }
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

                    if (gameDate.getTime() > hoje.getTime()) {
                        combinedGame.isPreOrder = true;
                    }
                }
            }
        }

        return combinedGame;
    });

    const sort = document.getElementById("realSorting-options")?.value || "date-recent";
    let others = games.filter(g => (g.status || "").toLowerCase().trim());

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
        const order = { "platinando": 0, "aplatinar": 1, "platinado": 2 };
        others.sort((a, b) => {
            const sa = (a.status || "").toLowerCase().trim();
            const sb = (b.status || "").toLowerCase().trim();
            return (order[sa] !== undefined ? order[sa] : 99) - (order[sb] !== undefined ? order[sb] : 99);
        });
    } else {
        const order = { "platinando": 0, "platinado": 1 };
        others.sort((a, b) => {
            const sa = (a.status || "").toLowerCase().trim();
            const sb = (b.status || "").toLowerCase().trim();
            return (order[sa] !== undefined ? order[sa] : 99) - (order[sb] !== undefined ? order[sb] : 99);
        });
    }

    const completedMap = new Map(
        games
            .filter(g => (g.status || "").toLowerCase() === "platinado")
            .sort((a, b) => parseBRDate(a.completeDate) - parseBRDate(b.completeDate))
            .map((g, i) => [g.appid || g.name, i + 1])
    );

    for (const game of others) {
        const index = completedMap.get(game.appid || game.name) || null;
        const card = await createGameAchieCard(game, index);
        list.appendChild(card);
    }
}
async function createGameAchieCard(game, completedIndex = null) {
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
    if (game.hasAchievements === false) {
        div.classList.add("no-achie");
    }

    img.src = localPath ? `file://${localPath}` : 'assets://placeholder.png';
    
    const gameInfo = document.createElement("div");
    gameInfo.className = "game-info";

    const title = document.createElement("p");
    title.className = "game-title";

    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-div';

    const status = (game.status || "").toLowerCase().trim();

    const tag = document.createElement("span");
    tag.className = "status";

    const tagFill = document.createElement("span");
    tagFill.className = "status-fill";
    const percentage = game.totalAchievements > 0 
        ? Math.round((game.unlockedAchievements / game.totalAchievements) * 100) 
        : 0;

    tagFill.style.width = percentage + "%";

    gameInfo.appendChild(title);
    gameInfo.appendChild(statusDiv);

    if (status === "platinando") tag.classList.add("platinando");
    else if (status === "platinado") tag.classList.add("platinado");
    else if (status === "aplatinar") tag.classList.add("aplatinar");

    if (status === "platinando") {
        const statusText = document.createElement("span");
        statusText.className = "platinando-text";
        statusText.textContent = `Platinando - ${game.unlockedAchievements}/${game.totalAchievements}`;
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('platinando');
    }

    title.textContent = game.name;

    const listElement = document.getElementById("view-achie");
    const isListView = listElement ? listElement.classList.contains("list") : false;

    if (completedIndex !== null && isListView) {
        const index = document.createElement("span");
        index.className = "sort-number";
        index.textContent = `#${completedIndex}`;
        title.prepend(index);
    }

    if (status === "platinado") {
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.textContent = game.completeDate || "";
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('platinado')
    } else if (status === "aplatinar") {
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.textContent = `À Platinar - ${game.unlockedAchievements || 0}/${game.totalAchievements}`;
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('aplatinar')
    }

    tag.appendChild(tagFill);
    div.appendChild(img);
    div.appendChild(gameInfo);
    return div;
}

async function loadStatusAchie() {
    if (cachedAchieStatus) {
        return cachedAchieStatus;
    }
    try {
        const content = await window.electronAPI.json.load(`Games/achievements.json`);
        cachedAchieStatus = content || {};
        return cachedAchieStatus;
    } catch (e) {
        console.error("Erro ao ler achievements.json:", e);
        return {};
    }
}

const steamDbBtn = document.querySelector('.steamdb-btn');
steamDbBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const url = steamDbBtn.getAttribute('href');
    if (url) {
      window.api.openLink(url); 
    }
});

const gameList = document.getElementById("view-games");
const achieList = document.getElementById("view-achie");
const viewGridBtn = document.getElementById("view-grid");
const viewListBtn = document.getElementById("view-list");
const achievementsBtn = document.querySelector(".mode-btn.achievements");
const campaignBtn = document.querySelector(".mode-btn.campaign");
const viewGames = document.getElementById("view-games");
const viewAchie = document.getElementById("view-achie");

function toggleViewMode(mode) {
    const isGrid = mode === 'grid';

    viewGridBtn.classList.toggle('active', isGrid);
    viewListBtn.classList.toggle('active', !isGrid);

    if (campaignBtn.classList.contains('active')) {
        gameList.classList.remove(isGrid ? 'list' : 'grid');
        gameList.classList.add(mode);
        loadGames();
    }
    if (achievementsBtn.classList.contains('active')) {
        achieList.classList.remove(isGrid ? 'list' : 'grid');
        achieList.classList.add(mode);
        loadGamesAchie();
    }
}
function switchMainView(targetView) {
    const isCampaign = targetView === 'campaign';

    viewGames.classList.toggle('active', isCampaign);
    viewAchie.classList.toggle('active', !isCampaign);

    campaignBtn.classList.toggle('active', isCampaign);
    achievementsBtn.classList.toggle('active', !isCampaign);

    const currentMode = viewGridBtn.classList.contains('active') ? 'grid' : 'list';
    toggleViewMode(currentMode);
}

viewGridBtn.addEventListener("click", () => toggleViewMode('grid'));
viewListBtn.addEventListener("click", () => toggleViewMode('list'));
campaignBtn.addEventListener("click", () => switchMainView('campaign'));
achievementsBtn.addEventListener("click", () => switchMainView('achievements'));

loadGames();
loadGamesAchie();

document.getElementById("realSorting-options").addEventListener("change", () => {
    const campaignBtn = document.querySelector(".mode-btn.campaign");
    if (campaignBtn.classList.contains('active')) {
        loadGames();
    } else {
        loadGamesAchie();
    }
});

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