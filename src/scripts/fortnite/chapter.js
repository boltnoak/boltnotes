const FILE = "Fortnite/reviews.json";

const fileName = window.location.pathname
    .split('/')
    .pop()
    .replace('.html', '');

const match = fileName.match(/chapter(\d+)/i);

async function loadHeader() {
    document.body.insertAdjacentHTML('afterbegin', `
        <header>
            <a class="back">Voltar</a>
            <div class="chapter-section">
                <i id="before-chapter"></i>
                <p id="chapter-name"></p>
                <i id="next-chapter"></i>
            </div>
            <!--<a class="chapters"></a>-->
        </header>`);
    
    // const chapterBtn = document.querySelector('.chapters');
    // const chaptersa = document.getElementById('chapters-popup');

    // if (chapterBtn && chaptersa) {
    //     chapterBtn.addEventListener('click', () => {
    //         if (chaptersa.style.display === 'none' || chaptersa.style.display === '') {
    //             chaptersa.style.display = 'flex';
    //         } else {
    //             chaptersa.style.display = 'none';
    //         }
    //     });
    // }
}
loadHeader();

const backIcon = document.createElement('i');
backIcon.className = 'fa-solid fa-caret-left';

if (document.querySelector('.back')) document.querySelector('.back').appendChild(backIcon);

const chaptersIcon = document.createElement('i');
chaptersIcon.className = 'fa-solid fa-book';

if (document.querySelector('.chapters')) document.querySelector('.chapters').appendChild(chaptersIcon);

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

    const titleText = `Capítulo ${currentChapter}`;
    document.title = `BoltNotes — Fortnite ${titleText}`;
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

if (before) before.className = "fa-solid fa-angle-left";
if (next) next.className = "fa-solid fa-angle-right";

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
let seasonTemplateHTML = null;

async function getSeasonTemplate() {
    // Se o template já foi injetado no DOM, não faz nada
    if (document.getElementById('season-template')) return;

    try {
        const res = await fetch('../components/fortnite/seasons-template.bolt');
        const data = await res.text();
        document.body.insertAdjacentHTML('afterbegin', data);
    } catch (err) {
        console.error("Erro ao carregar/injetar o template:", err);
    }
}

async function renderizarCapitulo(prefixoCapitulo, cloudData) {
    const container = document.getElementById('seasons-list-container');
    let localDataUpdated = false;

    if (!container) return;  
    container.innerHTML = '';

    // 1. Garante que o template foi injetado no HTML
    await getSeasonTemplate();

    // 2. Pega o template diretamente do DOM da página
    const template = document.getElementById('season-template');
    if (!template) {
        console.error("Erro: O template #season-template não foi encontrado no DOM.");
        return;
    }

    const keys = Object.keys(cloudData).filter(code => code.startsWith(prefixoCapitulo)).reverse();

    for (const code of keys) {
        const info = cloudData[code];
        const local = reviews[code] || null;

        // Se a temporada não existe no PC, cria o slot vazio
        if (!local) {
            reviews[code] = { loot: "", mapa: "", passe: "", story: "", levels: "", wins: "", rating: "" };
            localDataUpdated = true;
        }

        // 3. Clona o conteúdo interno do template (gera um DocumentFragment)
        const clone = template.content.cloneNode(true);
        
        // Aplica o data-code na div principal (.fn-season) de dentro do clone
        const card = clone.querySelector('.fn-season');
        if (card) card.dataset.code = code;

        // Imagens de Background, Personagem e Mapa
        const bg = clone.querySelector('.banner');
        if (bg) bg.style.backgroundImage = `url('assets://${code}.jpg')`;

        const character = clone.querySelector('.season-character');
        if (character) character.src = `assets://${code}-character.png`;

        const seasonMap = clone.querySelector('.season-map');
        if (seasonMap) seasonMap.src = `assets://${code}-map.jpg`;

        // Bloqueio de Edição
        const seasonDiv = clone.querySelector('.season');
        const isLocked = local.locked ?? true;
        if (seasonDiv) seasonDiv.dataset.locked = isLocked;

        // Ícone/botão de bloqueio de edição
        const lockIcon = clone.getElementById('lock-unlock');

        if (lockIcon) {
            lockIcon.className = local.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
            
            lockIcon.onclick = (e) => {
                e.stopPropagation();

                local.locked = !local.locked;
                
                lockIcon.className = local.locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
                
                const parentSeason = lockIcon.closest('.season') || lockIcon.closest('.fn-season').querySelector('.season');
                if (parentSeason) parentSeason.dataset.locked = local.locked;

                const currentCard = lockIcon.closest('.fn-season');
                if (currentCard) {
                    const displayStyle = local.locked ? 'none' : 'inline-block';
                    currentCard.querySelectorAll('.statusLevel-add, .statusLevel-minus, .statusWin-add, .statusWin-minus')
                        .forEach(btn => btn.style.display = displayStyle);

                    currentCard.querySelectorAll('.review-topictext')
                        .forEach(p => p.contentEditable = !local.locked);
                }

                if (typeof debouncedSave === "function") debouncedSave(code);
            };
        }

        // ==========================================
        // CONTROLE DE NOTAS (INVERTIDO: 10 -> 0)
        // ==========================================
        const ratingSpan = clone.querySelector('.status-rating');
        const ratingContainer = clone.querySelector('.rating-container');
        const ratingOptionsContainer = clone.querySelector('.rating-options');

        if (!isLocked && ratingOptionsContainer) {
            // Pega as opções do HTML e ordena do maior (10) para o menor (0)
            const ratingOptions = Array.from(ratingOptionsContainer.querySelectorAll('.rating-option'));
            ratingOptions.sort((a, b) => parseFloat(b.getAttribute('data-value')) - parseFloat(a.getAttribute('data-value')));

            // Limpa e reinjeta na ordem decrescente
            ratingOptionsContainer.innerHTML = '';
            ratingOptions.forEach(option => {
                ratingOptionsContainer.appendChild(option);

                // Evento de clique em cada nota
                option.addEventListener('click', (e) => {
                    e.stopPropagation(); // Evita fechar e reabrir ao mesmo tempo
                    const selectedRating = e.target.getAttribute('data-value');
                    
                    local.rating = selectedRating;
                    if (ratingSpan) ratingSpan.textContent = selectedRating;
                    if (typeof debouncedSave === "function") debouncedSave(code);
                    
                    // Esconde o menu após selecionar
                    ratingOptionsContainer.classList.remove('active');
                });
            });
        }

        if (!isLocked && ratingContainer && ratingOptionsContainer) {
            ratingContainer.addEventListener('click', (e) => {
                ratingOptionsContainer.classList.toggle('active');
            });
        }

        // ==========================================
        // CONTROLE DE NÍVEIS E VITÓRIAS (BOTÕES)
        // ==========================================
        const levelAdd = clone.querySelector('.statusLevel-add');
        const levelMinus = clone.querySelector('.statusLevel-minus');
        const winAdd = clone.querySelector('.statusWin-add');
        const winMinus = clone.querySelector('.statusWin-minus');

        const levelsSpan = clone.querySelector('.status-level');
        const winsSpan = clone.querySelector('.status-win');

        function updateStat(statKey, increment, displaySpan) {
            let currentValue = parseInt(local[statKey]) || 0;
            if (currentValue + increment >= 0) {
                currentValue += increment;
                local[statKey] = currentValue.toString(); 
                if (displaySpan) displaySpan.textContent = local[statKey];
                if (typeof debouncedSave === "function") debouncedSave(code);
            }
        }

        if (levelAdd) levelAdd.onclick = () => updateStat('levels', 1, levelsSpan);
        if (levelMinus) levelMinus.onclick = () => updateStat('levels', -1, levelsSpan);
        if (winAdd) winAdd.onclick = () => updateStat('wins', 1, winsSpan);
        if (winMinus) winMinus.onclick = () => updateStat('wins', -1, winsSpan);

        // Atualiza os IDs dinâmicos para a função preencherValores() continuar funcionando
        if (ratingSpan) ratingSpan.id = `${code}-rating`;
        if (levelsSpan) levelsSpan.id = `${code}-levels`;
        if (winsSpan) winsSpan.id = `${code}-wins`;

        const releaseDateSpan = clone.querySelector('.status i.fa-calendar-day')?.nextElementSibling;
        if (releaseDateSpan) releaseDateSpan.id = `${code}-releaseDate`;

        // Exibe os botões se a temporada não estiver bloqueada
        if (!isLocked) {
            if (levelAdd) levelAdd.style.display = 'inline-block';
            if (levelMinus) levelMinus.style.display = 'inline-block';
            if (winAdd) winAdd.style.display = 'inline-block';
            if (winMinus) winMinus.style.display = 'inline-block';
        }

        // Configuração do Trailer
        const trailerBtn = clone.querySelector('.season-trailers');
        if (trailerBtn) trailerBtn.onclick = () => typeof openTrailer === "function" && openTrailer(trailerBtn);

        // Renderiza Eventos (se houver)
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
                // Remove o esqueleto original do fragmento para não duplicar, 
                // mas mantém a referência na memória para clonar
                templateEvent.remove(); 

                listaDeEventos.forEach(evt => {
                    const newEvent = templateEvent.cloneNode(true);
                    newEvent.style.display = 'flex';
                    
                    newEvent.querySelector('.event-img').src = evt.img || '';
                    newEvent.querySelector('.event-title').textContent = evt.title || '';
                    newEvent.querySelector('.event-type').textContent = evt.type || '';
                    newEvent.querySelector('.event-date').textContent = evt.date || '';
                    
                    eventsContainer.insertBefore(newEvent, eventsContainer.firstChild);
                });
            }
        }

        // Título e Data Básica
        const titleEl = clone.querySelector('.season-title');
        if (titleEl) {
            titleEl.id = `${code}-name`;
            const m = code.match(/^c\d+s(\d+)$/);
            titleEl.textContent = m ? `Temporada ${m[1]} - ${info.name || ""}` : `Temporada ${info.name || ""}`;
        }

        // Insere o fragmento clonado e modificado na tela
        container.appendChild(clone);
    }

    // Salva o JSON no PC se novos blocos vazios foram criados
    if (localDataUpdated) await window.electronAPI.json.save(FILE, reviews);

    // Preenche com as notas salvas
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
    if (e.target.matches('.season-map')) openMap(e.target);
});

function openMap(el) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;

    const mapPopup = document.getElementById("map-popup");
    const mapImage = document.getElementById("mapPopup-image");

    if (mapPopup && mapImage && code) {
        mapPopup.style.display = "flex";
        
        // CORREÇÃO: Adicionado o :// de volta em ambas as URLs
        mapImage.style.backgroundImage = `url('assets://${code}-viewmap.jpg'), url('assets://${code}-map.jpg')`;
        
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
// ==========================================
// CONTROLE DE ZOOM E ARRASTO DO MAPA
// ==========================================
let scale = 1;
let isDragging = false;
let startX, startY;
let translateX = 0, translateY = 0;
let isZoomInitialized = false;

function configurarZoomMapa() {
    if (isZoomInitialized) return;

    const mapImageEl = document.getElementById("mapPopup-image");
    const container = document.querySelector(".mapPopup-content"); // O container que limita a borda
    
    if (!mapImageEl || !container) return;

    // 1. ZOOM FOCO NO MOUSE
    mapImageEl.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        const zoomSpeed = 0.15;
        const oldScale = scale;

        // Calcula a nova escala
        if (e.deltaY < 0) {
            scale += zoomSpeed;
        } else {
            scale -= zoomSpeed;
        }
        scale = Math.min(Math.max(1, scale), 5); // Limite de 1x a 5x

        // Pega a posição do mouse relativa ao container
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // FÓRMULA MÁGICA: Ajusta a posição (X, Y) para o zoom ir na direção do mouse
        translateX = mouseX - (mouseX - translateX) * (scale / oldScale);
        translateY = mouseY - (mouseY - translateY) * (scale / oldScale);

        // Aplica as bordas logo após o zoom
        aplicarRestricoesBorda(container);
        atualizarTransform();
    }, { passive: false });

    // 2. INICIAR ARRASTO
    mapImageEl.addEventListener("mousedown", (e) => {
        if (scale === 1) return; // Só arrasta se tiver zoom
        isDragging = true;
        
        // ADICIONE ESTA LINHA: Liga o modo arrasto puro
        mapImageEl.classList.add("dragging"); 
        
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    // 3. MOVIMENTAR E BATER NAS BORDAS
    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        translateX = e.clientX - startX;
        translateY = e.clientY - startY;

        aplicarRestricoesBorda(container);
        atualizarTransform();
    });

    // 4. SOLTAR O CLIQUE
    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            
            // ADICIONE ESTA LINHA: Devolve a animação para o scroll do zoom ficar suave de novo
            mapImageEl.classList.remove("dragging"); 
        }
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    isZoomInitialized = true;
}

// FUNÇÃO COMPLEMENTAR: Não deixa o mapa sair das bordas do container
function aplicarRestricoesBorda(container) {
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Largura e altura reais do elemento com o zoom aplicado
    const larguraZoom = cw * scale;
    const alturaZoom = ch * scale;

    // Limites horizontais (X)
    const minX = cw - larguraZoom; // O máximo que pode ir para a esquerda
    const maxX = 0;               // O máximo que pode ir para a direita

    // Limites verticais (Y)
    const minY = ch - alturaZoom; // O máximo que pode ir para cima
    const maxY = 0;               // O máximo que pode ir para baixo

    // Força as variáveis a ficarem dentro dos limites calculados
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

// Proteção para não destruir o disco rígido do usuário ao digitar


// Inicia o app
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

        console.log(`Fortnite - Evento de final (Vídeo): ${videoPath.replace(/.*(?=\/)/,'').replace(/\//,'')}\nFortnite - Evento de final (Capa): ${
            coverPath.replace(/.*(?=\/)/,'').replace(/\//,'')
        }`);
    }
    if (video) { video.volume = .5 }
}

initEndEvent();