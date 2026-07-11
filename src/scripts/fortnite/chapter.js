const FILE = "Fortnite/reviews.json";
const FILE_STATS = "Fortnite/stats.json";

let reviews = {};
let stats = {};
let cachedSeasonInfo = null;
let seasonTemplateHTML = null;

async function loadHeader() {
    document.body.insertAdjacentHTML('afterbegin', `
        <header>
            <a class="back">Voltar</a>
            <a class="home" href="pages/index.html"></a>
            <div class="chapter-section">
                <i id="before-chapter"></i>
                <p id="chapter-name"></p>
                <i id="next-chapter"></i>
            </div>
            <!--<a class="chapters"></a>-->
        </header>`);
    
    const chapterBtn = document.querySelector('.chapters');
    const chaptersa = document.getElementById('chapters-popup');

    if (chapterBtn && chaptersa) {
        chapterBtn.addEventListener('click', () => {
            if (chaptersa.style.display === 'none' || chaptersa.style.display === '') {
                chaptersa.style.display = 'flex';
            } else {
                chaptersa.style.display = 'none';
            }
        });
    }
}
loadHeader();

const backIcon = document.createElement('i');
backIcon.className = 'fa-solid fa-caret-left';
const homeIcon = document.createElement('i');
homeIcon.className = 'fa-solid fa-home';

if (document.querySelector('.back')) document.querySelector('.back').appendChild(backIcon);
if (document.querySelector('.home')) document.querySelector('.home').appendChild(homeIcon);

const chaptersIcon = document.createElement('i');
chaptersIcon.className = 'fa-solid fa-book';

if (document.querySelector('.chapters')) document.querySelector('.chapters').appendChild(chaptersIcon);

const urlParams = new URLSearchParams(window.location.search);
let chapterNum = parseInt(urlParams.get('num'), 10) || 3;
let CURRENT_CHAPTER = `c${chapterNum}`;

async function mudarCapitulo(novoCapituloNum) {
    chapterNum = novoCapituloNum;
    CURRENT_CHAPTER = `c${chapterNum}`;

    const titleText = `Capítulo ${chapterNum}`;
    document.title = `BoltNotes — Fortnite ${titleText}`;
    const menuTitle = document.getElementById('menuTitle');
    menuTitle.textContent = `BoltNotes — Fortnite ${titleText}`;
    
    const chapterNameEl = document.getElementById('chapter-name');
    if (chapterNameEl) chapterNameEl.textContent = titleText;

    const before = document.getElementById('before-chapter');
    const next = document.getElementById('next-chapter');
    
    const data = await window.api.fortnite.getSeasons();
    const keys = Object.keys(data);

    const chaptersCount = keys.map(chave => {
        const match = chave.match(/c(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    });

    const chaptersMax = Math.max(...chaptersCount);

    if (before) before.style.visibility = (chapterNum - 1) >= 1 ? "visible" : "hidden";
    if (next) next.style.visibility = (chapterNum + 1) <= chaptersMax ? "visible" : "hidden";

    if (cachedSeasonInfo) {
        await renderizarCapitulo(CURRENT_CHAPTER, cachedSeasonInfo);
        
        if (typeof initVideoEvents === "function") initVideoEvents();
    }

    const scroll = document.querySelector('.pageBody');
    if (scroll) {
        scroll.scrollTo({ top: 0 });
    }
}

const before = document.getElementById('before-chapter');
const next = document.getElementById('next-chapter');

if (before) before.className = "fa-solid fa-angle-left";
if (next) next.className = "fa-solid fa-angle-right";

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

async function inicializarDados() {
    try {
        if (!document.getElementById("video-popup")) {
            const res = await fetch('components/fortnite/popups.bolt');
            document.body.insertAdjacentHTML('afterbegin', await res.text());
        }

        const cloudData = await loadCloudSeasonInfo();
        const localData = await window.electronAPI.json.load(FILE);
        const statsData = await window.electronAPI.json.load(FILE_STATS);
        window.reviews = (localData && typeof localData === 'object') ? localData : {};
        window.stats = (statsData && typeof statsData === 'object') ? statsData : {};

        const data = await window.api.fortnite.getSeasons();
        const keys = Object.keys(data);

        const chaptersCount = keys.map(chave => {
            const match = chave.match(/c(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });

        const chaptersMax = Math.max(...chaptersCount);

        const beforeBtn = document.getElementById('before-chapter');
        const nextBtn = document.getElementById('next-chapter');
        
        if (beforeBtn) {
            beforeBtn.onclick = () => { if (chapterNum - 1 >= 1) mudarCapitulo(chapterNum - 1); };
        }
        if (nextBtn) {
            nextBtn.onclick = () => { if (chapterNum + 1 <= chaptersMax) mudarCapitulo(chapterNum + 1); };
        }

        await mudarCapitulo(chapterNum);
        await renderizarCapitulo(CURRENT_CHAPTER, cloudData);

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

    await getSeasonTemplate();

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
        if (bg) bg.style.backgroundImage = `url('assets://${code}.jpg')`;

        const character = clone.querySelector('.season-character');
        if (character) character.src = `assets://${code}-character.png`;

        const seasonMap = clone.querySelector('.season-map');
        if (seasonMap) seasonMap.src = `assets://${code}-map.jpg`;

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
                        if (rOptions) rOptions.classList.remove('active'); 
                    } else {
                        rContainer.classList.remove('disabled');
                    }
                }

                try {
                    await window.electronAPI.json.save(FILE_STATS, window.stats);
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

        const releaseDateSpan = clone.querySelector('.status i.fa-calendar-day')?.nextElementSibling;
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
            } else if (listaDeEventos && listaDeEventos.length > 1) {
                listEventsMap.textContent = 'Mapa e Eventos';
            } else {
                listEventsMap.textContent = 'Mapa';
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
                    
                    newEvent.querySelector('.event-img').src = evt.img || '';
                    newEvent.querySelector('.event-title').textContent = evt.title || '';
                    newEvent.querySelector('.event-type').textContent = evt.type || '';
                    newEvent.querySelector('.event-date').textContent = evt.date || '';
                    
                    eventsContainer.insertBefore(newEvent, eventsContainer.firstChild);
                    newEvent.onclick = function() {
                        openLiveEvent(
                            this,
                            evt.img.replace('-cover.png', ''),
                            evt.title || 'Evento'
                        )
                    }
                });
            }
        }

        const titleEl = clone.querySelector('.season-title');
        if (titleEl) {
            titleEl.id = `${code}-name`;
            const m = code.match(/^c\d+s(\d+)$/);
            titleEl.textContent = m ? `Temporada ${m[1]} - ${info.name || ""}` : `Temporada ${info.name || ""}`;
        }

        container.appendChild(clone);
    }

    if (localDataUpdated) await window.electronAPI.json.save(FILE, window.reviews);
    if (localStatsUpdated) await window.electronAPI.json.save(FILE_STATS, window.stats);

    preencherValores();
}

function preencherValores() {
    const allCodes = new Set([...Object.keys(window.reviews), ...Object.keys(window.stats)]);

    allCodes.forEach(code => {
        const info = cachedSeasonInfo[code] || {};
        const reviewData = window.reviews[code] || {};
        const statsData = window.stats[code] || {};

        const rating = document.getElementById(`${code}-rating`);
        const levels = document.getElementById(`${code}-levels`);
        const wins = document.getElementById(`${code}-wins`);
        const releaseDate = document.getElementById(`${code}-releaseDate`);

        if (rating) rating.textContent = statsData.rating || "N/A";
        if (levels) levels.textContent = statsData.levels || "0";
        if (wins) wins.textContent = statsData.wins || "0";
        if (releaseDate) releaseDate.textContent = info.releaseDate || "Sem data";
    });

    if (typeof initReviews === "function") {
        initReviews();
    }
}

addEventListener('click', (e) => {
    if (e.target.matches('.season-map')) openMap(e.target);
});

function openMap(el) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;

    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.getElementById("mapPopup-image");

    if (mapPopup && mapImage && code) {
        mapPopup.style.display = "flex";
        
        mapImage.style.backgroundImage = `url('assets://${code}-map.jpg')`;
        
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

function watchEndEvent() {
    const videoPlayer = document.getElementById('endEventVideo-player');
    if (!videoPlayer) return;

    videoPlayer.classList.add('active'); 
    
    const video = videoPlayer.querySelector('#video-event');
    const playBtn = videoPlayer.querySelector('#play-pause-event');
    const wrapper = videoPlayer.querySelector('.video-wrapper');
    const juice = videoPlayer.querySelector('#player-bar-fill-event');

    if (wrapper) {
        wrapper.onmousemove = () => showControls(wrapper);
        wrapper.onmousedown = () => showControls(wrapper);
        wrapper.ontouchstart = () => showControls(wrapper);
        showControls(wrapper);
    }

    if (video) {
        video.volume = 0.5;
        video.ontimeupdate = () => {
            if (!isNaN(video.duration) && video.duration > 0) {
                const perc = (video.currentTime / video.duration) * 100;
                if (juice) juice.style.width = perc + "%";
            }
        };

        video.play().catch(err => console.log("Autoplay bloqueado:", err));
        if (playBtn) playBtn.className = 'fa-solid fa-pause';
    }
}

function minimizeVideo(event) {
    if (event) event.stopPropagation();
    
    const videoPlayer = document.getElementById('endEventVideo-player');
    if (!videoPlayer) return;

    videoPlayer.classList.remove('active'); 
    
    const video = videoPlayer.querySelector('#video-event');
    if (video) {
        video.pause();
    }
}

function initEndEvent() {
    const code = document.getElementById('end-event')?.dataset.code;

    const title = document.getElementById('video-title-event');

    if (title) { title.textContent = document.querySelector('.endEvent-title').textContent }
    
    const video = document.getElementById('video-event');
    const wrapper = document.querySelector('.video-wrapper');
    const cover = document.getElementById('endEvent-cover');
            
    if (wrapper) {
        wrapper.onmousemove = () => showControls(wrapper);
        wrapper.onmousedown = () => showControls(wrapper);
        wrapper.ontouchstart = () => showControls(wrapper);
    }
    if (code) {
        const fileName = `${code}.mp4`
        const videoPath = `assets://${fileName}`;
        const coverPath = `assets://${code}-cover.png`;

        cover.style.backgroundImage = `url(${coverPath})`;
        video.src = videoPath;

        const videoPathLog = videoPath.replace(/.*(?=\/)/,'').replace(/\//,'');
        const coverPathLog = coverPath.replace(/.*(?=\/)/,'').replace(/\//,'');

        console.log('Vídeo do evento de final: ' + videoPathLog +
        '\nCapa do evento de final: ' + coverPathLog);
    }
    if (video) { video.volume = .5 }
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