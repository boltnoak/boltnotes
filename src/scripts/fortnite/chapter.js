////////////////
/// ARQUIVOS ///
////////////////
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

    const config = await window.electronAPI.config.getConfig();
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


// const before = document.getElementById('before-chapter');
// const next = document.getElementById('next-chapter');

// async function mudarCapitulo(chapter) {
//     chapterNum = chapter;
//     currentChapter = `c${chapterNum}`;

//     const titleText = `${window._t['fn-chapter']} ${chapterNum}`;
//     document.title = `BoltNotes | Fortnite — ${titleText}`;
    
//     const chapterName = document.getElementById('chapter-name');
//     chapterName.textContent = titleText;

//     before.style.visibility = (chapterNum - 1) >= chaptersMin ? "visible" : "hidden";
//     next.style.visibility = (chapterNum + 1) <= chaptersMax ? "visible" : "hidden";

//     if (cachedSeasons) await renderizarCapitulo(currentChapter, cachedSeasons);

//     document.querySelector('.pageBody').scrollTo({ top: 0 });
// }

async function inicializarDados() {
    try {
        const cloudData = await loadCloudSeasonInfo();
        const localData = await window.electronAPI.json.load(REVIEWS_FILE);
        const statsData = await window.electronAPI.json.load(STATS_FILE);
        window.reviews = (localData && typeof localData === 'object') ? localData : {};
        window.stats = (statsData && typeof statsData === 'object') ? statsData : {};

        const data = await loadCloudSeasonInfo();
        const keys = Object.keys(data);

        // const beforeBtn = document.getElementById('before-chapter');
        // const nextBtn = document.getElementById('next-chapter');
        
        // if (beforeBtn) {
        //     beforeBtn.onclick = () => { if (chapterNum - 1 >= chaptersMin) mudarCapitulo(chapterNum - 1); };
        // }
        // if (nextBtn) {
        //     nextBtn.onclick = () => { if (chapterNum + 1 <= chaptersMax) mudarCapitulo(chapterNum + 1); };
        // }

        // await mudarCapitulo(chapterNum);
        await renderizarCapitulo(currentChapter, cloudData);

        if (typeof initVideoEvents === "function") initVideoEvents();
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

async function renderizarCapitulo(prefixoCapitulo, cloudData) {
    const container = document.getElementById('seasons-list-container');
    let localDataUpdated = false;
    let localStatsUpdated = false;

    if (!container) return;  
    container.innerHTML = '';

    document.querySelector(`.sidebar-btn-chapter[data-chapter="${currentChapter.replace('c','')}"]`).classList.add('active');
    // const aaaaa = document.querySelector(`.sidebar-btn[data-chapter="${prefixoCapitulo}"]`);
    // if (aaaaa) {
    //     document.querySelectorAll(`.sidebar-btn.active`).forEach(b => {
    //         b.classList.remove('active');
    //     });

    //     aaaaa.classList.add('active');

    // }
    // const aaa = prefixoCapitulo
    // document.querySelector(`.sidebar-btn[data-chapter="${aaa}"]`).classList.add('active')

    await getSeasonTemplate();
    await applyLocale();

    const template = document.getElementById('season-template');
    if (!template) {
        console.error("Erro: O template #season-template não foi encontrado no DOM.");
        return;
    }

    const keys = Object.keys(cloudData).filter(code => code.startsWith(prefixoCapitulo)).reverse();

    for (const code of keys) {
        const info = cloudData[code];

        if (!window.reviews[code]) {
            window.reviews[code] = { loot: "", mapa: "", passe: "", story: "" };
            localDataUpdated = true;
        }

        if (!window.stats[code]) {
            window.stats[code] = { levels: "0", wins: "0", rating: "N/A", locked: false };
            localStatsUpdated = true;
        }

        const data = window.reviews[code];
        const currentStats = window.stats[code];

        const clone = template.content.cloneNode(true);
        
        const card = clone.querySelector('.fn-season');
        if (card) card.dataset.code = code;

        const bg = clone.querySelector('.banner');
        if (bg) bg.style.backgroundImage = `url('assets://fortnite-${code}-assets/${code}.jpg')`;

        const character = clone.querySelector('.season-character');
        if (character) character.src = `assets://fortnite-${code}-assets/${code}-character.png`;

        const seasonMap = clone.querySelector('.season-map');
        if (seasonMap) seasonMap.src = `assets://fortnite-${code}-assets/${code}-map.jpg`;

        const seasonDiv = clone.querySelector('.season');
        const isLocked = currentStats.locked ?? false;
        if (seasonDiv) seasonDiv.dataset.locked = isLocked;

        const lockIcon = clone.getElementById('lock-unlock');

        if (lockIcon) {
            lockIcon.className = currentStats.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
            
            lockIcon.onclick = async (e) => {
                e.stopPropagation();

                currentStats.locked = !currentStats.locked;
                
                lockIcon.className = currentStats.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
                
                const parentSeason = lockIcon.closest('.season') || lockIcon.closest('.fn-season').querySelector('.season');
                if (parentSeason) parentSeason.dataset.locked = currentStats.locked;

                const currentCard = lockIcon.closest('.fn-season');
                if (currentCard) {
                    const displayStyle = currentStats.locked ? 'none' : 'inline-block';
                    currentCard.querySelectorAll('.statusLevel-add, .statusLevel-minus, .statusWin-add, .statusWin-minus')
                        .forEach(btn => btn.style.display = displayStyle);

                    currentCard.querySelectorAll('.review-topictext')
                        .forEach(p => p.contentEditable = !currentStats.locked);
                }

                const rContainer = currentCard.querySelector('.rating-container');
                const rOptions = currentCard.querySelector('.rating-options');
                if (rContainer) {
                    if (currentStats.locked) {
                        rContainer.classList.add('disabled');
                        rContainer.classList.remove('enabled');
                        if (rOptions) rOptions.classList.remove('active');
                    } else {
                        rContainer.classList.remove('disabled');
                        rContainer.classList.add('enabled');
                    }
                }

                try {
                    await window.electronAPI.json.save(STATS_FILE, window.stats);
                } catch (error) {
                    console.error("Erro ao salvar o estado do cadeado:", error);
                }
            }
        }

        const ratingSpan = clone.querySelector('.status-rating');
        const ratingContainer = clone.querySelector('.rating-container');
        const ratingOptionsContainer = clone.querySelector('.rating-options');

        if (isLocked && ratingContainer) {
            ratingContainer.classList.add('disabled');
        }

        else if (!isLocked && ratingContainer) {
            ratingContainer.classList.add('enabled');
        }

        if (ratingOptionsContainer) {
            const ratingOptions = Array.from(ratingOptionsContainer.querySelectorAll('.rating-option'));
            ratingOptions.sort((a, b) => parseFloat(b.getAttribute('data-value')) - parseFloat(a.getAttribute('data-value')));

            ratingOptionsContainer.innerHTML = '';
            ratingOptions.forEach(option => {
                ratingOptionsContainer.appendChild(option);

                option.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    const selectedRating = e.target.getAttribute('data-value');
                    
                    currentStats.rating = selectedRating;
                    if (ratingSpan) ratingSpan.textContent = selectedRating;
                    if (typeof debouncedSave === "function") debouncedSave(code);
                    
                    ratingOptionsContainer.classList.remove('active');
                });
            });
        }

        if (ratingContainer && ratingOptionsContainer) {
            ratingContainer.addEventListener('click', (e) => {
                if (!ratingContainer.classList.contains('disabled')) {
                    ratingOptionsContainer.classList.toggle('active');
                }
            });
        }

        const levelAdd = clone.querySelector('.statusLevel-add');
        const levelMinus = clone.querySelector('.statusLevel-minus');
        const winAdd = clone.querySelector('.statusWin-add');
        const winMinus = clone.querySelector('.statusWin-minus');

        const levelsSpan = clone.querySelector('.status-level');
        const winsSpan = clone.querySelector('.status-win');

        function updateStat(statKey, increment, displaySpan) {
            let currentValue = parseInt(currentStats[statKey]) || 0;
            if (currentValue + increment >= 0) {
                currentValue += increment;
                currentStats[statKey] = currentValue.toString(); 
                if (displaySpan) displaySpan.textContent = currentStats[statKey];
                if (typeof debouncedSave === "function") debouncedSave(code);
            }
        }

        if (levelAdd) levelAdd.onclick = () => updateStat('levels', 1, levelsSpan);
        if (levelMinus) levelMinus.onclick = () => updateStat('levels', -1, levelsSpan);
        if (winAdd) winAdd.onclick = () => updateStat('wins', 1, winsSpan);
        if (winMinus) winMinus.onclick = () => updateStat('wins', -1, winsSpan);

        if (ratingSpan) ratingSpan.id = `${code}-rating`;
        if (levelsSpan) levelsSpan.id = `${code}-levels`;
        if (winsSpan) winsSpan.id = `${code}-wins`;

        const releaseDateSpan = clone.querySelector('.releaseDate');
        if (releaseDateSpan) releaseDateSpan.id = `${code}-releaseDate`;

        if (!isLocked) {
            if (levelAdd) levelAdd.style.display = 'inline-block';
            if (levelMinus) levelMinus.style.display = 'inline-block';
            if (winAdd) winAdd.style.display = 'inline-block';
            if (winMinus) winMinus.style.display = 'inline-block';
        }

        const trailerBtn = clone.querySelector('.season-trailers');
        if (trailerBtn) trailerBtn.onclick = () => typeof openTrailer === "function" && openTrailer(trailerBtn);

        const listaDeEventos = info.events || info.event;

        const listEventsMap = clone.querySelector('.seasonContents-title');

        if (listEventsMap) {
            if (listaDeEventos && listaDeEventos.length == 1) {
                listEventsMap.textContent = 'Mapa e Evento';
                listEventsMap.setAttribute('data-i18n', 'map-event');
            } else if (listaDeEventos && listaDeEventos.length > 1) {
                listEventsMap.textContent = 'Mapa e Eventos';
                listEventsMap.setAttribute('data-i18n', 'map-events');
            } else {
                listEventsMap.textContent = 'Mapa';
                listEventsMap.setAttribute('data-i18n', 'map');
            }
        }

        if (listaDeEventos && Array.isArray(listaDeEventos)) {
            const eventsContainer = clone.querySelector('.season-contents');
            const templateEvent = clone.querySelector('.season-events');

            if (templateEvent) {
                templateEvent.remove(); 

                listaDeEventos.forEach(evt => {
                    const newEvent = templateEvent.cloneNode(true);
                    newEvent.style.display = 'flex';
                    
                    newEvent.querySelector('.event-img').src = `assets://fortnite-${code}-assets/${evt.img}` || '';
                    newEvent.querySelector('.event-title').textContent = evt.title || '';
                    newEvent.querySelector('.event-type').textContent = evt.type || '';
                    newEvent.querySelector('.event-date').textContent = evt.date || '';
                    
                    eventsContainer.insertBefore(newEvent, eventsContainer.firstChild);
                    newEvent.onclick = function() {
                        openLiveEvent(
                            this,
                            evt.img.replace(/-cover.*$/, ''),
                            evt.title || 'Evento',
                            evt.author || null,
                            evt.authorId || null
                        )
                    }
                });
            }
        }

        const titleEl = clone.querySelector('.season-title');
        if (titleEl) {
            titleEl.id = `${code}-name`;
            const m = code.match(/^c\d+s(\d+)$/);
            titleEl.textContent = m ? `${window._t['fn-season']} ${m[1]} - ${info.name || ""}` : `${window._t['fn-season']} ${info.name || ""}`;
        }

        container.appendChild(clone);
    }

    if (localDataUpdated) await window.electronAPI.json.save(REVIEWS_FILE, window.reviews);
    if (localStatsUpdated) await window.electronAPI.json.save(STATS_FILE, window.stats);

    await preencherValores();
}

async function preencherValores() {
    const allCodes = new Set([...Object.keys(window.reviews), ...Object.keys(window.stats)]);

    for (const code of allCodes) {
        const info = cachedSeasons[code] || {};
        const reviewData = window.reviews[code] || {};
        const statsData = window.stats[code] || {};

        const releaseDateFormated = await formatDate(info.releaseDate, 'ordinal');

        const rating = document.getElementById(`${code}-rating`);
        const levels = document.getElementById(`${code}-levels`);
        const wins = document.getElementById(`${code}-wins`);
        const releaseDate = document.getElementById(`${code}-releaseDate`);

        if (rating) rating.textContent = statsData.rating || "N/A";
        if (levels) levels.textContent = statsData.levels || "0";
        if (wins) wins.textContent = statsData.wins || "0";
        if (releaseDate) {
            releaseDate.textContent = releaseDateFormated ? ` ${releaseDateFormated}` : "Sem data";
        }
    };

    if (typeof initReviews === "function") {
        initReviews();
    }
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
        
        mapImage.style.backgroundImage = `url('assets://fortnite-${code}-assets/${code}-map.jpg')`;
        
        configurarZoomMapa(); 
        resetarZoomMapa();    
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
            resetarZoomMapa();
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

function configurarZoomMapa() {
    if (isZoomInitialized) return;

    const mapImageEl = document.getElementById("mapPopup-image");
    const container = document.querySelector(".mapPopup-content");
    
    if (!mapImageEl || !container) return;

    mapImageEl.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        const zoomSpeed = 0.2;
        const oldScale = scale;

        if (e.deltaY < 0) {
            scale += zoomSpeed;
        } else {
            scale -= zoomSpeed;
        }
        scale = Math.min(Math.max(1, scale), 10);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        translateX = mouseX - (mouseX - translateX) * (scale / oldScale);
        translateY = mouseY - (mouseY - translateY) * (scale / oldScale);

        aplicarRestricoesBorda(container);
        atualizarTransform();
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

        aplicarRestricoesBorda(container);
        atualizarTransform();
    });

    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;

            mapImageEl.classList.remove("dragging"); 
        }
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    isZoomInitialized = true;
}

function aplicarRestricoesBorda(container) {
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

function atualizarTransform() {
    const mapImageEl = document.getElementById("mapPopup-image");
    if (mapImageEl) {
        mapImageEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
}

function resetarZoomMapa() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    atualizarTransform();
}

if (document.querySelector('.back')) document.querySelector('.back').href = `pages/fortnite.html`;

if (document.readyState === "complete" || document.readyState === "interactive") {
    inicializarDados();
} else {
    document.addEventListener("DOMContentLoaded", inicializarDados);
}

window.electronAPI.onCacheUpdated?.((info) => {
    if (info.fileName.startsWith('fn-seasons')) {
        cachedSeasons = info.data;
    }
});

fetchVideoPopup();

async function loadChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
            .filter(Boolean)
    )];

    document.querySelector('.sidebar-chapter-section').innerHTML = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a class="sidebar-btn sidebar-btn-chapter" data-chapter="${number}" href="pages/fortnite-chapter.html?num=${number}">
                    <p class="sidebar-btn-number">${number}</p>
                    <span><span data-i18n="fn-chapter">Capítulo</span> ${number}</span>
                </a>`;
    }).join('');
    applyLocale();
}
loadChapters();