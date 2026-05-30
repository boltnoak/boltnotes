const video = document.getElementById('video');
const title = document.getElementById('seasonTrailer-title');

let controlsTimeout = null;
let mouseInsideVideo = false;

function showControls(wrapper) {
    if (!wrapper) return;

    const video = document.getElementById('video');
    const controls = wrapper.querySelector('[id^="player-controls"]');
    const title = wrapper.querySelector('[id^="video-title"]');
    const close = wrapper.querySelector('[id^="video-close"]');
    const hover = wrapper.querySelector('[id^="controls-hover"]');

    if (!controls || !title || !close) return;

    controls.style.opacity = 1;
    controls.style.pointerEvents = 'auto';
    title.style.opacity = 1;
    close.style.opacity = 1;
    
    if (hover) {
        hover.style.background = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 10%, transparent 90%, rgba(0, 0, 0, 0.7) 100%)';
    }
    video.style.cursor = "default";

    clearTimeout(controlsTimeout);

    controlsTimeout = setTimeout(() => {
        hideControls(wrapper);
    }, 1500);

    wrapper.addEventListener('mouseleave', () => {
        hideControls(wrapper);
    })
}

function hideControls(wrapper) {
    const video = document.getElementById('video') || document.querySelector('#endEventVideo-player #video');
    const controls = wrapper.querySelector('[id^="player-controls"]');
    const title = wrapper.querySelector('[id^="video-title"]');
    const close = wrapper.querySelector('[id^="video-close"]');
    const hover = wrapper.querySelector('[id^="controls-hover"]');

    controls.style.opacity = 0;
    title.style.opacity = 0;
    close.style.opacity = 0;
    controls.style.pointerEvents = 'none';
    if (hover) hover.style.background = 'transparent';
    video.style.cursor = "none";
}
function toggleFullscreen(event, element) {
    if (event) event.stopPropagation();

    const container = element 
        ? (element.closest('.video-popup') || element.closest('#endEventVideo-player'))
        : document.querySelector('.video-popup');
    
    if (!container) return;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.log("Erro ao entrar em tela cheia:", err);
        });
    } else {
        document.exitFullscreen();
    }
}
document.addEventListener("fullscreenchange", () => {
    const popup = document.querySelector('.video-popup');
    const btn = popup.querySelector('[id^="toggle-fullscreen"]');

    if (!popup.classList.contains('full')) {
        popup.classList.add("full");
        
        if (btn) btn.className = 'fa-solid fa-down-left-and-up-right-to-center';
    } else {
        popup.classList.remove("full");
            
        if (btn) btn.className = 'fa-solid fa-up-right-and-down-left-from-center';
    }
});
function togglePlay(e, element) {
    if (e) e.stopPropagation();

    const wrapper = element ? element.closest('.video-wrapper') : document.querySelector('.video-wrapper');
    if (!wrapper) return;

    const video = wrapper.querySelector('video');
    const playBtn = wrapper.querySelector('[id^="play-pause"]');

    if (!video) return;

    if (video.paused) {
        video.play().catch(err => console.log("Erro ao reproduzir:", err));
        playBtn.className = 'fa-solid fa-pause';
    } else {
        video.pause();
        playBtn.className = 'fa-solid fa-play';
    }
}
document.addEventListener('ended', (e) => {
    const videoFinalizado = e.target;
    
    const wrapper = videoFinalizado.closest('.video-wrapper') || videoFinalizado.closest('#endEventVideo-player');
    if (!wrapper) return;

    const playBtn = wrapper.querySelector('[id^="play-pause"]') || wrapper.querySelector('#play-pause-envent');
    if (playBtn) {
        playBtn.className = 'fa-solid fa-play';
    }
}, true);
window.seek = function(e, barElement) {
    if (e) e.stopPropagation();

    const bar = barElement || e.currentTarget;
    if (!bar) return;

    const wrapper = bar.closest('.video-wrapper') || document;

    const video = wrapper.querySelector('video');
    if (!video || !video.duration) return;

    const juice = wrapper.querySelector('#player-bar-fill, #player-bar-fill-event');
    const rect = bar.getBoundingClientRect();

    const clickX = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const pos = Math.max(0, Math.min(1, clickX / rect.width));

    video.currentTime = pos * video.duration;

    if (juice) {
        juice.style.width = (pos * 100) + "%";
    }
};

const playerContainer = document.getElementById('endEventVideo-player');
if (typeof window.initVideoEvents === 'function') {
    window.initVideoEvents(playerContainer);
}
function muteVideo(e) {
    if (e) e.stopPropagation();
    
    const mute = document.getElementById('mute');
    const vol = document.getElementById('volume');

    const video = document.querySelector('#endEventVideo-player #video') || document.getElementById('video');
    if (!video) return;
    
    video.muted = !video.muted;
    vol.textContent = video.muted ? '0%' : Math.round(video.volume * 100) + '%';
    
    if (video.muted || video.volume === 0) {
        mute.className = "fa-solid fa-volume-xmark";
    } else if (video.volume >= 0.05) {
        mute.className = "fa-solid fa-volume-low";
    } else if (video.volume >= 0.5) {
        mute.className = "fa-solid fa-volume";
    } else {
        mute.className = "fa-solid fa-volume-high";
    }

    vol.style.opacity = 1;

    setTimeout(() => {
        vol.style.opacity = 0;
    }, 1200);
}

function allowVolumeControl() {
    const videoElement = document.getElementById('video');
    const mute = document.getElementById('mute');
    const vol = document.getElementById('volume');

    if (!videoElement) return;

    const mudanca = 0.05;

    videoElement.addEventListener('wheel', (e) => {
        e.preventDefault();

        let novoVolume =
            videoElement.volume + (e.deltaY < 0 ? mudanca : -mudanca);

        // clamp único
        novoVolume = Math.min(1, Math.max(0, novoVolume));

        videoElement.volume = novoVolume;

        // log único
        console.log(`${Math.round(novoVolume * 100)}%`);

        // UI texto
        if (vol) {
            vol.textContent = `${Math.round(novoVolume * 100)}%`;
            vol.style.opacity = 1;

            clearTimeout(vol.__t);
            vol.__t = setTimeout(() => {
                vol.style.opacity = 0;
            }, 800);
        }

        // mute state
        videoElement.muted = novoVolume === 0 ? true : false;

        // icon
        if (mute) {
            if (videoElement.muted || novoVolume === 0) {
                mute.className = "fa-solid fa-volume-xmark";
            } else if (novoVolume >= 0.7) {
                mute.className = "fa-solid fa-volume-high";
            } else if (novoVolume >= 0.5) {
                mute.className = "fa-solid fa-volume";
            } else {
                mute.className = "fa-solid fa-volume-low";
            }
        }
    }, { passive: false });
}