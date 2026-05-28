const FILE = "Fortnite/reviews.json";

const fileName = window.location.pathname
    .split('/')
    .pop()
    .replace('.html', '');

const match = fileName.match(/(og)?chapter(\d+)(og)?/i);


    const matcha = window.location.pathname.match(/chapter(\d+)\.html/);
        const CURRENT_CHAPTER = `c${matcha[1]}`;
window.addEventListener('DOMContentLoaded', async () => {
    const match = window.location.pathname.match(/chapter(\d+)\.html/);

    if (match) {
        const currentChapter = parseInt(match[1], 10);
        const chapterBefore = currentChapter - 1;
        const chapterNext = currentChapter + 1;

        const before = document.getElementById('before-chapter');
        const next = document.getElementById('next-chapter');
        const chapterNameEl = document.getElementById('chapter-name');

        const isOG = window.location.pathname.includes('og'); 

        const titleText = `${isOG ? 'OG ' : ''}Capítulo ${currentChapter}`;
        document.title = `BoltNotes - Fortnite ${titleText}`;
        if (chapterNameEl) chapterNameEl.textContent = titleText;
        
        if (before) {
            before.onclick = () => window.location.href = `pages/fortnite/chapter${chapterBefore}.html`;
        }
        if (next) {
            next.onclick = () => window.location.href = `pages/fortnite/chapter${chapterNext}.html`;
        }

        if (before) {
            if (chapterBefore <= 0) {
                before.style.visibility = "hidden";
            } else {
                const hasBefore = await window.electronAPI.exists(`pages/fortnite/chapter${chapterBefore}.html`);
                before.style.visibility = hasBefore ? "visible" : "hidden";
            }
        }

        if (next) {
            const hasNext = await window.electronAPI.exists(`pages/fortnite/chapter${chapterNext}.html`);
            next.style.visibility = hasNext ? "visible" : "hidden";
        }
    }
});

const before = document.getElementById('before-chapter');
const next = document.getElementById('next-chapter');

before.className = "fa-solid fa-angle-left";
next.className = "fa-solid fa-angle-right";

let cachedSeasonInfo = null;

// ==========================================
// 1. CARREGAMENTO DE DADOS
// ==========================================
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

// ==========================================
// 2. INICIALIZAÇÃO PRINCIPAL (O MAESTRO)
// ==========================================
async function inicializarDados() {
    try {
        // A. Carrega Popups
        if (!document.getElementById("video-popup")) {
            const res = await fetch('components/fortnite/popups.bolt');
            document.body.insertAdjacentHTML('afterbegin', await res.text());
        }

        // B. Carrega os Dados (Nuvem e Local)
        const cloudData = await loadCloudSeasonInfo();
        const localData = await window.electronAPI.json.load(FILE); 
        reviews = (localData && typeof localData === 'object') ? localData : {};

        // C. Renderiza os cards na tela e preenche
        await renderizarCapitulo(CURRENT_CHAPTER, cloudData);

        // D. Inicia eventos de vídeos
        if (typeof initVideoEvents === "function") initVideoEvents();

    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

// ==========================================
// 3. RENDERIZAÇÃO DINÂMICA (O CLONADOR)
// ==========================================
async function renderizarCapitulo(prefixoCapitulo, cloudData) {
    const container = document.getElementById('seasons-list-container');
    const template = document.getElementById('season-template');
    let localDataUpdated = false;

    if (!container || !template) return;
    container.innerHTML = ''; // Limpa antes de injetar

    const keys = Object.keys(cloudData).filter(code => code.startsWith(prefixoCapitulo)).reverse();

    keys.forEach(code => {
        const info = cloudData[code];
        const local = reviews[code] || null;

        // Se a temporada não existe no PC, cria o slot vazio
        if (!local) {
            reviews[code] = { loot: "", mapa: "", passe: "", story: "", levels: "", wins: "", rating: "" };
            localDataUpdated = true;
        }

        // Clona o Template
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.fn-season');
        card.dataset.code = code;

        // Imagens de Background, Personagem e Mapa
        const bg = clone.querySelector('.banner');
        if (bg) bg.style.backgroundImage = `url('assets/fortnite/seasons/${code}.jpg')`;

        const character = clone.querySelector('.season-character');
        if (character) character.src = `assets/fortnite/seasons/${code}.png`;

        const seasonMap = clone.querySelector('.season-map');
        if (seasonMap) seasonMap.src = `assets/fortnite/maps/${code}.jpg`;

        // Bloqueio de Edição
        const seasonDiv = clone.querySelector('.season');
        const isLocked = info.locked ?? true;
        if (seasonDiv) seasonDiv.dataset.locked = isLocked;

        // Adiciona IDs Dinâmicos aos Spans de Status
        const statusSpans = clone.querySelectorAll('.status span');
        statusSpans.forEach(span => {
            const parentText = span.parentElement.textContent;
            if (parentText.includes('Nota')) span.id = `${code}-rating`;
            if (parentText.includes('Níveis')) span.id = `${code}-levels`;
            if (parentText.includes('Vitórias')) span.id = `${code}-wins`;
            if (parentText.includes('Lançado em')) {
                span.id = `${code}-releaseDate`;
                span.contentEditable = "false"; // Data não se edita
            } else {
                span.contentEditable = !isLocked;
                // Salvamento automático protegido (Debounce)
                if (!isLocked) {
                    span.oninput = () => debouncedSave(code);
                    span.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
                }
            }
        });

        // Configuração do Trailer
        const trailerBtn = clone.querySelector('.season-trailers');
        if (trailerBtn) trailerBtn.onclick = () => openTrailer(trailerBtn);

        // Renderiza Eventos (se houver)
        if (info.event) {
            const eBlock = clone.querySelector('.season-events');
            if (eBlock) {
                eBlock.style.display = 'flex';
                const evtImg = clone.querySelector('.event-img');
                if (evtImg && info.event.img) evtImg.src = info.event.img;
                clone.querySelector('.event-title').textContent = info.event.title || '';
                clone.querySelector('.event-type').textContent = info.event.type || '';
                clone.querySelector('.event-date').textContent = info.event.date || '';
            }
        }

        // Título e Data Básica
        const titleEl = clone.querySelector('.season-title');
        if (titleEl) {
            titleEl.id = `${code}-name`;
            const m = code.match(/^c\d+s(\d+)$/);
            titleEl.textContent = m ? `Temporada ${m[1]} - ${info.name || ""}` : `Temporada ${info.name || ""}`;
        }

        // Insere na tela
        container.appendChild(clone);
    });

    // Salva o JSON no PC se novos blocos vazios foram criados
    if (localDataUpdated) await window.electronAPI.json.save(FILE, reviews);

    // Agora que está na tela, preenche com as notas salvas!
    preencherValores();
}

// ==========================================
// 4. PREENCHIMENTO DOS DADOS LOCAIS
// ==========================================
function preencherValores() {
    Object.keys(reviews).forEach(code => {
        const data = reviews[code];
        const info = cachedSeasonInfo[code] || {};

        const rating = document.getElementById(`${code}-rating`);
        const levels = document.getElementById(`${code}-levels`);
        const wins = document.getElementById(`${code}-wins`);
        const releaseDate = document.getElementById(`${code}-releaseDate`);

        if (rating) rating.textContent = data.rating || "0";
        if (levels) levels.textContent = data.levels || "0";
        if (wins) wins.textContent = data.wins || "0";
        if (releaseDate) releaseDate.textContent = info.releaseDate || "Sem data";
        
        initReviews()
    });
}

// ==========================================
// 5. EVENTOS GLOBAIS (MAPA) E PROTEÇÃO DE SAVE
// ==========================================
addEventListener('click', (e) => {
    // Note a mudança aqui para buscar a classe!
    if (e.target.matches('.season-map')) openMap(e.target);
});

function openMap(el) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;

    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.getElementById("mapPopup-image");

    if (mapPopup && mapImage && code) {
        mapPopup.style.display = "flex";
        mapImage.style.backgroundImage = `url('assets/fortnite/maps/${code}.jpg')`;
    }
}
function closeMap(el) {
    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.getElementById("mapPopup-image");

    if (mapPopup && mapImage) {
        mapImage.classList.remove("open");
        mapImage.classList.add("close");

        mapPopup.addEventListener("animationend", function handler() {
            mapPopup.style.display = "none";
            mapPopup.classList.remove("close");
            mapPopup.removeEventListener("animationend", handler);
            mapImage.classList.remove("close");
            mapImage.removeEventListener("animationend", handler);
        });
    }
}

// Proteção para não destruir o disco rígido do usuário ao digitar


// Inicia o app
document.querySelector('.back').href = `pages/fortnite.html`;

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
        const videoPath = `assets/fortnite/live-events/${fileName}`;
        const coverPath = `assets/fortnite/live-events/${code}-cover.png`;

        cover.style.backgroundImage = `url(${coverPath})`;
        video.src = videoPath;

        console.log(`Fortnite - Evento de final (Vídeo): ${videoPath.replace(/.*(?=\/)/,'').replace(/\//,'')}\nFortnite - Evento de final (Capa): ${
            coverPath.replace(/.*(?=\/)/,'').replace(/\//,'')
        }`);
    }
    if (video) { video.volume = .5 }
}

initEndEvent();