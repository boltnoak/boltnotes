const FILE = "Games/games.json";
const CAMPAIGNS_FILE = "Games/campaigns.json";
const ACHIEVEMENTS_FILE = "Games/achievements.json";
const NOTES_FILE = "Games/notes.json";

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

    document.getElementById("season-count").textContent = `${totalSeasons + 17} ${window._t['fn-seasons']}`;
    document.getElementById("chapter-count").textContent = `${totalChapters + 1} ${window._t['fn-chapters']}`;

  } catch (error) {
    console.error("Erro ao calcular o progresso do Fortnite:", error);
  }
}

// updateNoteCount();
loadFortniteStats();

function parseBRDate(dateStr) {
  if (!dateStr || !dateStr.includes("/")) return 0;

  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
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
        noGames.textContent = `${window._t['playing-now-nogames']}`;
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

    div.addEventListener('click', () => openGamePopup(div));

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

    banner.src = localHeroPath ? `file://${localHeroPath}` : 'assets://placeholder.png';
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

    if (achieGame.achieStatus.toLowerCase() == 'aplatinar') {
        updateAchie(achieStatusText, 'aplatinar', 'À Platinar');
    }
    if (achieGame.achieStatus.toLowerCase() == 'platinando') {
        updateAchie(achieStatusText, 'platinando', 'Platinando');
    }
    if (achieGame.achieStatus.toLowerCase() == 'platinado') {
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
})

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

loadGames();

const playingNowTitle = document.getElementById('featured-title');


document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();
    const configAssets = await window.api.assetsConfig.get();

    if (config.show_featured_changer === false) {
        document.querySelector('.featured-change-div').style.display = 'none';
        document.getElementById('featured-title').style.display = 'flex';
    }
    else if (config.show_featured_changer === true) {
        document.querySelector('.featured-change-div').style.display = 'flex';
        document.getElementById('featured-title').style.display = 'none';
        initFeaturedFortnite();
    }

    const toggles = {
        'notes_on_home': document.getElementById('notes'),
        'backlog_on_home': document.getElementById('games'),
        'fortnite_on_home': document.getElementById('fortnite'),
        'show_version': document.querySelector('.app-version')
    };

    const featuredPanels = {
        'none': [
            document.querySelector('.page-infos'),
            document.querySelector('.index-sep-bar')
        ],
        'playing_now': document.querySelector('.playingNow-panel'),
        'fn_fast_edit': document.querySelector('.recentSeason-panel')
    };

    const currentFeatured = config.featured;
    const fortniteAssets = configAssets.fortnite;

    if (currentFeatured === 'none') {
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.playingNow-panel').style.display = 'none';
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
        document.querySelector('.index-sep-bar').style.visibility = 'hidden';
    } else if (currentFeatured === 'fn_fast_edit') {
        initFeaturedFortnite();
        document.querySelector('.featured-option[data-value="playing-now"]').classList.remove('active');
        document.querySelector('.featured-option[data-value="fn-quick-edit"]').classList.add('active');
        document.querySelector('#featured-title').innerHTML = `Fortnite BR — ${window._t['fn-quick-edit']}<i class="fa-solid fa-square-poll-horizontal"></i>`;
        document.querySelector('.playingNow-panel').style.display = 'none';
        document.querySelector('.recentSeason-panel').style.display = 'flex';
    } else if (currentFeatured === 'playing_now') {
        document.querySelector('.featured-option[data-value="playing-now"]').classList.add('active');
        document.querySelector('.featured-option[data-value="fn-quick-edit"]').classList.remove('active');
        document.querySelector('#featured-title').innerHTML = `${window._t['playing-now']}<i class="fa-solid fa-gamepad"></i>`;
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.playingNow-panel').style.display = 'flex';
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

    document.getElementById('fortnite').style.display = fortniteAssets === false ? 'none' : 'flex';
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

async function initFeaturedFortnite() {
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
        img.style.backgroundImage = `url(assets://fortnite-${code}-assets/${code}.jpg)`;
        titleEl.innerHTML = `Fortnite BR — ${window._t['fn-quick-edit']}<i class="fa-solid fa-square-poll-horizontal"></i>`;
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
    if (levelsText) levelsText.textContent = `${window._t['progress']} - ${((data.levels / 200) * 100).toFixed(1)}%`
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
    if (levelAdd) levelAdd.onclick = () => {
        updateStat('levels', 1, levelsSpan);
        if (levelsText) levelsText.textContent = `${window._t['progress']} - ${((data.levels / 200) * 100).toFixed(1)}%`
    }
    if (levelMinus) levelMinus.onclick = () => {
        updateStat('levels', -1, levelsSpan);
        if (levelsText) levelsText.textContent = `${window._t['progress']} - ${((data.levels / 200) * 100).toFixed(1)}%`
    }
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

    finished.textContent = `${finishedCount} ${window._t['games-completed']}`;
    achie.textContent = `${achieCount} ${window._t['games-platinums']}`;
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

function changeFeatured(el) {
    const code = el.dataset.value;

    const playingNow = document.querySelector('.playingNow-panel');
    const fnQuickEdit = document.querySelector('.recentSeason-panel');

    if (code == 'playing-now') {
        loadGames();
        playingNow.style.display = 'flex';
        fnQuickEdit.style.display = 'none';
    }
    else if (code == 'fn-quick-edit') {
        playingNow.style.display = 'none';
        initFeaturedFortnite();
        fnQuickEdit.style.display = 'flex';
    }
    changeFeaturedView(code);
}

function changeFeaturedView(el) {
    const code = el;

    const playingNow = document.querySelector('.featured-option[data-value="playing-now"]');
    const fnQuickEdit = document.querySelector('.featured-option[data-value="fn-quick-edit"]');

    if (code == 'playing-now') {
        playingNow.classList.add('active');
        fnQuickEdit.classList.remove('active');
    }
    else if (code == 'fn-quick-edit') {
        playingNow.classList.remove('active');
        fnQuickEdit.classList.add('active');
    }
}