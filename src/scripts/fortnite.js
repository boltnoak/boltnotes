// JSON FILES
const REVIEWS_FILE = "Fortnite/reviews.json";
const STATS_FILE = "Fortnite/stats.json";

const urlParams = new URLSearchParams(window.location.search);

/////////////////
/// VARIÁVEIS ///
/////////////////
let reviews = {};
let stats = {};
let cachedSeasons = null;
let seasonTemplateHTML = null;
let chapterNum = parseInt(urlParams.get('num'), 10) || 3;
let currentChapter = `c${chapterNum}`;
let chaptersMax = null;
let chaptersMin = null;

async function loadCloudSeasonInfo() {
    if (cachedSeasons) return cachedSeasons;

    const config = await getConfig();
    const language = config.language || "en";

    const url = `https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-seasons-${language}.json`;

    const content = await fetchWithCache(url, `fn-seasons-${language}`);
    cachedSeasons = content || {};
    return cachedSeasons;
}

document.addEventListener('DOMContentLoaded', async () => {
    const data = await loadCloudSeasonInfo();
    const keys = Object.keys(data);

    const chaptersCount = keys.map(key => 
        parseInt(key.match(/^c(\d+)/i)?.[1] ?? 0, 10)
    );

    chaptersMax = Math.max(...chaptersCount);
    chaptersMin = Math.min(...chaptersCount);
});

const saveTimeouts = {};

function debouncedSave(code) {
    if (!code) return;

    const review = {};
    document.querySelectorAll('.season-popup-review .review-topictext').forEach(el => {
        review[el.dataset.field] = el.textContent;
    });

    clearTimeout(saveTimeouts[code]);
    saveTimeouts[code] = setTimeout(async () => {
        window.reviews[code] = { ...window.reviews[code], ...review };
        try {
            await saveJson(REVIEWS_FILE, window.reviews);
            await saveJson(STATS_FILE, window.stats);
        } catch (err) {
            console.error(`${code}:`, err);
        }
    }, 200);
}

async function initFortnitePage() {
    await initData();
    await Promise.all([loadChaptersGrid(), loadChapters()]);
}

async function bootFortnite() {
    const screen = document.getElementById('loading-screen');
    const text = document.getElementById('loading-text');
    const progress = document.querySelector('.progress');
    const bar = document.getElementById('fortnite-progress');

    // 1) Já tem assets locais: abre na hora, atualiza em segundo plano
    if (await readLocalManifest()) {
        screen.remove();
        await initFortnitePage();

        syncFortniteAssets()
            .then((r) => { if (r?.updated) refreshAfterAssetUpdate(); })
            .catch((err) => console.warn('Assets - atualização em segundo plano:', err.message));
        return;
    }

    // 2) Primeira vez: precisa baixar, então bloqueia com progresso (como antes)
    let screenShown = false;
    const showScreen = () => {
        if (screenShown) return;
        screenShown = true;
        screen.style.display = '';
    };

    try {
        await syncFortniteAssets(({ done, total }) => {
            showScreen();
            progress.classList.add('active');
            const mb = (n) => (n / 1048576).toFixed(1);
            text.textContent = `${mb(done)} / ${mb(total)} MB`;
            bar.style.width = `${total ? (done / total) * 100 : 0}%`;
        });
        await initFortnitePage();
    } catch (err) {
        showScreen();
        text.textContent = err.message;
        return;
    }

    if (!screenShown) { screen.remove(); return; }
    screen.classList.add('hide');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
}

async function refreshAfterAssetUpdate() {
    const data = await loadCloudSeasonInfo();
    if (urlParams.has('num')) await renderChapter(data, currentChapter);
    await loadChaptersGrid();
}
bootFortnite();

async function initData() {
    try {
        const data = await loadCloudSeasonInfo();
        const localData = await loadJson(REVIEWS_FILE);
        let statsData;
        try {
            statsData = await loadJson(STATS_FILE);
        } catch (e) {
            console.error("Falha ao ler stats, abortando para não sobrescrever", e);
            return;
        }

        window.reviews = (localData && typeof localData === 'object') ? localData : {};
        window.stats = (statsData && typeof statsData === 'object') ? statsData : {};

        let added = false;
        for (const code of Object.keys(data)) {
            if (!window.stats[code]) {
                window.stats[code] = { rating: "N/A", levels: "0", wins: "0", locked: false };
                added = true;
            }
        }
        if (added) await saveJson(STATS_FILE, window.stats);

        const hasChapter = urlParams.has('num');

        if (hasChapter) {
            await renderChapter(data, currentChapter);
        } else {
            await toggleChapterGrid();
        }
    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

document.querySelector('.statusLevel-add').addEventListener('click', async () => {
    await updateStatsJSON('levels', true);
})
document.querySelector('.statusLevel-minus').addEventListener('click', async () => {
    await updateStatsJSON('levels', false);
})
document.querySelector('.statusWin-add').addEventListener('click', async () => {
    await updateStatsJSON('wins', true);
})
document.querySelector('.statusWin-minus').addEventListener('click', async () => {
    await updateStatsJSON('wins', false);
})

async function updateStatsJSON(status, mode) {
    const code = document.querySelector('.season-popup-div').dataset.season;
    const season = window.stats?.[code];
    if (!season) return;

    const previousStatus = season[status];
    const seasonStatus = Number(season[status]) || 0;
    season[status] = String(mode ? seasonStatus + 1 : Math.max(0, seasonStatus - 1));

    try { await saveJson(STATS_FILE, window.stats);
    } catch (error) {
        console.error(error);
        season[status] = previousStatus;
        return;
    }

    const textPopup = document.querySelector(`.season-popup-${status}`);
    const textSeason = document.getElementById(`${code}-${status}`);
    textPopup.textContent = season[status];
    textSeason.textContent = season[status];
}

async function renderChapter(seasonsData, chapter) {
    const list = document.getElementById('seasons-list-container');

    if (!list) return;  
    list.innerHTML = '';

    document.querySelectorAll('.chapter-list-chapter').forEach(btn => btn.classList.remove('active'));
    const activeChapterBtn = document.querySelector(`.chapter-list-chapter[data-chapter="${chapter.replace('c','')}"]`);
    if (activeChapterBtn) { activeChapterBtn.classList.add('active'); }

    const template = document.getElementById('season-template');
    const keys = Object.keys(seasonsData).filter(code => code.startsWith(chapter)).reverse();
    for (const code of keys) {
        const info = seasonsData[code];
        const clone = template.content.cloneNode(true);

        const card = clone.querySelector('.fn-season');
        card.addEventListener('click', () => {
            openSeasonPopup(code);
        });

        const title = clone.querySelector('.season-title');
        const bg = clone.querySelector('.season-banner');
        const seasonMap = clone.querySelector('.season-map');

        const ratingSpan = clone.querySelector('.status-rating');
        const levelsSpan = clone.querySelector('.status-level');
        const winsSpan = clone.querySelector('.status-win');
        const releaseDateSpan = clone.querySelector('.releaseDate');

        if (card) card.dataset.code = code;
        if (title) {
            const match = /^c(\d+)s(\d+)$/i.exec(code);
            const isMiniSeason = /^c\d+ms\d+$/i.test(code);
            let prefix = '';
            if (match) {
                prefix = `${window._t?.['fn-season']} ${match[2]} —`;
            } else if (!isMiniSeason) {
                prefix = window._t?.['fn-season'] || '';
            }
            title.textContent = `${prefix} ${info.name}`.trim();
        }

        if (releaseDateSpan) releaseDateSpan.id = `${code}-releaseDate`;
        if (bg) bg.style.backgroundImage = `url('documents://Fortnite/Assets/${code}.jpg')`;
        if (seasonMap) seasonMap.src = `documents://Fortnite/Assets/${code}-map.jpg`;

        if (ratingSpan) ratingSpan.id = `${code}-rating`;
        if (levelsSpan) levelsSpan.id = `${code}-levels`;
        if (winsSpan) winsSpan.id = `${code}-wins`;

        list.appendChild(clone);
        await fillValues();
    }
}

async function fillValues() {
    const seasons = new Set([...Object.keys(window.stats)]);

    for (const code of seasons) {
        const info = cachedSeasons[code] || {};
        const statsData = window.stats[code] || {};

        const rating = document.getElementById(`${code}-rating`);
        const levels = document.getElementById(`${code}-levels`);
        const wins = document.getElementById(`${code}-wins`);
        const releaseDate = document.getElementById(`${code}-releaseDate`);

        if (rating) rating.textContent = statsData.rating || "N/A";
        if (levels) levels.textContent = statsData.levels || "0";
        if (wins) wins.textContent = statsData.wins || "0";
        if (releaseDate) {
            const releaseDateFormated = await formatDate(info.releaseDate, 'default');
            releaseDate.textContent = releaseDateFormated ? ` ${releaseDateFormated}` : "Sem data";
        }
    }
}

////////////////////////////
/// VISUALIZAÇÃO DE MAPA ///
////////////////////////////
document.addEventListener('click', (e) => {
    const mapEl = e.target.closest('.season-popup-map');
    if (mapEl) openMap(mapEl);
});

function openMap(el) {
    const code = el.dataset.code;
    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.getElementById("mapPopup-image");

    if (mapPopup && mapImage && code) {
        mapPopup.style.display = "flex";
        
        mapImage.style.backgroundImage = `url('documents://Fortnite/Assets/${code}-map.jpg')`;
        
        prepZoom();
        resetMapZoom();
    }
}

function closeMap(el) {
    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.querySelector(".mapPopup-div");

    if (mapPopup && mapImage) {
        mapImage.classList.remove("open");
        mapImage.classList.add("close");

        mapPopup.addEventListener("animationend", function handler() {
            mapPopup.style.display = "none";
            mapPopup.classList.remove("close");
            resetMapZoom();
            mapPopup.removeEventListener("animationend", handler);
            mapImage.classList.remove("close");
        });
    }
}

let scale = 1;
let isDragging = false;
let startX, startY;
let translateX = 0, translateY = 0;
let isZoomInitialized = false;

function prepZoom() {
    const mapImageEl = document.getElementById("mapPopup-image");
    const container = document.querySelector(".mapPopup-content");

    if (isZoomInitialized || !mapImageEl || !container) return;

    mapImageEl.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        const zoomSpeed = 0.2;
        const oldScale = scale;

        if (e.deltaY < 0) { scale += zoomSpeed;
        } else { scale -= zoomSpeed; }
        scale = Math.min(Math.max(1, scale), 10);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        translateX = mouseX - (mouseX - translateX) * (scale / oldScale);
        translateY = mouseY - (mouseY - translateY) * (scale / oldScale);

        applyBorderRestrictions(container);
        updateTransform();
    }, { passive: false });

    mapImageEl.addEventListener("mousedown", (e) => {
        if (scale === 1) return;
        isDragging = true;

        mapImageEl.classList.add("dragging"); 
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });
    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;

        applyBorderRestrictions(container);
        updateTransform();
    });
    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;

            mapImageEl.classList.remove("dragging"); 
        }
    });
    window.addEventListener("mouseup", () => { isDragging = false; });

    isZoomInitialized = true;
}

function applyBorderRestrictions(container) {
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const larguraZoom = cw * scale;
    const alturaZoom = ch * scale;

    const minX = cw - larguraZoom;
    const maxX = 0;
    const minY = ch - alturaZoom;
    const maxY = 0;

    translateX = Math.min(Math.max(translateX, minX), maxX);
    translateY = Math.min(Math.max(translateY, minY), maxY);
}

function updateTransform() {
    const mapImageEl = document.getElementById("mapPopup-image");
    if (mapImageEl) {
        mapImageEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
}

function resetMapZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

async function bindSidebarEvents() {
    document.querySelectorAll('.chapter-list-chapter[data-nav]').forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            document.body.classList.remove('chaptersList');
            document.querySelector('.chapter-list-chapters-grid').classList.remove('active');
            await navigateShell(btn.dataset.nav, btn.dataset.chapter);
        };
    });
    document.querySelectorAll('#chapter[data-nav]').forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            document.body.classList.remove('chaptersList');
            document.querySelector('.chapter-list-chapters-grid').classList.remove('active');
            await navigateShell(btn.dataset.nav, btn.dataset.chapter);
        };
    });
}

const chaptersGridBtn = document.querySelector('.chapter-list-chapters-grid');
chaptersGridBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await toggleChapterGrid(chaptersGridBtn.dataset.nav);
})
async function toggleChapterGrid() {
    const page = 'pages/fortnite.html';
    const filename = page.split('/').pop().split('.')[0].split('?')[0];
    if (filename.includes('fortnite')) { setFortniteLastUrl(page); }

    document.body.classList.add('chaptersList');
    document.querySelectorAll('.chapter-list-chapter').forEach((e) => {
        e.classList.remove('active');
    })
    chaptersGridBtn.classList.add('active');
}

async function loadChaptersGrid() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
    )];

    document.querySelector('.chapter-section').innerHTML = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a id="chapter" data-chapter="${number}" class="button" data-nav="pages/fortnite.html?num=${number}">
                    <div class="chapter-image-div">
                        <img class="chapter-image" src="documents://Fortnite/Assets/chapter${number}-cover.jpg">
                    </div>
                    <p class="title"><span data-i18n="fn-chapter">Capítulo</span> ${number}</p>
                </a>`;
    }).join('');
    applyLocale();
}

function getFortniteLastUrl() {
    return sessionStorage.getItem('fortniteLastUrl');
}
function setFortniteLastUrl(url) {
    sessionStorage.setItem('fortniteLastUrl', url);
}
async function navigateShell(page, chpater) {
    const filename = page.split('/').pop().split('.')[0].split('?')[0];

    if (filename.includes('fortnite')) {
        setFortniteLastUrl(page);
    }
    const data = await loadCloudSeasonInfo();

    await renderChapter(data, 'c' + chpater);
}
async function loadChapters() {
    const list = document.querySelector('.chapter-list');
    const data = await loadCloudSeasonInfo();
    if (!data || !list) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
            .filter(Boolean)
    )].sort((a, b) => {
        const numA = parseInt(a.replace('c', ''), 10);
        const numB = parseInt(b.replace('c', ''), 10);
        return numB - numA;
    });
    const chaptersHtml = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a class="chapter-list-chapter top-tab" data-chapter="${number}" data-nav="pages/fortnite.html?num=${number}">
                    <i class="fa-solid fa-book"></i>
                    <span><span data-i18n="fn-chapter">Capítulo</span> ${number}</span>
                </a>`;
    }).join('');
    list.insertAdjacentHTML('beforeend', chaptersHtml);
    const urlParams = new URLSearchParams(window.location.search);
    const currentNum = urlParams.get('num');
    if (currentNum) {
        document.querySelectorAll('.chapter-list-chapter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.chapter === currentNum);
        });
    }
    await bindSidebarEvents();
}

document.querySelector('.chapter-list')?.addEventListener('wheel', e => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    document.querySelector('.chapter-list').scrollLeft += e.deltaY;
}, { passive: false });

const noteTexts = document.querySelectorAll('.review-topictext');
function updatePlaceholder(el) {
  el.classList.toggle('is-empty', el.textContent.trim() === '');
}
document.addEventListener('input', (e) => {
  const el = e.target.closest('.review-topictext');
  if (el) updatePlaceholder(el);
});
noteTexts.forEach(el => {
  el.addEventListener('input', () => updatePlaceholder(el));
});

function initReviews(code, isLock) {
    const data = window.reviews?.[code] || {};

    document.querySelectorAll('.season-popup-review .review-topictext').forEach(el => {
        el.textContent = data[el.dataset.field] ?? '';
        el.contentEditable = isLock ? 'false' : 'plaintext-only';
        updatePlaceholder(el);
    });
}

async function openSeasonPopup(code) {
    const data = await loadCloudSeasonInfo();
    const season = data[code];
    const stats = window.stats?.[code] || {};

    const popupDiv = document.querySelector('.season-popup-div');
    const popup = document.querySelector('.season-popup');
    popupDiv.dataset.season = code;
    const banner = document.querySelector('.season-popup-banner');
    const map = document.querySelector('.season-popup-map');
    const character = document.querySelector('.season-popup-character');
    const name = document.querySelector('.season-popup-name');
    const releaseDate = document.querySelector('.season-popup-releaseDate');
    const wins = document.querySelector('.season-popup-wins');
    const levels = document.querySelector('.season-popup-levels');
    const rating = document.querySelector('.season-popup-rating');
    const lock = document.querySelector('.season-popup-lock');
    const statusChangers = document.querySelectorAll('.status-changer');
    const ratingToggle = document.querySelector('.season-popup-rating-div');

    banner.src = `documents://Fortnite/Assets/${code}.jpg`;
    map.src = `documents://Fortnite/Assets/${code}-map.jpg`;
    character.src = `documents://Fortnite/Assets/${code}-character.png`;
    map.dataset.code = code;

    const seasonLabel = window._t?.['fn-season'];
    const seasonLetter = seasonLabel ? seasonLabel.trim().charAt(0).toUpperCase() : 'T';
    const match = /^c(\d+)s(\d+)$/i.exec(code);
    const isMiniSeason = /^c\d+ms\d+$/i.test(code);
    let prefix = '';
    if (match) {
        prefix = `C${match[1]}${seasonLetter}${match[2]} —`;
    } else if (!isMiniSeason) {
        prefix = seasonLabel || 'Temporada';
    }
    name.textContent = `${prefix} ${season.name}`.trim();

    releaseDate.textContent = await formatDate(season.releaseDate, 'default');
    wins.textContent = stats.wins;
    levels.textContent = stats.levels;
    rating.textContent = stats.rating;

    const isLock = stats.locked;
    lock.classList.toggle('locked', !isLock);
    lock.classList.toggle('active', isLock);
    lock.textContent = isLock ? `${window._t['locked-edit']}` : `${window._t['lock-edit']}`;
    statusChangers.forEach((e) => {
        e.style.display = isLock ? 'none' : 'flex';
    });
    ratingToggle.classList.toggle('button', !isLock);

    await applyLocale();
    initReviews(code, isLock);

    popupDiv.style.display = 'flex';
    popup.scrollTop = 0;
}
async function lockSeasonToggle() {
    const popup = document.querySelector('.season-popup-div');
    const code = popup.dataset.season;
    const lock = document.querySelector('.season-popup-lock');
    const statusChangers = document.querySelectorAll('.status-changer');
    const ratingToggle = document.querySelector('.season-popup-rating-div');

    const stats = window.stats?.[code] || {};
    stats.locked = !stats.locked;

    try { await saveJson(STATS_FILE, window.stats);
    } catch (error) {
        console.error(error);
        return;
    }

    const isLock = stats.locked;
    const from = lock.getBoundingClientRect().width;

    lock.classList.toggle('locked', !isLock);
    lock.classList.toggle('active', isLock);
    lock.textContent = isLock ? `${window._t['locked-edit']}` : `${window._t['lock-edit']}`;
    statusChangers.forEach((e) => {
        e.style.display = isLock ? 'none' : 'flex';
    });
    ratingToggle.classList.toggle('button', !isLock);
    await applyLocale();

    document.querySelectorAll('.season-popup-review .review-topictext').forEach(el => {
        el.contentEditable = isLock ? 'false' : 'plaintext-only';
    });

    const to = lock.getBoundingClientRect().width;
    if (from !== to) {
        lock.animate(
            { width: [`${from}px`, `${to}px`] },
            { duration: 150, easing: 'ease' }
        );
    }
}
async function changeRating(value) {
    const code = document.querySelector('.season-popup-div').dataset.season;
    const season = window.stats?.[code] || {};

    season.rating = value === 'N/A' ? 'N/A' : Number(value);
    try { await saveJson(STATS_FILE, window.stats);
    } catch (error) {
        console.error(error);
        return;
    }

    const textPopup = document.querySelector('.season-popup-rating');
    const textSeason = document.getElementById(`${code}-rating`);
    textPopup.textContent = value;
    textSeason.textContent = value
}

document.querySelector('.season-popup-rating-div').addEventListener('click', () => {
    if (document.querySelector('.season-popup-rating-div').classList.contains('button')) {
        document.querySelector('.rating-options').classList.toggle('active');
        document.querySelector('.rating-options').scrollTop = -9999;
    }
});
document.querySelectorAll('.rating-option').forEach((e) => {
    e.addEventListener('click', async () => {
        await changeRating(e.dataset.value);
    })
});
document.querySelector('.season-popup-close')?.addEventListener('click', (e) => {
    const seasonPopupDiv = document.querySelector('.season-popup-div');
    if (e.target === document.querySelector('.season-popup-close')) {
        seasonPopupDiv.classList.add('is-closing');
        
        seasonPopupDiv.addEventListener('animationend', () => {
            seasonPopupDiv.style.display = 'none';
            seasonPopupDiv.classList.remove('is-closing');
        }, { once: true });
    }
});

document.querySelector('.season-popup-review-map-character')?.addEventListener('input', () => {
    debouncedSave(document.querySelector('.season-popup-div').dataset.season);
});

document.querySelector('.season-popup-info')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.statusWin-add, .statusWin-minus');
    if (!btn) return;

    const code = document.querySelector('.season-popup-div').dataset.season;
    const stats = window.stats[code];
    if (!stats || stats.locked) return;

    const span = btn.closest('.status').querySelector('span');
    const key = span.classList.contains('season-popup-levels') ? 'levels' : 'wins';
    const delta = btn.classList.contains('statusWin-add') ? 1 : -1;

    const value = Math.max(0, (parseInt(stats[key]) || 0) + delta);
    stats[key] = value.toString();
    span.textContent = stats[key];
    const cardSpan = document.getElementById(`${code}-${key}`);
    if (cardSpan) cardSpan.textContent = stats[key];

    debouncedSave(code);
});