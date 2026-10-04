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
    const language = config.language || "pt-BR";

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

function debouncedSave(code) {
    clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        const rating = document.getElementById(`${code}-rating`)?.textContent || "0";
        const levels = document.getElementById(`${code}-levels`)?.textContent || "0";
        const wins = document.getElementById(`${code}-wins`)?.textContent || "0";

        const gameplay = document.getElementById(`${code}-gameplay`)?.innerHTML.replace(/<br>/, "") || "";
        const loot = document.getElementById(`${code}-loot`)?.innerHTML.replace(/<br>/, "") || "";
        const mapa = document.getElementById(`${code}-mapa`)?.innerHTML.replace(/<br>/, "") || "";
        const passe = document.getElementById(`${code}-passe`)?.innerHTML.replace(/<br>/, "") || "";
        const story = document.getElementById(`${code}-story`)?.innerHTML.replace(/<br>/, "") || "";

        window.reviews[code] = { 
            ...window.reviews[code], 
            gameplay,
            loot,
            mapa,
            passe,
            story
        };

        window.stats[code] = {
            ...window.stats[code],
            rating, 
            levels, 
            wins
        };

        try {
            await saveJson(REVIEWS_FILE, window.reviews);
            await saveJson(STATS_FILE, window.stats);
            
            console.log(`Fortnite - Dados da temporada ${code.toUpperCase().replace('S', 'T')} salvos com sucesso!`);
        } catch (err) {
            console.error(`${code}:`, err);
        }
    }, 200);
}

async function initData() {
    try {
        const data = await loadCloudSeasonInfo();
        const localData = await loadJson(REVIEWS_FILE);
        const statsData = await loadJson(STATS_FILE);

        window.reviews = (localData && typeof localData === 'object') ? localData : {};
        window.stats = (statsData && typeof statsData === 'object') ? statsData : {};

        await renderChapter(data);
    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

async function getSeasonTemplate() {
    if (document.getElementById('season-template')) return;
    try {
        const res = await fetch('components/fortnite/seasons-template.bolt');
        const data = await res.text();
        document.body.insertAdjacentHTML('afterbegin', data);
    } catch (err) {
        console.error("Erro ao carregar/injetar o template:", err);
    }
}

async function renderChapter(seasonsData) {
    const listContainer = document.getElementById('seasons-list-container');
    let localDataUpdated = false;
    let localStatsUpdated = false;

    if (!listContainer) return;  
    listContainer.innerHTML = '';

    if (window.parent) {
        window.parent.document.querySelectorAll('.sidebar-btn-chapter').forEach(btn => btn.classList.remove('active'));
        const activeSidebarBtn = window.parent.document.querySelector(`.sidebar-btn-chapter[data-chapter="${currentChapter.replace('c','')}"]`);
        if (activeSidebarBtn) { activeSidebarBtn.classList.add('active'); }
    }

    await getSeasonTemplate();
    await applyLocale();

    const template = document.getElementById('season-template');
    if (!template) {
        console.error("Seasons template not found");
        return;
    }

    const keys = Object.keys(seasonsData).filter(code => code.startsWith(currentChapter)).reverse();

    for (const code of keys) {
        const info = seasonsData[code];

        if (!window.reviews[code]) {
            window.reviews[code] = { loot: "", mapa: "", passe: "", story: "" };
            localDataUpdated = true;
        }
        if (!window.stats[code]) {
            window.stats[code] = { levels: "0", wins: "0", rating: "N/A", locked: false };
            localStatsUpdated = true;
        }

        const stats = window.stats[code];
        const clone = template.content.cloneNode(true);

        ///////////////////////
        /// SEASON ELEMENTS ///
        ///////////////////////
        const card = clone.querySelector('.fn-season');
        const seasonDiv = clone.querySelector('.season');
        const titleEl = clone.querySelector('.season-title');
        const lockIcon = clone.getElementById('lock-unlock');

        const bg = clone.querySelector('.banner');
        const character = clone.querySelector('.season-character');
        const seasonMap = clone.querySelector('.season-map');

        const ratingSpan = clone.querySelector('.status-rating');
        const levelsSpan = clone.querySelector('.status-level');
        const winsSpan = clone.querySelector('.status-win');
        const ratingContainer = clone.querySelector('.rating-container');
        const ratingOptionsContainer = clone.querySelector('.rating-options');
        const levelAdd = clone.querySelector('.statusLevel-add');
        const levelMinus = clone.querySelector('.statusLevel-minus');
        const winAdd = clone.querySelector('.statusWin-add');
        const winMinus = clone.querySelector('.statusWin-minus');
        const releaseDateSpan = clone.querySelector('.releaseDate');

        if (card) card.dataset.code = code;
        if (titleEl) {
            titleEl.id = `${code}-name`;
            const m = code.match(/^c\d+s(\d+)$/);
            titleEl.textContent = m ? `${window._t['fn-season']} ${m[1]} - ${info.name || ""}` : `${window._t['fn-season']} ${info.name || ""}`;
        }

        if (releaseDateSpan) releaseDateSpan.id = `${code}-releaseDate`;
        if (bg) bg.style.backgroundImage = `url('documents://Fortnite/Assets/${code}.jpg')`;
        if (character) character.src = `documents://Fortnite/Assets/${code}-character.png`;
        if (seasonMap) seasonMap.src = `documents://Fortnite/Assets/${code}-map.jpg`;

        if (ratingSpan) ratingSpan.id = `${code}-rating`;
        if (levelsSpan) levelsSpan.id = `${code}-levels`;
        if (winsSpan) winsSpan.id = `${code}-wins`;

        function updateStat(statKey, increment, displaySpan) {
            let currentValue = parseInt(stats[statKey]) || 0;
            if (currentValue + increment >= 0) {
                currentValue += increment;
                stats[statKey] = currentValue.toString(); 
                if (displaySpan) displaySpan.textContent = stats[statKey];
                if (typeof debouncedSave === "function") debouncedSave(code);
            }
        }

        if (levelAdd) levelAdd.onclick = () => updateStat('levels', 1, levelsSpan);
        if (levelMinus) levelMinus.onclick = () => updateStat('levels', -1, levelsSpan);
        if (winAdd) winAdd.onclick = () => updateStat('wins', 1, winsSpan);
        if (winMinus) winMinus.onclick = () => updateStat('wins', -1, winsSpan);


        const isLocked = stats.locked ?? false;
        if (seasonDiv) seasonDiv.dataset.locked = isLocked;

        if (!isLocked) {
            if (levelAdd) levelAdd.style.display = 'inline-block';
            if (levelMinus) levelMinus.style.display = 'inline-block';
            if (winAdd) winAdd.style.display = 'inline-block';
            if (winMinus) winMinus.style.display = 'inline-block';
        }

        if (lockIcon) {
            lockIcon.className = stats.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
            lockIcon.onclick = async (e) => {
                e.stopPropagation();
                stats.locked = !stats.locked;

                seasonDiv.dataset.locked = stats.locked;
                lockIcon.className = stats.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';

                const display = stats.locked ? 'none' : 'inline-block';
                seasonDiv.querySelectorAll('.statusLevel-add, .statusLevel-minus, .statusWin-add, .statusWin-minus')
                    .forEach(btn => btn.style.display = display);
                seasonDiv.querySelectorAll('.review-topictext')
                    .forEach(p => p.contentEditable = !stats.locked);

                if (stats.locked === true) {
                    ratingContainer.classList.remove('enabled');
                } else { ratingContainer.classList.add('enabled'); }
                ratingOptionsContainer.classList.remove('active');

                try { await saveJson(STATS_FILE, window.stats);
                } catch (error) { console.error(error); }
            }
        }

        if (!isLocked) {ratingContainer.classList.add('enabled');}
        ratingContainer.addEventListener('click', () => {
            if (ratingContainer.classList.contains('enabled')) {
                ratingOptionsContainer.classList.toggle('active');
            }
        });
        if (ratingOptionsContainer) {
            const ratingOptions = Array.from(ratingOptionsContainer.querySelectorAll('.rating-option'));
            ratingOptions.sort((a, b) => parseFloat(b.getAttribute('data-value')) - parseFloat(a.getAttribute('data-value')));

            ratingOptionsContainer.innerHTML = '';
            ratingOptions.forEach(option => {
                ratingOptionsContainer.appendChild(option);

                option.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    const selectedRating = e.target.getAttribute('data-value');

                    stats.rating = selectedRating;
                    ratingSpan.textContent = selectedRating;

                    if (typeof debouncedSave === "function") debouncedSave(code);
                    ratingOptionsContainer.classList.remove('active');
                });
            });
        }

        listContainer.appendChild(clone);
    }

    if (localDataUpdated) await saveJson(REVIEWS_FILE, window.reviews);
    if (localStatsUpdated) await saveJson(STATS_FILE, window.stats);

    await fillValues();
}

async function fillValues() {
    const seasons = new Set([...Object.keys(window.reviews), ...Object.keys(window.stats)]);

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
            const releaseDateFormated = await formatDate(info.releaseDate, 'ordinal');
            releaseDate.textContent = releaseDateFormated ? ` ${releaseDateFormated}` : "Sem data";
        }
    };

    if (typeof initReviews === "function") { initReviews(); }
}

addEventListener('click', (e) => {
    if (e.target.matches('.season-map')) openMap(e.target);
});

////////////////////////////
/// VISUALIZAÇÃO DE MAPA ///
////////////////////////////
function openMap(el) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;

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

if (document.readyState === "complete" || document.readyState === "interactive") { initData();
} else { document.addEventListener("DOMContentLoaded", initData); }

async function loadChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

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
        return `<a class="sidebar-btn sidebar-btn-chapter" data-chapter="${number}" data-nav="pages/fortnite-chapter.html?num=${number}">
                    <p class="sidebar-btn-number">${number}</p>
                    <span><span data-i18n="fn-chapter">Capítulo</span> ${number}</span>
                </a>`;
    }).join('');
    if (window.parent && typeof window.parent.setFortniteChapters === 'function') {
        window.parent.setFortniteChapters(chaptersHtml);
        const urlParams = new URLSearchParams(window.location.search);
        const currentNum = urlParams.get('num');
        if (currentNum) {
            window.parent.document.querySelectorAll('.sidebar-btn-chapter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.chapter === currentNum);
            });
        }
    }
}
loadChapters();

const noteTexts = document.querySelectorAll('.review-topictext');
function updatePlaceholder(el) {
  const isEmpty = el.textContent.trim() === "";
  el.classList.toggle("is-empty", isEmpty);
}
noteTexts.forEach(el => { 
    noteText.addEventListener("input", updatePlaceholder);
});
document.addEventListener("input", (e) => {
  const el = e.target.closest('.review-topictext');
  if (el) updatePlaceholder(el);
});