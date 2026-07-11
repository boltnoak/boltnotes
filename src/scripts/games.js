const FILE = "Games/games.json";
const CAMPAIGNS_FILE = "Games/campaigns.json";
const ACHIEVEMENTS_FILE = "Games/achievements.json";


const panel = document.querySelector('.playingNow-panel');
const DISTANCIA_SCROLL = 67; 
panel.addEventListener('wheel', (e) => {
  e.preventDefault();

  if (e.deltaY > 0) {
    panel.scrollBy({
      top: DISTANCIA_SCROLL,
      behavior: 'smooth'
    });
  } else {
    panel.scrollBy({
      top: -DISTANCIA_SCROLL,
      behavior: 'smooth'
    });
  }
}, { passive: false });

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
    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(FILE),
        loadStatus()
    ]);

    const playingNow = document.querySelector(".playingNow-panel");
    const list = document.getElementById("view-games");
    if (!playingNow || !list) return;

    playingNow.innerHTML = "";
    list.innerHTML = "";

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
        const hasProgress = (combinedGame.storyProgress || 0) > 0;

        combinedGame.isPreOrder = false;
        combinedGame._status = status;
        combinedGame._completeMs = parseBRDate(combinedGame.completeDate)?.getTime?.() ?? NaN;

        if (status !== "zerado" && status !== "jogando" && !hasProgress && combinedGame.releaseDate?.includes("/")) {
            const parts = combinedGame.releaseDate.split("/");
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                const gameDate = new Date(y, m, d);
                if (!isNaN(gameDate.getTime())) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    gameDate.setHours(0, 0, 0, 0);
                    combinedGame.isPreOrder = gameDate.getTime() > hoje.getTime();
                }
            }
        }

        return combinedGame;
    });

    const sort = document.getElementById("realSorting-options")?.value || "date-recent";

    const playing = [];
    const others = [];

    for (const g of games) {
        if (g._status === "jogando") playing.push(g);
        else others.push(g);
    }

    if (sort === "date-recent") {
        others.sort((a, b) => (b._completeMs || 0) - (a._completeMs || 0));
    } else if (sort === "date-old") {
        others.sort((a, b) => (a._completeMs || 0) - (b._completeMs || 0));
    } else if (sort === "rating-high") {
        others.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "rating-low") {
        others.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    }

    if (list.classList.contains("grid")) {
        const order = { ajogar: 0, zerado: 1 };
        others.sort((a, b) => {
            const sa = a._status || "";
            const sb = b._status || "";
            return (order[sa] ?? 99) - (order[sb] ?? 99);
        });
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

    const otherCards = await Promise.all(
        others.map(game => {
            const index = completedMap.get(game.appid || game.name) || null;
            return createGameCard(game, false, index);
        })
    );

    const listFragment = document.createDocumentFragment();
    for (const card of otherCards) listFragment.appendChild(card);

    list.appendChild(listFragment);
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
    // tagFill.style.width = (game.storyProgress || 0) + "%";
    tagFill.style.width = "100%";

    gameInfo.appendChild(title);
    
    if (status != "jogando") {
        gameInfo.appendChild(rating);
        gameInfo.appendChild(statusDiv);
    }

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
        // const statusPercentage = document.createElement("span");
        // statusPercentage.className = "status-text";
        // statusPercentage.textContent = `Progresso: ${(game.storyProgress || 0)}%`;
        // statusDiv.appendChild(statusPercentage);
        // statusDiv.appendChild(tag);
        div.classList.add('jogando');
    }

    title.textContent = game.name;
    div.dataset.id = game.name;

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
        div.classList.add('zerado');
    } else if (status === "ajogar") {
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.textContent = `À Jogar`;
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('ajogar');
    }

    if (status != "jogando") {
        tag.appendChild(tagFill);
        div.appendChild(img);
    }
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

let cachedGamesDB = null;
let cachedCampaignStatus = null;
let cachedAchieStatus = null;

async function loadGamesDB() {
    if (cachedGamesDB) {
        return cachedGamesDB;
    }
    try {
        const content = await window.electronAPI.json.load(FILE);
        cachedGamesDB = content || {};
        return cachedGamesDB;
    } catch (e) {
        console.error("Erro ao ler campaigns.json:", e);
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

async function loadGamesAchie() {
    const [data, stats, cStatus] = await Promise.all([
        window.electronAPI.json.load(FILE),
        loadStatusAchie(),
        window.electronAPI.json.load(CAMPAIGNS_FILE)
    ]);

    const platinandoNow = document.querySelector(".platinandoNow-panel");
    const list = document.getElementById("view-achie");
    if (!platinandoNow || !list) return;

    platinandoNow.innerHTML = "";
    list.innerHTML = "";

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

        const status = (combinedGame.achieStatus || "").toLowerCase().trim();

        combinedGame.isPreOrder = false;
        combinedGame._achieStatus = status;
        combinedGame._completeMs = parseBRDate(combinedGame.completeDate)?.getTime?.() ?? NaN;

        if (status !== "platinado" && status !== "platinando" && combinedGame.releaseDate?.includes("/")) {
            const parts = combinedGame.releaseDate.split("/");
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                const gameDate = new Date(y, m, d);
                if (!isNaN(gameDate.getTime())) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    gameDate.setHours(0, 0, 0, 0);
                    combinedGame.isPreOrder = gameDate.getTime() > hoje.getTime();
                }
            }
        }

        return combinedGame;
    });

    const sort = document.getElementById("realSorting-options")?.value || "date-recent";

    const platinando = [];
    const others = [];

    for (const g of games) {
        if (g._achieStatus === "platinando") platinando.push(g);
        else others.push(g);
    }

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
            const sa = (a.achieStatus || "").toLowerCase().trim();
            const sb = (b.achieStatus || "").toLowerCase().trim();
            return (order[sa] !== undefined ? order[sa] : 99) - (order[sb] !== undefined ? order[sb] : 99);
        });
    } else {
        const order = { "platinando": 0, "platinado": 1 };
        others.sort((a, b) => {
            const sa = (a.achieStatus || "").toLowerCase().trim();
            const sb = (b.achieStatus || "").toLowerCase().trim();
            return (order[sa] !== undefined ? order[sa] : 99) - (order[sb] !== undefined ? order[sb] : 99);
        });
    }

    const platinadoMap = new Map(
        games
            .filter(g => (g.status || "").toLowerCase() === "platinando")
            .sort((a, b) => parseBRDate(a.completeDate) - parseBRDate(b.completeDate))
            .map((g, i) => [g.appid || g.name, i + 1])
    );

    const platinandoCards = await Promise.all(
        platinando.map(game => createGameAchieCard(game))
    );

    const platinandoFragment = document.createDocumentFragment();
    for (const card of platinandoCards) platinandoFragment.appendChild(card);

    if (platinandoFragment.childElementCount === 0) {
        const noGames = document.createElement("div");
        noGames.className = "platinandoNow-no-games";
        noGames.textContent = "Nenhum jogo sendo platinado.";
        platinandoFragment.appendChild(noGames);
    }

    platinandoNow.appendChild(platinandoFragment);

    const otherCards = await Promise.all(
        others.map(game => {
            const index = platinadoMap.get(game.appid || game.name) || null;
            return createGameAchieCard(game, index);
        })
    );

    const listFragment = document.createDocumentFragment();
    for (const card of otherCards) listFragment.appendChild(card);

    list.appendChild(listFragment);
}
async function createGameAchieCard(game, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";
    div.dataset.id = game.name;

    const img = document.createElement("img");
    img.className = "game-cover";

    const { cover: localPath } = await window.api.games.ensureCover({
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

    const status = (game.achieStatus || "").toLowerCase().trim();

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
        statusText.textContent = `${game.totalAchievements > 0 ? Math.round((game.unlockedAchievements / game.totalAchievements) * 100) : 0}%`;
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

    div.addEventListener('click', () => openGamePopup(div));

    return div;
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
        loadGamesAchie();
        loadGames();
    }
    if (achievementsBtn.classList.contains('active')) {
        achieList.classList.remove(isGrid ? 'list' : 'grid');
        achieList.classList.add(mode);
        loadGames();
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


document.getElementById('reload-btn').addEventListener('click', () => {
    window.location.reload();
});

const closeAddBtn = document.getElementById('addGame-close');
const addGamePopup = document.getElementById('addGame-popup');
const addGameOpenBtn = document.querySelector('.addGameOpen');

closeAddBtn.addEventListener('click', () => addGamePopup.style.display = 'none');
addGameOpenBtn.addEventListener('click', () => addGamePopup.style.display = 'flex');

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
async function changeAchieProgress(el, isAdd = true) {
    const title = el.dataset.id;
    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(ACHIEVEMENTS_FILE),
        loadStatusAchie()
    ]);

    const listaStats = Array.isArray(stats) ? stats : (stats.games || []);

    const nomeDoJogoProcurado = title;
    const jogoEncontrado = listaStats.find(jogo => jogo.name === nomeDoJogoProcurado);

    const game = jogoEncontrado;
    const achieCount = document.querySelector('.achie-info-title-numbers');

    const total = game.totalAchievements;
    const unlocked = game.unlockedAchievements;

    if (isAdd) {
        if (game.totalAchievements != game.unlockedAchievements) {
            game.unlockedAchievements = game.unlockedAchievements + 1;
            achieCount.textContent = `${unlocked + 1}/${total}`;
        } else return
    } else {
        game.unlockedAchievements = game.unlockedAchievements - 1;
        achieCount.textContent = `${unlocked - 1}/${total}`;
    }

    if (jogoEncontrado) {
        await window.electronAPI.json.save(ACHIEVEMENTS_FILE, listaStats);
        console.log(`Status de ${game} atualizado com sucesso!`);
        return true;
    } else {
        console.warn("Jogo não encontrado na lista.");
        return false;
    }

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
    const achieBtns = document.querySelector('.achie-add-minus');
    const achieAddBtn = document.getElementById('achie-add');
    const achieMinusBtn = document.getElementById('achie-minus');
    const completeDateText = document.querySelector('.game-popup-completeDate');
    const achieDiv = document.querySelector('.game-achievements');
    const campaignText = document.querySelector('.campaign-info-title-text');
    const ratingText = document.querySelector('.game-popup-rating');
    const achieSep = document.querySelector('.achie-sep');
    const campaignSep = document.querySelector('.campaign-sep');
    const campaignDiv = document.querySelector('.game-campaign-div');
    const ratingDiv = document.querySelector('.game-rating-div');
    
    achieAddBtn.setAttribute('data-id', title);
    achieMinusBtn.setAttribute('data-id', title);

    pubText.style.animation = '';
    devText.style.animation = '';
    achieStatusText.style.display = 'flex';

    let jogoEncontrado = null;
    let gameStatusFound = null;
    let fullGame = null;

    try {
        const games = await loadStatusAchie();
        const fullGamesData = await loadGamesDB();
        const fullGamesArray = Array.isArray(fullGamesData) ? fullGamesData : (fullGamesData.games || []);
        const gamesCamp = await loadStatus();

        jogoEncontrado = games.find(g => g.name === title) || {};
        fullGame = fullGamesArray.find(g => g.name === title) || {};
        gameStatusFound = gamesCamp.find(g => g.name === title) || {};
    } catch (erro) {
        console.error("Erro ao carregar o JSON:", erro);
        jogoEncontrado = {};
        fullGame = {};
        gameStatusFound = {};
    }

    const achieGame = jogoEncontrado;
    const gameCampaign = gameStatusFound;
    const fullGamess = fullGame;

    banner.src = `appdata:///game-heros/${name}.jpg`;
    const logoExists = await window.electronAPI.existsAppdata(`game-logos/${name}.png`);
    if (logoExists) {
        logo.src = `appdata:///game-logos/${name}.png`;
    } else {
        logo.src = '';
    }
    logo.alt = el.dataset.id;
    devText.textContent = fullGamess.developer || "Erro";
    pubText.textContent = fullGamess.publisher || "Erro";
    releaseDateText.textContent = fullGamess.releaseDate || "Erro";
    completeDateText.textContent = gameCampaign.completeDate || "";
    ratingText.textContent = Number(gameCampaign.rating).toFixed(1);

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
        achieStatusText.style.display = 'flex';
        achieBtns.style.display = 'flex';
        achieDiv.style.display = 'flex';
        achieSep.style.display = 'block';
    } else {
        achieTitle.style.display = 'none';
        achieInfo.style.display = 'none';
        achieStatusText.style.display = 'none';
        achieBtns.style.display = 'none';
        achieDiv.style.display = 'none';
        achieSep.style.display = 'none';
    }

    if (gameCampaign.status.toLowerCase() == 'zerado') {
        updateStatus(statusText, 'zerado', 'Zerado');
        campaignText.textContent = 'ZERADO';
        campaignText.classList.remove('ajogar');
        campaignText.classList.remove('jogando');
        campaignText.classList.add('zerado');
        campaignSep.style.display = 'block';
        campaignDiv.style.display = 'flex';
        ratingDiv.style.display = 'flex';
    }
    if (gameCampaign.status.toLowerCase() == 'jogando') {
        updateStatus(statusText, 'jogando', 'Jogando');
        campaignText.classList.remove('ajogar');
        campaignText.classList.add('jogando');
        campaignText.classList.remove('zerado');
        campaignSep.style.display = 'none';
        achieSep.style.display = 'none';
        campaignDiv.style.display = 'none';
        ratingDiv.style.display = 'none';
    }
    if (gameCampaign.status.toLowerCase() == 'ajogar') {
        updateStatus(statusText, 'ajogar', 'À Jogar');
        campaignText.classList.add('ajogar');
        campaignText.classList.remove('jogando');
        campaignText.classList.remove('zerado');
        campaignSep.style.display = 'none';
        achieSep.style.display = 'none';
        campaignDiv.style.display = 'none';
        ratingDiv.style.display = 'none';
    }
    if (achieGame.achieStatus.toLowerCase() == 'platinado') {
        updateAchie(achieStatusText, 'platinado', 'Platinado');
        achieBtns.style.display = 'none';
    }
    if (achieGame.achieStatus.toLowerCase() == 'platinando') {
        updateAchie(achieStatusText, 'platinando', 'Platinando');
        achieBtns.style.display = 'flex';
    }
    if (achieGame.achieStatus.toLowerCase() == 'aplatinar') {
        updateAchie(achieStatusText, 'aplatinar', 'À Platinar');
        achieBtns.style.display = 'none';
    }

    if (jogoEncontrado && jogoEncontrado.achieStatus) {
        const achieStatus = jogoEncontrado.achieStatus.toLowerCase();

        if (achieStatus === 'platinado')  updateAchie(achieStatusText, 'platinado', 'Platinado');
        if (achieStatus === 'platinando') updateAchie(achieStatusText, 'platinando', 'Platinando');
        if (achieStatus === 'aplatinar')  updateAchie(achieStatusText, 'aplatinar', 'À Platinar');
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

// const gamePopup = document.querySelector('.game-popup');
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
const optionAjogar = document.querySelector('.option-ajogar');
const optionJogando = document.querySelector('.option-jogando');
const optionZerado = document.querySelector('.option-zerado');

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

optionAjogar.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');
    const campaignText = document.querySelector('.campaign-info-title-text');
    const campaignSep = document.querySelector('.campaign-sep');
    const achieSep = document.querySelector('.achie-sep');
    const campaignDiv = document.querySelector('.game-campaign-div');
    const ratingDiv = document.querySelector('.game-rating-div');

    options.style.display = 'none';
    campaignText.classList.add('ajogar');
    campaignText.classList.remove('jogando');
    campaignText.classList.remove('zerado');
    campaignSep.style.display = 'none';
    achieSep.style.display = 'none';
    campaignDiv.style.display = 'none';
    ratingDiv.style.display = 'none';
    
    await updateStatusJSON(game, "ajogar");
    updateStatus(statusText, "ajogar", "À Jogar");
    await loadGames();
})
optionJogando.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');
    const campaignText = document.querySelector('.campaign-info-title-text');
    const campaignSep = document.querySelector('.campaign-sep');
    const achieSep = document.querySelector('.achie-sep');
    const campaignDiv = document.querySelector('.game-campaign-div');
    const ratingDiv = document.querySelector('.game-rating-div');

    options.style.display = 'none';
    campaignText.classList.remove('ajogar');
    campaignText.classList.add('jogando');
    campaignText.classList.remove('zerado');
    campaignSep.style.display = 'none';
    achieSep.style.display = 'none';
    campaignDiv.style.display = 'none';
    ratingDiv.style.display = 'none';
    
    await updateStatusJSON(game, "jogando")
    updateStatus(statusText, "jogando", "Jogando")
    await loadGames();
})
optionZerado.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.campaign-status-tag');
    const campaignText = document.querySelector('.campaign-info-title-text');
    const campaignSep = document.querySelector('.campaign-sep');
    const achieSep = document.querySelector('.achie-sep');
    const campaignDiv = document.querySelector('.game-campaign-div');
    const ratingDiv = document.querySelector('.game-rating-div');

    options.style.display = 'none';
    campaignText.classList.remove('ajogar');
    campaignText.classList.remove('jogando');
    campaignText.classList.add('zerado');
    campaignSep.style.display = 'block';
    achieSep.style.display = 'block';
    campaignDiv.style.display = 'flex';
    ratingDiv.style.display = 'flex';

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
    const achieBtns = document.querySelector('.achie-add-minus');

    optionsAchie.style.display = 'none';
    achieBtns.style.display = 'none';
    
    await updateAchieJSON(game, "aplatinar")
    updateAchie(statusText, "aplatinar", "À Platinar")
    await loadGames();
    await loadGamesAchie();
})
optionPlatinando.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.achie-status-tag');
    const achieBtns = document.querySelector('.achie-add-minus');

    optionsAchie.style.display = 'none';
    achieBtns.style.display = 'flex';
    
    await updateAchieJSON(game, "platinando")
    updateAchie(statusText, "platinando", "Platinando")
    await loadGames();
    await loadGamesAchie();
})
optionPlatinado.addEventListener('click', async () => {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const statusText = document.querySelector('.achie-status-tag');
    const achieBtns = document.querySelector('.achie-add-minus');

    optionsAchie.style.display = 'none';
    achieBtns.style.display = 'none';

    await updateAchieJSON(game, "platinado")
    updateAchie(statusText, "platinado", "Platinado")
    await loadGames();
    await loadGamesAchie();
})