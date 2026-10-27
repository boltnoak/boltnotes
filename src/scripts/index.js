/// VARIÁVEIS ///
let cachedSeasons = null;
let saveTimeout = null;
let reviews = {};
let stats = {};

const FORTNITE_STATS = "Fortnite/stats.json";

async function initFortniteData() {
    try {
        const data = await loadCloudSeasonInfo();
        const statsData = await loadJson(FORTNITE_STATS);

        window.stats = (statsData && typeof statsData === 'object') ? statsData : {};

        let added = false;
        for (const code of Object.keys(data)) {
            if (!window.stats[code]) {
                window.stats[code] = { rating: "N/A", levels: "0", wins: "0", locked: false };
                added = true;
            }
        }
        if (added) await saveJson(FORTNITE_STATS, window.stats);
    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

function changeFeatured(el) {
    const code = el.dataset.value;
    const featuredPanels = document.querySelectorAll('.featured-panel');
    const options = document.querySelectorAll('.featured-option');

    featuredPanels.forEach(el => {
        const isActive = el.dataset.value === code;
        el.style.display = isActive ? 'flex' : 'none';
    })
    options.forEach(el => {
        const isActive = el.dataset.value === code;
        el.classList.toggle('active', isActive);
    })
}

document.addEventListener('DOMContentLoaded', async () => {
    const config = await getConfig();
    const currentFeatured = config.featured;
    const currentFeaturedLang = currentFeatured.replace(/_/g, '-');

    const multipleFeatured = document.querySelector('.featured-change-div');
    const featuredDiv = document.querySelector('.page-infos');
    const featuredActiveOption = document.querySelector(`.featured-option[data-value="${currentFeatured}"]`);
    const featuredIcon = document.querySelector('#featured-title i');
    const featuredTitle = document.querySelector('.featured-title-text');
    const singleFeatured = document.getElementById('featured-title');

    const isMultipleFeatured = config.show_featured_changer;
    multipleFeatured.style.display = isMultipleFeatured ? 'flex' : 'none';
    singleFeatured.style.display = !isMultipleFeatured ? 'flex' : 'none';

    const isNone = currentFeatured === 'none';
    const isBacklog = currentFeatured === 'playing_now';
    const isFNFastEdit = currentFeatured === 'fn_fast_edit';

    featuredDiv.style.display = isNone ? 'none' : 'flex';
    featuredIcon.classList.toggle('fa-gamepad', isBacklog);
    featuredIcon.classList.toggle('fa-square-poll-horizontal', isFNFastEdit);
    featuredTitle.textContent = `${window._t[currentFeaturedLang]}`;
    changeFeatured(featuredActiveOption);

    const toggles = [
        ['notes_on_home', document.getElementById('notes')],
        ['backlog_on_home', document.getElementById('games')],
        ['fortnite_on_home', document.getElementById('fortnite')]
    ]
    for (const [key, value] of toggles) value.style.display = config[key] ? 'flex' : 'none';

    requestAnimationFrame(() => {
        document.body.classList.add('ready');
    });
});

////////////////
/// FORTNITE ///
////////////////
async function loadCloudSeasonInfo() {
    if (cachedSeasons) return cachedSeasons;

    const config = await getConfig();
    const language = config.language || "pt-BR";

    const url = `https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-seasons-${language}.json`;

    const content = await fetchWithCache(url, `fn-seasons-${language}`);
    cachedSeasons = content || {};
    return cachedSeasons;
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

async function initFeaturedFortnite() {
    await initFortniteData();
    const seasons = await loadCloudSeasonInfo();
    const latest = getLatestSeason(seasons);
    if (!latest) return;

    const code = latest.key;
    const season = seasons[code]; 

    const seasonLabel = window._t?.['fn-season'];
    const seasonLetter = seasonLabel ? seasonLabel.trim().charAt(0).toUpperCase() : 'T';
    const match = /^c(\d+)s(\d+)$/i.exec(code);
    let prefix = '';
    prefix = `C${match[1]}${seasonLetter}${match[2]} |`;

    document.getElementById('recentSeason-image').style.backgroundImage = `url(documents://Fortnite/Assets/${code}.jpg)`;
    document.querySelector('.shine-effect-v-latest-season').style.display = 'none';
    document.getElementById('recent-season-name').textContent = `${prefix} ${season.name}`.trim();
    document.querySelector('.recent-season').dataset.season = code;

    await fillValues();
    const status = document.querySelectorAll('.status-info');
    status.forEach((e) => e.classList.add('ready'));
}

async function updateStatsJSON(status, mode, el) {
    const code = document.querySelector('.recent-season').dataset.season;
    const season = window.stats?.[code] || {};

    const previousStatus = season[status];
    const seasonStatus = Number(season[status]) || 0;
    season[status] = String(mode ? seasonStatus + 1 : Math.max(0, seasonStatus - 1));

    try { await saveJson(FORTNITE_STATS, window.stats);
    } catch (error) {
        console.error(error);
        season[status] = previousStatus;
        return;
    }

    el.textContent = season[status];
    const levelsBar = document.querySelector('.level-progress-bar-fill');
    const levelsText = document.querySelector('.level-progress-text');
    const percent = Math.max(0, Math.min((season.levels / 200) * 100, 100));
    const formatted = percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(0);
    levelsText.textContent = `${window._t['progress']} - ${formatted}%`;
    levelsBar.style.width = `${formatted}%`;
}

async function fillValues() {
    const code = document.querySelector('.recent-season').dataset.season;
    const season = window.stats?.[code] || {};
    
    const levels = document.querySelector('.status-level');
    const wins = document.querySelector('.status-win');
    const levelsBar = document.querySelector('.level-progress-bar-fill');
    const levelsText = document.querySelector('.level-progress-text');
    const levelAdd = document.querySelector('.statusLevel-add');
    const levelMinus = document.querySelector('.statusLevel-minus');
    const winAdd = document.querySelector('.statusWin-add');
    const winMinus = document.querySelector('.statusWin-minus');

    levels.textContent = season.levels || "0";
    wins.textContent = season.wins || "0";
    
    const percent = Math.max(0, Math.min((season.levels / 200) * 100, 100));
    const formatted = percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(0);
    levelsText.textContent = `${window._t['progress']} - ${formatted}%`;
    levelsBar.style.width = `${formatted}%`;

    levelAdd.onclick = async () => await updateStatsJSON('levels', true, levels);
    levelMinus.onclick = async () => await updateStatsJSON('levels', false, levels);
    winAdd.onclick = async () => await updateStatsJSON('wins', true, wins);
    winMinus.onclick = async () => await updateStatsJSON('wins', false, wins);
}

initFeaturedFortnite();