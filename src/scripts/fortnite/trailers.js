let cachedTrailers = null;
let cachedReviews = null;

async function loadLocalReviews() {
    if (cachedReviews) {
        console.log("Reviews carregados do cache!");
        return cachedReviews;
    }
    try {
        const content = await window.electronAPI.json.load(`documents://Fortnite/reviews.json`);
        cachedReviews = content || {};
        return cachedReviews;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}

async function loadCloudTrailers() {
    if (cachedTrailers) {
        console.log("Trailers carregados do cache!");
        return cachedTrailers;
    }
    try {
        const content = await window.api.fortnite.getTrailers(); 
        cachedTrailers = content || {};
        return cachedTrailers;
    } catch (e) {
        console.error("Erro ao buscar trailers da internet:", e);
        return {};
    }
}

let isOpening = false;

async function openTrailer(el) {
    if (isOpening) return;
    isOpening = true;

    try {
        const trailers = await loadCloudTrailers();
        const reviews = await loadLocalReviews();

        const container = el.closest('.fn-season');
        const code = container?.dataset.code;
        const listContainer = document.getElementById("more-videos");

        if (!code || !listContainer) return;

        listContainer.innerHTML = ""; 

        const seasonData = cachedReviews[code] || {};
        const pageName = document.getElementById(`${code}-name`)?.textContent;
        const seasonName = seasonData.name || pageName || code;

        const popup = document.getElementById("video-popup");
        const wrapper = popup?.querySelector('.video-wrapper');

        if (popup) popup.style.display = "flex";
        document.querySelector('html').style.overflow = "hidden";

        const tipos = ["game", "cine", "game2", "cine2", "game3", "cine3", "game4", "cine4", "extra"];
        let firstVideo = null;
        let firstTipo = null;

        if (wrapper) {
            const triggerControls = () => window.showControls(wrapper);

            wrapper.onmousemove = () => window.showControls(wrapper);
            wrapper.onmousedown = () => window.showControls(wrapper);
            wrapper.ontouchstart = () => window.showControls(wrapper);
            wrapper.addEventListener('wheel', triggerControls, { passive: true });
        }

        allowVolumeControl();

        const video = document.getElementById('video');
        if (video) video.volume = .5;

        for (const tipo of tipos) {
            const fileName = `${code}_${tipo}.mkv`;
            const exists = await window.electronAPI.exists(`assets://${fileName}`);

            if (exists) {
                const path = `assets://${fileName}`;
                if (!firstVideo) {
                    firstVideo = path;
                    firstTipo = tipo;
                }

                const info = cachedTrailers?.[code]?.[tipo];
                const labelText = info?.title || `Trailer ${tipo}`;
                const labelDate = info?.date || `Sem data`;

                const btn = document.createElement("div");
                btn.className = "video-item-btn";
                btn.innerHTML = `
                    <span>${labelText}</span>
                    <span class="moreVideo-date">${labelDate}</span>
                `;

                btn.onclick = () => {
                    document.querySelectorAll('.video-item-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const info = cachedTrailers?.[code]?.[tipo];
                    const trailerName = info?.title || `Trailers`;
                    const seasonCode = code

                    document.getElementById('video-title').textContent = `${seasonCode
                    .toUpperCase()
                    .replace(/S/g, 'T')
                    .replace(/^(?!.*C.*T\d+).*$/,'')} 
                    ${seasonName.replace(/.*(- =?)/,'')} - ${trailerName}`;

                    changeVideo(path);
                };
                listContainer.appendChild(btn);
            }
        }

        if (listContainer.childElementCount <= 1) {
            const info = cachedTrailers?.[code].game;

            document.querySelector('.video-item-btn').style.display = "none";

            const labelDate = info?.date || `Sem data`;
            const justDate = document.createElement("div");

            justDate.className = "video-date";
            justDate.innerHTML = `<span class="moreVideo-date">Data do trailer: ${labelDate}</span>`;
            listContainer.classList.add('noMore');

            listContainer.appendChild(justDate);
        } else {
            listContainer.classList.remove('noMore');
        }

        if (firstVideo) {
            changeVideo(firstVideo);

            const info = cachedTrailers?.[code]?.[firstTipo];
            const trailerName = info?.title || `Trailers`;
            const seasonCode = code

            document.getElementById('video-title').textContent = `${seasonCode
            .toUpperCase()
            .replace(/S/g, 'T')
            .replace(/^(?!.*C.*T\d+).*$/,'')} 
            ${seasonName.replace(/.*(- =?)/,'')} - ${trailerName}`;

            listContainer.querySelector('.video-item-btn')?.classList.add('active');

            const popupVideo = document.getElementById('video');
            const popupJuice = document.getElementById('player-bar-fill');
            const popupPlayBtn = document.getElementById('play-pause');

            if (popupVideo) {
                popupVideo.ontimeupdate = () => {
                    if (!isNaN(popupVideo.duration) && popupVideo.duration > 0) {
                        const perc = (popupVideo.currentTime / popupVideo.duration) * 100;
                        if (popupJuice) popupJuice.style.width = perc + "%";
                    }
                };
                
                if (popupPlayBtn) popupPlayBtn.className = 'fa-solid fa-pause';
            }
        }

        document.querySelector('.moreVideos-section').style.display = 'flex';
        
        if (wrapper) window.showControls(wrapper);

    } finally {
        isOpening = false;
    }
}

async function openLiveEvent(el) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;
    const listContainer = document.getElementById("more-videos");
    
    if (!code || !listContainer) return;

    const eventName = document.querySelector('.event-title');
    const title = document.getElementById('video-title');
    title.textContent = eventName.textContent || "Evento sem nome";

    listContainer.innerHTML = "";
    const controls = document.getElementById('player-controls');
    const videoTitle = document.getElementById('video-title');
    const closeBtn = document.querySelector('#video-close');

    document.getElementById("video-popup").style.display = "flex";
    document.querySelector('html').style.overflow = "hidden";

        const fileName = `${code}.mp4`;
        const exists = await window.electronAPI.exists(`assets://live-event-${fileName}`);

        if (exists) {
            const path = `assets://live-event-${fileName}`;
            const video = document.getElementById('video');
            const wrapper = document.querySelector('.video-wrapper');
            
            if (wrapper) {
                const triggerControls = () => window.showControls(wrapper);

                wrapper.onmousemove = () => window.showControls(wrapper);
                wrapper.onmousedown = () => window.showControls(wrapper);
                wrapper.ontouchstart = () => window.showControls(wrapper);
                wrapper.addEventListener('wheel', triggerControls, { passive: true });
            }

            allowVolumeControl();

            changeVideo(path);

            video.volume = .5;
            console.log('Volume inicial do video: ' + Math.round(video.volume * 100) + "%")

            const playPromise = video.play();
                if (playPromise !== undefined) {
                playPromise.catch(error => {
                console.warn("Reprodução automática impedida pelo navegador. Clique no Play.");
                });
            }
            
            const popupVideo = document.getElementById('video');
            const popupJuice = document.getElementById('player-bar-fill');
            const popupPlayBtn = document.getElementById('play-pause');

            if (popupVideo) {
                popupVideo.ontimeupdate = () => {
                    if (!isNaN(popupVideo.duration) && popupVideo.duration > 0) {
                        const perc = (popupVideo.currentTime / popupVideo.duration) * 100;
                        if (popupJuice) popupJuice.style.width = perc + "%";
                    }
                };
                
                if (popupPlayBtn) popupPlayBtn.className = 'fa-solid fa-pause';
            }
        }
        const moreVideos = document.querySelector('.moreVideos-section')
        moreVideos.style.display = 'none'
}

async function changeVideo(src) {
    const video = document.getElementById("video");
    const juice = document.getElementById('player-bar-fill');
    const playPause = document.getElementById('play-pause');

    if (!video) return;
    if (juice) {
        juice.style.transition = 'none';
        juice.style.width = '0%';
        juice.offsetHeight;
        juice.style.transition = '';
    }

    playPause.className = 'fa-solid fa-pause';

    video.pause();
    video.src = src;
    video.load();

    video.onloadeddata = async () => {
    const trailerVideo = document.getElementById("video-player");

    trailerVideo.classList.add("open");
    };
    try {
        await video.play();
    } catch {
        console.warn("Autoplay bloqueado");
    }
}

function closeVideo() {
    const popup = document.getElementById("video-popup");
    const video = document.getElementById("video");
    const moreVideos = document.querySelector(".moreVideos-section");
    const player = document.getElementById("video-player");

    player.classList.remove("open");
    player.classList.add("close");
    popup.classList.remove("open");
    popup.classList.add("close");

    video.pause();
    const playBtn = document.querySelector('[id^="play-pause"]');
    playBtn.className = 'fa-solid fa-pause'

    document.querySelector('html').style.overflow = "hidden";

    if (moreVideos) {
        moreVideos.style.display = "flex"; 
    }

    player.addEventListener("animationend", function handler() {
        popup.style.display = "none";
        popup.classList.remove("close");
        popup.removeEventListener("animationend", handler);
        player.classList.remove("close");
        player.removeEventListener("animationend", handler);
    });
}