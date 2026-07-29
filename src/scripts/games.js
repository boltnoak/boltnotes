const FILE = "Games/games.json";
const CAMPAIGNS_FILE = "Games/campaigns.json";
const ACHIEVEMENTS_FILE = "Games/achievements.json";
const NOTES_FILE = "Games/notes.json";

let deleteMode = false;
let gameToDelete = null;

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

let renderIdGames = 0;
let renderIdAchie = 0;

const gameCardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
            const card = entry.target;
            const game = card.gameData;

            if (!game._cachedCover) {
                const result = await window.api.games.ensureCover({
                    appid: game.appid,
                    name: game.name,
                    cover: game.cover,
                    hero: game.hero,
                    logo: game.logo
                });
                game._cachedCover = result.cover;
                game._cachedHero = result.hero;
                game._cachedLogo = result.logo;
            }

            const img = card.querySelector('.game-cover'); 
            
            if (img && game._cachedCover) {
                const preloader = new Image();
                preloader.src = `file://${game._cachedCover}`;

                preloader.onload = () => {
                    img.src = preloader.src;

                    img.animate([
                        { opacity: 0 },
                        { opacity: 1 }
                    ], {
                        duration: 400,
                        easing: 'ease-in-out'
                    });
                };
            }

            observer.unobserve(card);
        }
    });
}, {
    rootMargin: "200px" 
});

async function loadGames() {
    renderIdGames++;
    const myRenderId = renderIdGames;

    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(FILE),
        loadStatus()
    ]);

    if (myRenderId !== renderIdGames) return;

    const playingNow = document.querySelector(".playingNow-panel");
    const list = document.getElementById("view-campaigns");
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
        combinedGame._completedIndex = null;

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
    const backlog = [];
    const completed = [];

    for (const g of games) {
        if (g._status === "jogando") playing.push(g);
        else if (g._status === "zerado") completed.push(g);
        else backlog.push(g);
    }

    completed.sort((a, b) => {
        if (sort === "date-recent") {
            return (b._completeMs || 0) - (a._completeMs || 0);
        }
        if (sort === "date-old") {
            return (a._completeMs || 0) - (b._completeMs || 0);
        }
        if (sort === "rating-high") {
            return (b.rating || 0) - (a.rating || 0);
        }
        if (sort === "rating-low") {
            return (a.rating || 0) - (b.rating || 0);
        }
        return 0;
    });

    const totalCompleted = completed.length;

    completed.forEach((game, idx) => {
        if (sort === "date-recent") {
            game._completedIndex = totalCompleted - idx;
        } else {
            game._completedIndex = idx + 1;
        }
    });

    backlog.sort((a, b) => {
        if (sort === "rating-high") return (b.rating || 0) - (a.rating || 0);
        if (sort === "rating-low") return (a.rating || 0) - (b.rating || 0);
        return 0;
    });

    const others = [...backlog, ...completed];

    async function renderInBatches(items, container, isPlaying) {
        if (items.length === 0 && isPlaying) {
            const noGames = document.createElement("div");
            noGames.className = "playingNow-no-games";
            noGames.textContent = window._t?.['playing-now-nogames'] || "Nenhum jogo em andamento";
            container.appendChild(noGames);
            return;
        }

        const BATCH_SIZE = 5;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            if (myRenderId !== renderIdGames) return;
            const batch = items.slice(i, i + BATCH_SIZE);
            
            const cards = batch.map(game => createGameCard(game, isPlaying, game._completedIndex));

            if (myRenderId !== renderIdGames) return;

            const fragment = document.createDocumentFragment();
            for (const card of cards) fragment.appendChild(card);
            
            container.appendChild(fragment);

            requestAnimationFrame(() => {
                cards.forEach((card, index) => {
                    setTimeout(() => {
                        if (myRenderId === renderIdGames) {
                            card.classList.add("fade-in");
                        }
                    }, index * 40); 
                });
            });

            if (i + BATCH_SIZE < items.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    
    await renderInBatches(playing, playingNow, true);

    if (myRenderId === renderIdGames) {
        await renderInBatches(others, list, false);
    }
}
function createGameCard(game, isPlaying = false, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";

    const img = document.createElement("img");
    img.className = "game-cover";

    if (game.isPreOrder === true) {
        div.classList.add("pre-order");
    }

    img.src = 'assets://basics/placeholder.png';
    
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
    tagFill.style.width = "100%";

    gameInfo.appendChild(title);
    
    if (status != "jogando") {
        gameInfo.appendChild(rating);
        gameInfo.appendChild(statusDiv);
    }

    const ratingUnderlineOpacity = '70%,transparent'
    if (game.rating >= 0) {
        rating.setAttribute('data-i18n', 'awful');
        rating.style.color = 'var(--red)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--red-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 2) {
        rating.setAttribute('data-i18n', 'bad');
        rating.style.textDecorationColor = `color-mix(in srgb, var(--red-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 4) {
        rating.setAttribute('data-i18n', 'average');
        rating.style.color = 'var(--orange)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--orange-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 6) {
        rating.setAttribute('data-i18n', 'good');
        rating.style.color = 'var(--blue)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--blue-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating > 7) {
        rating.setAttribute('data-i18n', 'very-good');
        rating.style.textDecorationColor = `color-mix(in srgb, var(--blue-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating >= 8) {
        rating.setAttribute('data-i18n', 'great');
        rating.style.color = 'var(--green-light)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--green-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating == 10) {
        rating.setAttribute('data-i18n', 'excellent');
        rating.style.color = 'var(--yellow)';
        rating.style.textDecorationColor = `color-mix(in srgb, var(--yellow-light) ${ratingUnderlineOpacity})`;
    }
    if (game.rating == "null") {
        rating.setAttribute('data-i18n', 'no-rating')
        rating.style.color = 'var(--text-dark-gray)';
        rating.style.textDecoration = 'none';
    }

    if (status === "jogando") tag.classList.add("jogando");
    else if (status === "zerado") tag.classList.add("zerado");
    else if (status === "ajogar") tag.classList.add("ajogar");
    else if (status === "wishlist") tag.classList.add("wishlist");

    if (status === "jogando") div.classList.add('jogando');

    title.textContent = game.name;
    div.dataset.id = game.name;

    const listElement = document.getElementById("view-campaigns");
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
        statusText.setAttribute('data-i18n', 'ajogar');
        statusDiv.appendChild(statusText);
        statusDiv.appendChild(tag);
        div.classList.add('ajogar');
    }

    if (status != "jogando") {
        tag.appendChild(tagFill);
        div.appendChild(img);
    }
    div.appendChild(gameInfo);

    div.addEventListener('click', () => {
        if (deleteMode) {
            askDeleteConfirmation(game, div);
            return;
        }
        openGamePopup(div);
    });

    applyLocale();

    div.gameData = game;
    gameCardObserver.observe(div);

    return div;
}

let cachedGamesDB = null;
let cachedCampaignStatus = null;
let cachedAchieStatus = null;
let cachedNotes = null;

async function loadGamesDB() {
    if (cachedGamesDB) {
        return cachedGamesDB;
    }
    try {
        const content = await window.electronAPI.json.load(FILE);
        cachedGamesDB = Array.isArray(content.games) ? content.games : (Array.isArray(content) ? content : []);
        return cachedGamesDB;
    } catch (e) {
        console.error("Erro ao ler games.json:", e);
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
    renderIdAchie++;
    const myRenderId = renderIdAchie;

    const [data, stats, cStatus] = await Promise.all([
        window.electronAPI.json.load(FILE),
        loadStatusAchie(),
        window.electronAPI.json.load(CAMPAIGNS_FILE)
    ]);

    if (myRenderId !== renderIdAchie) return;

    const platinandoNow = document.querySelector(".platinandoNow-panel");
    const list = document.getElementById("view-achievements");
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

        return combinedGame;
    });

    const sort = document.getElementById("realSorting-options")?.value || "date-recent";

    const platinando = [];
    const backlog = [];
    const completed = [];

    for (const g of games) {
        if (g._achieStatus === "platinando") platinando.push(g);
        else if (g._achieStatus === "platinado") completed.push(g);
        else backlog.push(g);
    }

    completed.sort((a, b) => {
        if (sort === "date-recent") {
            return (b._completeMs || 0) - (a._completeMs || 0);
        }
        if (sort === "date-old") {
            return (a._completeMs || 0) - (b._completeMs || 0);
        }
        if (sort === "rating-high") {
            return (b.rating || 0) - (a.rating || 0);
        }
        if (sort === "rating-low") {
            return (a.rating || 0) - (b.rating || 0);
        }
        return 0;
    });

    const totalCompleted = completed.length;
    completed.forEach((game, idx) => {
        if (sort === "date-recent") {
            game._completedIndex = totalCompleted - idx;
        } else {
            game._completedIndex = idx + 1;
        }
    });

    backlog.sort((a, b) => {
        if (sort === "rating-high") return (b.rating || 0) - (a.rating || 0);
        if (sort === "rating-low") return (a.rating || 0) - (b.rating || 0);
        return 0;
    });

    const others = [...backlog, ...completed];

    async function renderInBatches(items, container, isPlatinando) {
        if (items.length === 0 && isPlatinando) {
            const noGames = document.createElement("div");
            noGames.className = "platinandoNow-no-games";
            noGames.textContent = window._t?.['platinum-now-nogames'] || "Nenhum jogo em andamento";
            container.appendChild(noGames);
            return;
        }

        const BATCH_SIZE = 5;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            if (myRenderId !== renderIdAchie) return;
            const batch = items.slice(i, i + BATCH_SIZE);
            
            const cards = batch.map(game => createGameAchieCard(game, game._completedIndex));

            if (myRenderId !== renderIdAchie) return;

            const fragment = document.createDocumentFragment();
            for (const card of cards) fragment.appendChild(card);
            
            container.appendChild(fragment);

            requestAnimationFrame(() => {
                cards.forEach((card, index) => {
                    setTimeout(() => {
                        if (myRenderId === renderIdAchie) {
                            card.classList.add("fade-in");
                        }
                    }, index * 40); 
                });
            });

            if (i + BATCH_SIZE < items.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    await renderInBatches(platinando, platinandoNow, true);

    if (myRenderId === renderIdAchie) {
        await renderInBatches(others, list, false);
    }
}
function createGameAchieCard(game, completedIndex = null) {
    const div = document.createElement("div");
    div.className = "game";
    div.dataset.id = game.name;

    const img = document.createElement("img");
    img.className = "game-cover";

    if (game.isPreOrder === true) {
        div.classList.add("pre-order");
    }
    if (game.hasAchievements === false) {
        div.classList.add("no-achie");
    }

    img.src = 'assets://basics/placeholder.png';
    
    const gameInfo = document.createElement("div");
    gameInfo.className = "game-info";

    const title = document.createElement("p");
    title.className = "game-title";

    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-div';

    const status = (game.achieStatus || "").toLowerCase().trim();

    const tag = document.createElement("span");
    tag.className = "status";

    if (status === "aplatinar") {
        const statusText = document.createElement("span");
        const statusTitle = document.createElement("span");
        statusTitle.className = "status-text-title";
        statusText.className = "status-text";
        statusTitle.setAttribute('data-i18n', 'aplatinar');
        statusText.textContent = ` - ${game.unlockedAchievements || 0}/${game.totalAchievements}`;
        statusDiv.appendChild(statusText);
        statusText.appendChild(statusTitle);
        statusDiv.appendChild(tag);
        div.classList.add('aplatinar');
        applyLocale();
    }

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

    const listElement = document.getElementById("view-achievements");
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
    }

    tag.appendChild(tagFill);
    div.appendChild(img);
    div.appendChild(gameInfo);

    div.addEventListener('click', () => openGamePopup(div));

    div.gameData = game;
    gameCardObserver.observe(div);

    return div;
}

async function loadNotes() {
    if (cachedNotes) {
        return cachedNotes;
    }
    try {
        const content = await window.electronAPI.json.load(NOTES_FILE);
        cachedNotes = (typeof content === 'object' && content !== null) ? content : {};
        return cachedNotes;
    } catch (e) {
        console.error("Erro ao ler notes.json:", e);
        return {};
    }
}
async function loadStatusAchie() {
    if (cachedAchieStatus) {
        return cachedAchieStatus;
    }
    try {
        const content = await window.electronAPI.json.load(ACHIEVEMENTS_FILE);
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

const viewGridBtn = document.getElementById("view-grid");
const viewListBtn = document.getElementById("view-list");
const achievementsBtn = document.querySelector('.mode-btn[data-mode="achievements"]');
const campaignBtn = document.querySelector('.mode-btn[data-mode="campaigns"]');
const chartsBtn = document.querySelector('.mode-btn[data-mode="charts"]');
const viewGames = document.getElementById("view-campaigns");
const viewAchie = document.getElementById("view-achievements");
const viewChartsBtn = document.getElementById("view-charts");

const sortRatingHigh = document.querySelector('.sortingOptions-select li[data-value="rating-high"]');
const sortRatingLow = document.querySelector('.sortingOptions-select li[data-value="rating-low"]');
const sortRecent = document.querySelector('.sortingOptions-select li[data-value="date-recent"]');
const sortOld = document.querySelector('.sortingOptions-select li[data-value="date-old"]');

let currentViewMode = 'grid';

function toggleViewMode(mode) {
    currentViewMode = mode;
    const isGrid = mode === 'grid';

    viewGridBtn?.classList.toggle('active', isGrid);
    viewListBtn?.classList.toggle('active', !isGrid);

    const activeBtn = document.querySelector('.mode-btn.active');
    if (!activeBtn) return;

    const currentMode = activeBtn.dataset.mode;
    const activeView = document.getElementById(`view-${currentMode}`);

    if (activeView) {
        activeView.classList.remove('grid', 'list');
        activeView.classList.add(mode);
    }

    if (currentMode === 'campaigns') {
        if (sortRatingHigh) sortRatingHigh.style.display = 'block';
        if (sortRatingLow) sortRatingLow.style.display = 'block';
        loadGames();
    } else if (currentMode === 'achievements') {
        if (sortRatingHigh) sortRatingHigh.style.display = 'none';
        if (sortRatingLow) sortRatingLow.style.display = 'none';
        if (sortRecent) sortRecent.style.display = 'block';
        if (sortOld) sortOld.style.display = 'block';
        loadGamesAchie();
    }
}
function switchMainView(targetView) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === targetView);
    });
    document.querySelectorAll('.main-view').forEach(view => {
        const isActive = view.id === `view-${targetView}`;

        view.classList.toggle('active', isActive);

        const defaultDisplay = view.id === 'view-charts' ? 'flex' : 'grid';

        view.style.display = isActive ? defaultDisplay : 'none';
        view.style.visibility = isActive ? 'visible' : 'hidden';
        view.style.height = isActive ? 'fit-content' : '0';
    });

    toggleViewMode(currentViewMode);
}

viewGridBtn.addEventListener("click", () => toggleViewMode('grid'));
viewListBtn.addEventListener("click", () => toggleViewMode('list'));
viewChartsBtn.addEventListener("click", () => toggleViewMode('list'));

function switchMode(el) {
    const mode = el.dataset.mode;
    switchMainView(mode)
}

loadGames();
loadGamesAchie();

document.getElementById("realSorting-options").addEventListener("change", () => {
    const campaignBtn = document.querySelector('.mode-btn[data-mode="campaigns"]');
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
        e.stopPropagation();
        container.classList.toggle('open');

        // Jeito mais seguro: verifica só a classe que importa, ignorando as outras
        if (triggerIcon.classList.contains("fa-angle-down")) {
            triggerIcon.classList.replace("fa-angle-down", "fa-angle-up");
        } else {
            triggerIcon.classList.replace("fa-angle-up", "fa-angle-down");
        }
    });

    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation(); 
            
            const val = this.getAttribute('data-value');
            const text = this.textContent;

            const i18nKey = this.getAttribute('data-i18n'); 
            triggerText.textContent = text;
            if (i18nKey) {
                triggerText.setAttribute('data-i18n', i18nKey);
            }

            realSelect.value = val;
            realSelect.dispatchEvent(new Event('change'));

            options.forEach(li => li.classList.remove('selected'));
            this.classList.add('selected');

            container.classList.remove('open');
            triggerIcon.classList.replace("fa-angle-up", "fa-angle-down");
        });
    });

    document.addEventListener('click', () => {
        if (container.classList.contains('open')) {
            container.classList.remove('open');
            triggerIcon.classList.replace("fa-angle-up", "fa-angle-down");
        }
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
    loadGames();
    loadGamesAchie();
});

const addGamePopup = document.getElementById('addGame-popup');
const addGameOpenBtn = document.querySelector('.addGameOpen');

addGameOpenBtn.addEventListener('click', () => addGamePopup.style.display = 'flex');

function updateStatus(element, statusClass, text) {
    element.textContent = text;
    element.classList.remove('ajogar', 'jogando', 'zerado');
    if (statusClass) {
        element.classList.add(statusClass);
        element.setAttribute('data-i18n', statusClass);
    }
}

function updateAchie(element, statusClass, text) {
    element.textContent = text;
    element.classList.remove('platinado', 'platinando', 'aplatinar');
    if (statusClass) {
        element.classList.add(statusClass);
        element.setAttribute('data-i18n', statusClass);
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
    const achieBarFill = document.querySelector('.achie-bar-fill');
    const achiePercentage = document.querySelector('.achie-percentage');

    const total = game.totalAchievements;

    if (isAdd) {
        if (game.unlockedAchievements < total) {
            game.unlockedAchievements++;
        } else return
    } else {
        if (game.unlockedAchievements > 0) {
            game.unlockedAchievements--;
        } else return
    }

    const unlocked = game.unlockedAchievements;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    achieCount.textContent = `${unlocked}/${total}`;
    achieBarFill.style.width = `${percentage}%`;
    achiePercentage.textContent = `${percentage}%`;

    if (jogoEncontrado) {
        await window.electronAPI.json.save(ACHIEVEMENTS_FILE, listaStats);
        console.log(`Status de ${game} atualizado com sucesso!`);
        return true;
    } else {
        console.warn("Jogo não encontrado na lista.");
        return false;
    }

}


function checkTextOverflow() {
    const devText = document.querySelector('.dev-name');
    const devTitleDiv = devText?.closest('.game-popup-title');

    const pubText = document.querySelector('.pub-name');
    const pubTitleDiv = pubText?.closest('.game-popup-title');

    function calculate() {
        document.fonts.ready.then(() => {
            // Processa o Desenvolvedor
            if (devText && devTitleDiv) {
                const overflowDistance = devText.scrollWidth - devTitleDiv.clientWidth;
                if (overflowDistance > 0) {
                    devText.style.setProperty('--scroll-distance', `-${overflowDistance}px`);
                    devText.classList.remove('no-scroll');
                } else {
                    devText.classList.add('no-scroll');
                }
            }

            // Processa a Publicadora
            if (pubText && pubTitleDiv) {
                const overflowDistance = pubText.scrollWidth - pubTitleDiv.clientWidth;
                if (overflowDistance > 0) {
                    pubText.style.setProperty('--scroll-distance', `-${overflowDistance}px`);
                    pubText.classList.remove('no-scroll');
                } else {
                    pubText.classList.add('no-scroll');
                }
            }
        });
    }

    // Roda logo após um pequeno delay para dar tempo de qualquer animação de abertura estabilizar
    setTimeout(calculate, 50);

    // E cria um observador caso o tamanho mude dinamicamente depois
    if (devTitleDiv) {
        const observer = new ResizeObserver(() => calculate());
        observer.observe(devTitleDiv);
    }
}

async function openGamePopup(el) {
    const title = el.dataset.id;
    const name = el.dataset.id.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const popup = document.querySelector('.game-popup-div');
    popup.setAttribute('data-name', title);

    const banner = document.querySelector('.game-banner');
    const logo = document.querySelector('.game-logo');
    const devText = document.querySelector('.dev-name');
    const pubText = document.querySelector('.pub-name');
    const releaseDateTitle = document.querySelector('.game-releaseDate-title');
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

    const achieSep = document.querySelector('.achie-sep');
    const campaignSep = document.querySelector('.campaign-sep');

    const campaignDiv = document.querySelector('.game-campaign-div');
    const campaignChange = document.querySelector('.campaign-status-change');

    const ratingText = document.querySelector('.game-popup-rating');
    const ratingDiv = document.querySelector('.game-rating-div');
    const ratingTitle = document.querySelector('.game-rating-title-text');

    const noteDiv = document.querySelector('.game-note-div');
    const noteText = document.querySelector('.game-note');
    const noteEditBtn = document.getElementById('editNote');
    
    noteEditBtn.setAttribute('data-id', title);
    achieAddBtn.setAttribute('data-id', title);
    achieMinusBtn.setAttribute('data-id', title);

    ratingTitle.setAttribute('data-i18n', 'rating');

    pubText.style.animation = '';
    devText.style.animation = '';
    achieStatusText.style.display = 'flex';

    let jogoEncontrado = null;
    let gameStatusFound = null;
    let fullGame = null;
    let gameNoteFound = null;

    try {
        const games = await loadStatusAchie();
        const notes = await loadNotes() || {};
        const gamesDB = await loadGamesDB();
        const gamesCamp = await loadStatus();
        // const fullGamesArray = Array.isArray(fullGamesData) ? fullGamesData : (fullGamesData.games || []);
        jogoEncontrado = games.find(g => g.name === title) || {};
        fullGame = gamesDB.find(g => g.name === title) || {};
        gameStatusFound = gamesCamp.find(g => g.name === title) || {};
        gameNoteFound = notes[title];
    } catch (erro) {
        console.error("Erro ao carregar o JSON:", erro);
        jogoEncontrado = {};
        fullGame = {};
        gameStatusFound = {};
        gameNoteFound = {};
    }

    const achieGame = jogoEncontrado;
    const gameCampaign = gameStatusFound;
    const gamesDB = fullGame;
    const gameNote = gameNoteFound;

    const {
        cover: localCoverPath,
        hero: localHeroPath,
        logo: localLogoPath
    } = await window.api.games.ensureCover({
        appid: gamesDB.appid,
        name: gamesDB.name,
        cover: gamesDB.cover,
        hero: gamesDB.hero,
        logo: gamesDB.logo
    });

    banner.src = localHeroPath ? `file://${localHeroPath}` : 'assets://basics/placeholder.png';
    logo.src = localLogoPath ? `file://${localLogoPath}` : '';

    logo.alt = el.dataset.id;
    devText.textContent = gamesDB.developer || "Erro";
    pubText.textContent = gamesDB.publisher || "Erro";
    releaseDateText.textContent = gamesDB.releaseDate || "Erro";

    if (releaseDateTitle) {
        const observer = new MutationObserver(() => {
            if (/:\s*$/.test(releaseDateTitle.textContent)) {
                releaseDateTitle.textContent = releaseDateTitle.textContent.replace(/:\s*$/, '');
            }
        });
        observer.observe(releaseDateTitle, { childList: true, characterData: true, subtree: true });
        if (/:\s*$/.test(releaseDateTitle.textContent)) {
            releaseDateTitle.textContent = releaseDateTitle.textContent.replace(/:\s*$/, '');
        }
    }
    if (ratingTitle) {
        const observer = new MutationObserver(() => {
            if (/:\s*$/.test(ratingTitle.textContent)) {
                ratingTitle.textContent = ratingTitle.textContent.replace(/:\s*$/, '');
            }
        });
        observer.observe(ratingTitle, { childList: true, characterData: true, subtree: true });
        if (/:\s*$/.test(ratingTitle.textContent)) {
            ratingTitle.textContent = ratingTitle.textContent.replace(/:\s*$/, '');
        }
    }

    completeDateText.textContent = gameCampaign.completeDate || "";
    noteText.innerHTML = gameNote?.note || "";

    if (gameCampaign.rating >= 0) {
        ratingTitle.style.display = 'flex';
        ratingText.removeAttribute('data-i18n', 'no-rating');
        ratingText.textContent = Number(gameCampaign.rating).toFixed(1);
        ratingText.classList.remove('no-rating');
    }
    if (gameCampaign.rating == "null") {
        ratingTitle.style.display = 'none';
        ratingText.setAttribute('data-i18n', 'no-rating');
        ratingText.classList.add('no-rating');
        applyLocale();
    }

    const total = achieGame.totalAchievements || 0;
    const unlocked = achieGame.unlockedAchievements || 0;
    achieCount.textContent = `${unlocked}/${total}`;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    achieBarFill.style.width = `${percentage}%`;
    achiePercentage.textContent = `${percentage}%`;

    const hasAchie = achieGame.hasAchievements;

    const campStatus = gameCampaign.status.toLowerCase();
    const achStatus = achieGame.achieStatus?.toLowerCase();
    const showAchieBtns = 
        campStatus === 'jogando' || 
        achStatus === 'platinando';

    if (hasAchie) {
        achieTitle.style.display = 'flex';
        achieInfo.style.display = 'flex';
        achieStatusText.style.display = 'flex';
        achieBtns.style.display = 'flex';
        achieDiv.style.display = 'flex';
        achieSep.style.display = 'block';
        campaignChange.classList.remove('noAchie');
    } else {
        achieTitle.style.display = 'none';
        achieInfo.style.display = 'none';
        achieStatusText.style.display = 'none';
        achieBtns.style.display = 'none';
        achieDiv.style.display = 'none';
        achieSep.style.display = 'none';
        campaignChange.classList.add('noAchie');
    }

    if (gameCampaign.status.toLowerCase() == 'ajogar') {
        updateStatus(statusText, 'ajogar', 'À Jogar');
        campaignSep.style.display = 'none';
        achieSep.style.display = 'none';
        campaignDiv.style.display = 'none';
        ratingDiv.style.display = 'none';
        noteDiv.style.display = 'none';
    }
    if (gameCampaign.status.toLowerCase() == 'jogando') {
        updateStatus(statusText, 'jogando', 'Jogando');
        campaignSep.style.display = 'none';
        achieSep.style.display = 'none';
        campaignDiv.style.display = 'none';
        ratingDiv.style.display = 'none';
        noteDiv.style.display = 'none';
    }
    if (gameCampaign.status.toLowerCase() == 'zerado') {
        updateStatus(statusText, 'zerado', 'Zerado');
        campaignText.setAttribute('data-i18n', 'zerado');
        campaignSep.style.display = 'block';
        campaignDiv.style.display = 'flex';
        ratingDiv.style.display = 'flex';
        noteDiv.style.display = 'flex';
        applyLocale();
    }

    if (achieGame.achieStatus && achieGame.achieStatus.toLowerCase() == 'aplatinar') {
        updateAchie(achieStatusText, 'aplatinar', 'À Platinar');
    }
    if (achieGame.achieStatus && achieGame.achieStatus.toLowerCase() == 'platinando') {
        updateAchie(achieStatusText, 'platinando', 'Platinando');
    }
    if (achieGame.achieStatus && achieGame.achieStatus.toLowerCase() == 'platinado') {
        updateAchie(achieStatusText, 'platinado', 'Platinado');
    }

    if (jogoEncontrado && jogoEncontrado.achieStatus) {
        const achieStatus = jogoEncontrado.achieStatus.toLowerCase();

        if (achieStatus === 'platinado')  updateAchie(achieStatusText, 'platinado', 'Platinado');
        if (achieStatus === 'platinando') updateAchie(achieStatusText, 'platinando', 'Platinando');
        if (achieStatus === 'aplatinar')  updateAchie(achieStatusText, 'aplatinar', 'À Platinar');
    } else {
        achieStatusText.style.display = 'none';
    }

    achieBtns.style.display = showAchieBtns ? 'flex' : 'none';

    popup.style.display = 'flex';
    checkTextOverflow();
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

        const text = document.querySelector('.game-note');
        const editBtn = document.getElementById('editNote');

        text.contentEditable = "false";
        editBtn.className = 'fa-solid fa-pen';
        
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
            const dateNow = new Date();
            jogoEncontrado.completeDate = dateNow.toLocaleDateString('pt-BR');
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
            gameFoundAchie.unlockedAchievements = gameFoundAchie.totalAchievements;
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
    const achieBtns = document.querySelector('.achie-add-minus');
    const noteDiv = document.querySelector('.game-note-div');

    options.style.display = 'none';
    campaignText.classList.add('ajogar');
    campaignText.classList.remove('jogando');
    campaignText.classList.remove('zerado');
    campaignSep.style.display = 'none';
    achieSep.style.display = 'none';
    campaignDiv.style.display = 'none';
    ratingDiv.style.display = 'none';
    achieBtns.style.display = 'none';
    noteDiv.style.display = 'none';
    
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
    const achieBtns = document.querySelector('.achie-add-minus');
    const noteDiv = document.querySelector('.game-note-div');

    options.style.display = 'none';
    achieBtns.style.display = 'flex';
    campaignText.classList.remove('ajogar');
    campaignText.classList.add('jogando');
    campaignText.classList.remove('zerado');
    campaignSep.style.display = 'none';
    achieSep.style.display = 'none';
    campaignDiv.style.display = 'none';
    ratingDiv.style.display = 'none';
    noteDiv.style.display = 'none';
    
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
    const achieBtns = document.querySelector('.achie-add-minus');
    const noteDiv = document.querySelector('.game-note-div');

    options.style.display = 'none';
    campaignText.setAttribute('data-i18n', 'zerado');
    campaignSep.style.display = 'block';
    achieSep.style.display = 'block';
    campaignDiv.style.display = 'flex';
    ratingDiv.style.display = 'flex';
    noteDiv.style.display = 'flex';

    const stats = await loadStatusAchie();
    const listStats = Array.isArray(stats) ? stats : (stats.games || []);

    const nomeDoJogoProcurado = game;
    const gameFoundAchie = listStats.find(jogo => jogo.name === nomeDoJogoProcurado);

    if (gameFoundAchie) {
        if (gameFoundAchie.achieStatus === "platinando") {
            achieBtns.style.display = 'flex';
        } else {
            achieBtns.style.display = 'none';
        }
    }

    await updateStatusJSON(game, "zerado")
    updateStatus(statusText, "zerado", "Zerado")

    const completeDateText = document.querySelector('.game-popup-completeDate');
    if (completeDateText) {
        completeDateText.textContent = new Date().toLocaleDateString('pt-BR');
    }

    applyLocale();
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
    const fillBar = document.querySelector('.achie-bar-fill');
    const percentage = document.querySelector('.achie-percentage');
    const number = document.querySelector('.achie-info-title-numbers');
    const numberText = number.textContent;

    optionsAchie.style.display = 'none';
    achieBtns.style.display = 'none';

    fillBar.style.width = '100%';
    percentage.textContent = '100%';
    const total = numberText.split('/')[1];
    number.textContent = `${total}/${total}`;

    await updateAchieJSON(game, "platinado")
    updateAchie(statusText, "platinado", "Platinado")
    await loadGames();
    await loadGamesAchie();
})

const addGamePopupDiv = document.querySelector('.add-game-form');
addGamePopup.addEventListener('click', (e) => {
    if (e.target === addGamePopup) {
        addGamePopupDiv.classList.add('is-closing');
        
        addGamePopupDiv.addEventListener('animationend', () => {
            addGamePopup.style.display = 'none';
            addGamePopupDiv.classList.remove('is-closing');
        }, { once: true });
    }
});

const ratingBtn = document.querySelector('.game-rating-div');
const optionsRating = document.querySelector('.rating-change');
ratingBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (optionsRating.style.display === 'none') {
        optionsRating.style.display = 'flex';
        options.style.display = 'none';
        optionsAchie.style.display = 'none';
    } else {
        optionsRating.style.display = 'none';
    }
});

document.addEventListener('click', (event) => {
    if (!optionsRating.contains(event.target) && event.target !== ratingBtn) {
        optionsRating.style.display = 'none';
    }
});

async function changeRatingBtn(el) {
    const game = document.querySelector('.game-popup-div').dataset.name;
    const rating = el.dataset.value;
    const text = document.querySelector('.game-popup-rating');

    await changeRatingJSON(game, rating);
    changeRating(text, Number(rating).toFixed(1));
    await loadGames();
    await loadGamesAchie();
}

async function changeRatingJSON(game, ratingEl) {
    const [data, stats] = await Promise.all([
        window.electronAPI.json.load(CAMPAIGNS_FILE),
        loadStatus()
    ]);

    const listaStats = Array.isArray(stats) ? stats : (stats.games || []);

    const nomeDoJogoProcurado = game;
    const selectedRating = ratingEl;

    const jogoEncontrado = listaStats.find(jogo => jogo.name === nomeDoJogoProcurado);

    if (jogoEncontrado) {
        jogoEncontrado.rating = selectedRating;
        
        await window.electronAPI.json.save(CAMPAIGNS_FILE, listaStats);
        console.log(`Status de ${game} atualizado com sucesso!`);
        return true;
    } else {
        console.warn("Jogo não encontrado na lista.");
        return false;
    }
}
function changeRating(element, text) {
    const textTitle = document.querySelector('.game-rating-title-text');
    if (text <= "null") {
        textTitle.style.display = 'none';
        element.setAttribute('data-i18n', 'no-rating');
        element.classList.add('no-rating');
        applyLocale();
    }
    if (text >= 0) {
        textTitle.style.display = 'flex';
        element.textContent = text;
        element.removeAttribute('data-i18n', 'no-rating');
        element.classList.remove('no-rating');
    }
}

const noteText = document.querySelector('.game-note');
noteText.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
    }
});

async function updateNotesJSON(game) {
    const notes = await loadNotes();
    const updatedNote = noteText.innerHTML
        .replace(/<div><br><\/div>/g, '<br>')
        .replace(/<div>/g, '<br>')
        .replace(/<\/div>/g, '');

    if (!notes[game]) {
        notes[game] = { note: "" };
    }

    const dataToSave = { ...notes };
    dataToSave[game].note = updatedNote;

    try {
        await window.electronAPI.json.save(NOTES_FILE, dataToSave);
        console.log(`Nota de ${game} atualizada com sucesso!`);
        return true;
    } catch (erro) {
        console.error("Erro ao salvar o arquivo de notas:", erro);
        return false;
    }
}

const noteEditBtn = document.getElementById('editNote');

async function toggleNoteEdit(el) {
    const name = el.dataset.id;
    const text = document.querySelector('.game-note');
    const isEditable = text.contentEditable === "true";

    if (!isEditable) {
        text.contentEditable = "true";
        noteEditBtn.className = 'fa-solid fa-floppy-disk';
    } else {
        text.contentEditable = "false";
        noteEditBtn.className = 'fa-solid fa-pen';
        await updateNotesJSON(name); 
    }
}



function gerarCoresInterpoladas(corInicial, corFinal, passos) {
    if (passos <= 1) return [corInicial];

    const extrairRGB = (str) => str.match(/\d+/g).map(Number);
    const rgb1 = extrairRGB(corInicial);
    const rgb2 = extrairRGB(corFinal);

    const resultado = [];
    for (let i = 0; i < passos; i++) {
        const fator = i / (passos - 1);
        const r = Math.round(rgb1[0] + fator * (rgb2[0] - rgb1[0]));
        const g = Math.round(rgb1[1] + fator * (rgb2[1] - rgb1[1]));
        const b = Math.round(rgb1[2] + fator * (rgb2[2] - rgb1[2]));
        resultado.push(`rgb(${r}, ${g}, ${b})`);
    }
    return resultado;
}
async function renderChart() {
    const stats = await window.api.games.statsZerados();
    const anos = Object.keys(stats);
    const valores = Object.values(stats);
    const total = valores.reduce((a, b) => a + b, 0);

    const t = window._t || {}; 

    const labelZerados = t['completed-text'] || 'Zer';
    const labelJogo = t['game-text'] || 'jogo';
    const labelJogos = t['game-text'] + 's' || 'jogos';

    const getCssVar = (varName) => 
        getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

    const bgApp = getCssVar('--bg') || '#050505';
    const bgTooltip = getCssVar('--tab-active') || 'rgba(25, 25, 25, 0.75)';
    const textColor = getCssVar('--text') || '#ffffff';
    const textGray = getCssVar('--text-gray') || '#969696';
    const textDarkGray = getCssVar('--text-dark-gray') || '#505050';
    const borderColor = getCssVar('--bg') || '#050505';

    const cores = anos.map((_, index) => {
    const varCor = getCssVar(`--chart-${index + 1}`);
        return varCor || getCssVar('--text'); 
    });

    const ctx = document.getElementById('zerados-chart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: anos,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderColor: 'transparent',
                borderWidth: 0,
                hoverOffset: 20,
                radius: '65%',
                spanGaps: true
            }]
        },
        options: {
            cutout: '88%',
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 400,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            family: 'Montserrat',
                            size: 13,
                            weight: '600'
                        },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    caretSize: 0,
                    caretPadding: 10,
                    backgroundColor: bgTooltip,
                    titleColor: textColor,
                    titleFont: { family: 'Montserrat', size: 18, weight: '800' },
                    bodyColor: textGray,
                    bodyFont: { family: 'Montserrat', size: 13, weight: '600' },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 2,
                    callbacks: {
                        label: (ctx) => {
                            const percent = ((ctx.raw / total) * 100).toFixed(1);
                            const palavraJogo = ctx.raw > 1 ? labelJogos : labelJogo;
                            // return ` ${ctx.raw} ${palavraJogo}`;
                            return ` ${ctx.raw} ${palavraJogo} (${percent}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw(chart) {
                const { ctx, chartArea: { width, height, top, left } } = chart;
                ctx.save();
                
                ctx.font = '800 7vh Montserrat';
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(total, left + width / 2, top + height / 2 - 8);

                ctx.font = '600 2.6vh Montserrat';
                ctx.fillStyle = textGray;
                ctx.fillText(labelZerados, left + width / 2, top + height / 2 + 18);

                ctx.restore();
            }
        }]
    });
}

renderChart();

const deleteModeBtn = document.getElementById('delete-games');
const gamesGrid = document.getElementById('view-campaigns');

deleteModeBtn.addEventListener('click', () => {
    deleteMode = !deleteMode;
    deleteModeBtn.classList.toggle('active', deleteMode);
    document.body.classList.toggle('delete-mode-active', deleteMode);
});
function askDeleteConfirmation(game, cardEl) {
    gameToDelete = game;
    
    const confirmPopup = document.getElementById('delete-confirm-popup');
    const gameNameEl = document.getElementById('delete-confirm-name');
    
    gameNameEl.textContent = game.name;
    confirmPopup.style.display = 'flex';
}

document.getElementById('delete-confirm-yes').addEventListener('click', async () => {
    if (!gameToDelete) return;
    
    await window.api.games.deleteGame(gameToDelete.name);
    
    document.getElementById('delete-confirm-popup').style.display = 'none';
    gameToDelete = null;
    deleteMode = false;
    deleteModeBtn.classList.remove('active');
    document.body.classList.remove('delete-mode-active');
    
    cachedCampaignStatus = null;
    cachedAchieStatus = null;
    cachedNotes = null;
    await loadGames();
    await loadGamesAchie();
});

document.getElementById('delete-confirm-cancel').addEventListener('click', () => {
    const deletePopupDiv = document.getElementById('delete-confirm-popup');
    const deletePopup = document.querySelector('.confirm-popup-content');
    gameToDelete = null;

    if (deletePopupDiv) {
        deletePopup.classList.add('is-closing');
        
        deletePopup.addEventListener('animationend', () => {
            deletePopupDiv.style.display = 'none';
            deletePopup.classList.remove('is-closing');
        }, { once: true });
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deleteMode) {
        deleteMode = false;
        deleteModeBtn.classList.remove('active');
        document.body.classList.remove('delete-mode-active');
    }
});

gamePopupDiv.addEventListener('click', (e) => {
});