let cachedTrailers = null;
let cachedReviews = null;

const activeDownloads = new Set();

function sanitizeFileName(fileName) {
  return fileName.replace(/[\\/]/g, '').replace(/\.\./g, '');
}
function sanitizeFolderCode(folderCode) {
  return folderCode.replace(/[^a-z0-9-]/gi, '');
}

async function getLocalVideoUrl(folderCode, fileName) {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const assetsRoot = await opfsRoot.getDirectoryHandle('assets');
    const folder = await assetsRoot.getDirectoryHandle(`fortnite-${folderCode}-assets`);
    const fileHandle = await folder.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file); // ex: blob:https://seusite.com/xxxx
  } catch {
    return null; // arquivo não existe localmente ainda
  }
}

async function getAssetsRoot() {
  const opfsRoot = await navigator.storage.getDirectory();
  return opfsRoot.getDirectoryHandle('assets', { create: true });
}

async function downloadOnDemand(url, fileName, folderCode, onProgress) {
  const safeFileName = sanitizeFileName(fileName);
  const safeFolderCode = sanitizeFolderCode(folderCode);

  if (!url || !safeFileName || !safeFolderCode) {
    return { success: false, error: 'Parâmetros inválidos' };
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Protocolo não autorizado. Use HTTPS.' };
    }
  } catch {
    return { success: false, error: 'URL malformada' };
  }

  const assetsRoot = await getAssetsRoot();
  const folderName = `fortnite-${safeFolderCode}-assets`;
  const targetFolder = await assetsRoot.getDirectoryHandle(folderName, { create: true });
  const cacheKey = `${folderName}/${safeFileName}`;

  try {
    await targetFolder.getFileHandle(safeFileName);
    return { success: true, path: cacheKey, cached: true };
  } catch { /* não existe ainda */ }

  if (activeDownloads.has(cacheKey)) {
    return { success: false, error: 'Download já está em andamento' };
  }
  activeDownloads.add(cacheKey);

  const tempName = safeFileName + '.tmp';

  try {
    const response = await fetch(url); // exige CORS liberado no servidor de origem
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const total = Number(response.headers.get('content-length')) || 0;
    let downloaded = 0;

    const tempHandle = await targetFolder.getFileHandle(tempName, { create: true });
    const writable = await tempHandle.createWritable();
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      downloaded += value.byteLength;
      onProgress?.({
        fileName: safeFileName,
        percent: total ? Math.round((downloaded * 100) / total) : 0,
      });
    }
    await writable.close();

    if (typeof tempHandle.move === 'function') {
      await tempHandle.move(safeFileName); // rename atômico, Chrome recente
    } else {
      const finalHandle = await targetFolder.getFileHandle(safeFileName, { create: true });
      const finalWritable = await finalHandle.createWritable();
      await finalWritable.write(await (await tempHandle.getFile()).arrayBuffer());
      await finalWritable.close();
      await targetFolder.removeEntry(tempName);
    }

    activeDownloads.delete(cacheKey);
    return { success: true, path: cacheKey };
  } catch (error) {
    try { await targetFolder.removeEntry(tempName); } catch {}
    activeDownloads.delete(cacheKey);
    return { success: false, error: error.message };
  }
}

async function loadLocalReviews() {
    if (cachedReviews) {
        console.log("Reviews carregados do cache!");
        return cachedReviews;
    }
    try {
        const content = await window.electronAPI.json.load(`Fortnite/reviews.json`);
        cachedReviews = content || {};
        return cachedReviews;
    } catch (e) {
        console.error("Erro ao ler meus_reviews.json:", e);
        return {};
    }
}


function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "00:00";
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) {
        return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
}

async function loadCloudTrailers() {
    if (cachedTrailers) return cachedTrailers;

    const config = await window.electronAPI.config.getConfig();
    const language = config.language || "pt-BR";

    const url = `https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-trailers-${language}.json`;

    const content = await fetchWithCache(url, `fn-trailers-${language}`);
    cachedTrailers = content || {};
    return cachedTrailers;
}

let isOpening = false;

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

async function openTrailer(el) {
    if (isOpening) return;
    isOpening = true;

    try {
        changeVideo('');
        await openVideoPlayer(el);

        const trailers = await loadCloudTrailers();
        const reviews = await loadLocalReviews();

        const container = el.closest('.fn-season');
        const code = container?.dataset.code;

        removeCreatedEspecialDivs();

        const isListContainerDiv = document.querySelector('.moreVideos-section');
        if (!isListContainerDiv) {
            const listContainerDiv = document.createElement("div");
            listContainerDiv.className = "moreVideos-section";
            const listContainer = document.createElement("div");
            listContainer.className = "more-videos";
            listContainer.id = "more-videos";
            listContainerDiv.appendChild(listContainer);
            document.getElementById('video-player').appendChild(listContainerDiv);
        }
        const listContainer = document.getElementById('more-videos');

        if (!code || !listContainer) return;

        listContainer.innerHTML = "";

        const seasonData = cachedReviews[code] || {};
        const seasonDataInfo = cachedSeasons[code] || {};
        const pageName = document.getElementById(`${code}-name`)?.textContent;
        const seasonName = seasonDataInfo.name || pageName || code;

        const tipos = ["game", "cine", "game2", "cine2", "game3", "cine3", "game4", "cine4", "extra"];
        let firstVideoToPlay = null;
        let firstVideoTitle = null;

        const config = await window.electronAPI.config.getConfig();
        const language = config.language;

        for (const tipo of tipos) {
            const info = cachedTrailers?.[code]?.[tipo];

            if (!info) continue;

            const labelText = info?.title || `Trailer ${tipo}`;
            const labelDate = await formatDate(info?.date || 'Sem data');

            const extension = info?.ext || 'webm';
            const fileName = `${code}_${tipo}_${language}.${extension}`;
            // Antes: const assetUri = `assets://fortnite-${code}-assets/${fileName}`;
            // Agora usamos um marcador lógico (folder+nome); a URL real (blob:) só é
            // resolvida na hora de tocar, via getLocalVideoUrl().
            const assetUri = { folderCode: code, fileName };

            const btn = document.createElement("div");
            btn.className = "video-item-btn";
            btn.innerHTML = `
                <span>${labelText}</span>
                <span class="moreVideo-date">${labelDate}</span>
            `;

            const wrapper = document.querySelector('.video-wrapper');

            btn.onclick = async () => {
                togglePlay();
                window.showControls(wrapper);
                document.querySelectorAll('.video-item-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const formattedSeason = code.toUpperCase().replace(/S/g, 'T').replace(/^(?!.*C.*T\d+).*$/, '');
                document.getElementById('video-title').textContent = `${formattedSeason} ${seasonName.replace(/.*(- =?)/, '')} — ${labelText}`;

                const extensoes = ['webm', 'mkv', 'mp4'];
                let localUriEncontrado = null;

                for (const ext of extensoes) {
                    const testFileName = `${code}_${tipo}_${language}.${ext}`;
                    // Antes: const exists = await window.electronAPI.existsAssets(testUri);
                    const localUrl = await getLocalVideoUrl(code, testFileName);
                    if (localUrl) {
                        localUriEncontrado = localUrl;
                        break;
                    }
                }

                if (localUriEncontrado) {
                    changeVideo(localUriEncontrado);
                } else {
                    btn.style.setProperty('--download-progress', '0%');

                    btn.innerHTML = `
                        <div class="progress-fill"></div>
                        <i class="download-icon fa-solid fa-circle-down"></i>
                        <div class="text-base">
                            <span data-i18n="downloading">Baixando</span>... <span class="percent-text">0%</span>
                        </div>
                    `;
                    applyLocale();
                    btn.classList.add('downloading');

                    const extensoesParaTentar = ['mkv', 'mp4', 'webm'];

                    // Antes: window.electronAPI.video.onProgress(...) + removeProgressListener()
                    // Agora o progresso vem direto como callback, sem precisar de listener global.
                    const onProgress = ({ fileName: eventFileName, percent }) => {
                        btn.style.setProperty('--download-progress', `${percent}%`);

                        const textBase = btn.querySelector('.text-base');
                        const textOverlay = btn.querySelector('.text-overlay');

                        const updateProgressContent = (container) => {
                            if (!container) return;

                            let percentEl = container.querySelector('.percent-text');

                            if (!percentEl) {
                                container.innerHTML = `<span data-i18n="downloading">Baixando</span>... <span class="percent-text">${percent}%</span>`;
                                applyLocale();
                            } else {
                                percentEl.textContent = `${percent}%`;
                            }
                        };

                        updateProgressContent(textBase);
                        updateProgressContent(textOverlay);
                    };

                    try {
                        let result;
                        let assetUriFinal;

                        for (const ext of extensoesParaTentar) {
                            const currentFileName = `${code}_${tipo}_${language}.${ext}`;

                            const cloudUrl = `https://github.com/boltnoak/boltnotes-assets/releases/download/assets/${currentFileName}`;

                            // Antes: window.electronAPI.video.downloadOnDemand({ url, fileName, folderCode })
                            result = await downloadOnDemand(cloudUrl, currentFileName, code, onProgress);

                            if (result.success) {
                                assetUriFinal = await getLocalVideoUrl(code, currentFileName);
                                btn.classList.remove('downloading');
                                break;
                            }
                        }

                        if (result.success) {
                            btn.innerHTML = `<span>${labelText}</span><span class="moreVideo-date">${labelDate}</span>`;
                            btn.classList.remove('downloading');
                            changeVideo(assetUriFinal);
                        } else {
                            alert('Erro ao baixar trailer: ' + result.error);
                            btn.innerHTML = `<span>${labelText}</span><span class="moreVideo-date">Falhou</span>`;
                        }
                    } catch (err) {
                        console.error('Erro no download:', err);
                    }
                }
            };

            listContainer.appendChild(btn);

            if (!firstVideoToPlay) {
                // Antes usava a string assetUri direto; agora resolvemos on-demand no click.
                firstVideoToPlay = { uri: assetUri, btn: btn, title: labelText };
            }
        }

        if (listContainer.childElementCount <= 1) {
            const info = cachedTrailers?.[code]?.game;

            const firstBtn = document.querySelector('.video-item-btn');
            if (firstBtn) firstBtn.style.display = "none";

            const labelDate = info?.date || `Sem data`;
            const justDate = document.createElement("div");

            justDate.className = "video-date";
            justDate.innerHTML = `<span class="moreVideo-date">${labelDate}</span>`;
            listContainer.classList.add('noMore');

            listContainer.appendChild(justDate);
        } else {
            listContainer.classList.remove('noMore');
        }

        if (firstVideoToPlay) {
            firstVideoToPlay.btn.click();

            const formattedSeason = code.toUpperCase().replace(/S/g, 'T').replace(/^(?!.*C.*T\d+).*$/, '');
            document.getElementById('video-title').textContent = `${formattedSeason} ${seasonName.replace(/.*(- =?)/, '')} — ${firstVideoToPlay.title}`;

            const popupVideo = document.getElementById('video');
            const popupJuice = document.getElementById('player-bar-fill');
            const popupPlayBtn = document.getElementById('play-pause');
            const timeDisplay = document.getElementById('video-time-display');

            if (popupVideo) {
                const updateTimeText = () => {
                    if (timeDisplay) {
                        const current = formatTime(popupVideo.currentTime);
                        const duration = formatTime(popupVideo.duration);
                        timeDisplay.textContent = `${current}/${duration}`;
                    }
                };
                popupVideo.ontimeupdate = () => {
                    updateTimeText();

                    if (!isNaN(popupVideo.duration) && popupVideo.duration > 0) {
                        const perc = (popupVideo.currentTime / popupVideo.duration) * 100;
                        if (popupJuice) popupJuice.style.width = perc + "%";
                    }
                };
                popupVideo.onloadedmetadata = updateTimeText;
                updateTimeText();

                if (popupPlayBtn) popupPlayBtn.className = 'fa-solid fa-pause';
            }
        }
        document.querySelector('.moreVideos-section').style.display = 'flex';
    } finally {
        isOpening = false;
    }
}

const EVENT_KEYS = {
    'c7s2': 'event_c7s2',
    'c7s2-ice-king': 'event_c7s2-ice-king',
    'c7s2-foundation': 'event_c7s2-foundation'
};

let isTeamSelectVisible = false;
async function openLiveEvent(el, fileCode, eventTitle, author, authorId) {
    const container = el.closest('.fn-season');
    const code = container?.dataset.code;

    const title = document.getElementById('video-title');
    if (title) title.textContent = eventTitle;
    const video = document.getElementById('video');

    if (author != null) {
        const authorDiv = document.createElement('div');
        authorDiv.className = 'author-div';

        const authorText = document.createElement('div');
        authorText.className = 'author';

        authorText.innerHTML = `<span data-i18n="by">By</span> 
        <a onclick="openLinkOnBrowser('https://www.youtube.com/@${authorId}')">${author}</a>`;
        authorDiv.appendChild(authorText);
        
        const wrapper = document.querySelector('#video');
        wrapper.appendChild(authorDiv);
        applyLocale();
    }

    const controls = document.getElementById('player-controls');
    const videoTitle = document.getElementById('video-title');
    const closeBtn = document.querySelector('#video-close');

    // Antes: const basePath = `assets://fortnite-${code}-assets/${fileCode}`;
    // Agora guardamos folderCode + nome-base separadamente, e resolvemos a URL
    // (blob:) só na hora de realmente tocar o vídeo.
    const folderCode = code;
    const baseFileName = fileCode;

    let ext = null;
    const webmUrl = await getLocalVideoUrl(folderCode, `${baseFileName}.webm`);
    if (webmUrl) {
        ext = 'webm';
    } else {
        const mp4Url = await getLocalVideoUrl(folderCode, `${baseFileName}.mp4`);
        if (mp4Url) {
            ext = 'mp4';
        }
    }

    let forceDownloadExtras = false;
    if (ext && code === 'c7s2') {
        const hasFoundationUrl = await getLocalVideoUrl(folderCode, `${baseFileName}-foundation.${ext}`);
        const hasIceKingUrl = await getLocalVideoUrl(folderCode, `${baseFileName}-ice-king.${ext}`);
        if (!hasFoundationUrl || !hasIceKingUrl) forceDownloadExtras = true;
    }

    let downloadPopup, nameEl, percentageEl, progressBarFill;

    if (!ext || forceDownloadExtras) {
        downloadPopup = document.querySelector('.download-status-div');
        nameEl = document.querySelector('.download-status-name');
        percentageEl = document.querySelector('.download-status-percentage');
        progressBarFill = document.querySelector('.download-status-progress-bar-fill');

        if (downloadPopup) {
            if (nameEl) nameEl.textContent = eventTitle;
            if (nameEl && code === 'c7s2') nameEl.textContent = `${window._t['event_c7s2']}`;
            if (percentageEl) percentageEl.textContent = '0%';
            if (progressBarFill) progressBarFill.style.width = '0%';
            downloadPopup.classList.add('show');
            document.querySelector('.season-trailers').classList.add('disabled');
            document.querySelector('.season-events').classList.add('disabled');
        }

        const onProgress = ({ percent }) => {
            if (percentageEl) percentageEl.textContent = `${percent}%`;
            if (progressBarFill) progressBarFill.style.width = `${percent}%`;
        };

        try {
            let downloadSucesso = false;

            if (!ext) {
                const extensoesParaTentar = ['mkv', 'mp4', 'webm'];
                for (const testExt of extensoesParaTentar) {
                    const fileName = `${fileCode}.${testExt}`;
                    const cloudUrl = `https://github.com/boltnoak/boltnotes-assets/releases/download/assets/${fileName}`;

                    const result = await downloadOnDemand(cloudUrl, fileName, code, onProgress);

                    if (result.success) {
                        ext = testExt;
                        downloadSucesso = true;
                        videoTimeDisplay();
                        break;
                    }
                }
            } else {
                downloadSucesso = true;
            }

            if (!downloadSucesso) {
                alert('Erro: O evento ao vivo não foi encontrado no servidor em nenhum formato.');
                closeVideo();
                return;
            }

            if (code === 'c7s2') {
                const teams = ['foundation', 'ice-king'];
                
                for (const team of teams) {
                    const extraName = `${fileCode}-${team}.${ext}`;
                    const hasExtraLocalUrl = await getLocalVideoUrl(folderCode, extraName);
                    
                    if (!hasExtraLocalUrl) {
                        if (nameEl) nameEl.textContent = `${window._t[`event_c7s2-${team || ""}`]}`;
                        
                        const extraCloudUrl = `https://github.com/boltnoak/boltnotes-assets/releases/download/assets/${extraName}`;
                        await downloadOnDemand(extraCloudUrl, extraName, code, onProgress);
                    }
                    videoTimeDisplay();
                }
            }

        } catch (err) {
            console.error('Erro ao baixar evento:', err);
            closeVideo();
            return;
        } finally {
            if (downloadPopup) downloadPopup.classList.remove('show');
            document.querySelector('.season-trailers').classList.remove('disabled');
            document.querySelector('.season-events').classList.remove('disabled');
            document.getElementById('before-chapter').classList.remove('disabled');
            document.getElementById('next-chapter').classList.remove('disabled');
        }
    }

    const path = await getLocalVideoUrl(folderCode, `${baseFileName}.${ext}`);

    removeCreatedEspecialDivs();
    await openVideoPlayer(el);
    changeVideo(path);

    videoTimeDisplay();

    video.addEventListener('timeupdate', () => {
        const isIntro = video.src.includes('live-event-c7s2.webm') || video.src.includes('live-event-c7s2.mp4');
        if (isIntro) {
            const key = EVENT_KEYS[code];
            const titleName = window._t?.[key] || code;
            title.textContent = titleName || key;
            const chooseDiv = document.createElement('div');
            chooseDiv.id = 'team-select-overlay';
            chooseDiv.innerHTML = `
                <div class="team-options">
                    <div class="team-option" onclick="chooseTeam('ice-king')">
                        <img src="assets://fortnite-c7s2-assets/team-ice-king.png">
                        <p class="team-option-text" data-i18n="ice-king"></p>
                    </div>
                    <div class="team-option" onclick="chooseTeam('foundation')">
                        <img src="assets://fortnite-c7s2-assets/team-foundation.png">
                        <p class="team-option-text" data-i18n="foundation"></p>
                    </div>
                </div>`;
            applyLocale();
            document.querySelector('.video-wrapper').appendChild(chooseDiv)
        }

        const teamSelect = document.getElementById('team-select-overlay');
        if (!teamSelect) return;

        const mustShow = isIntro && video.currentTime >= 274.5;

        if (mustShow && !isTeamSelectVisible) {
            teamSelect.classList.add('active');
            isTeamSelectVisible = true;
        } else if (!mustShow && isTeamSelectVisible) {
            teamSelect.classList.remove('active');
            isTeamSelectVisible = false;
        }
    });
}

async function chooseTeam(team) {
    const overlay = document.getElementById('team-select-overlay');
    if (overlay) {
        overlay.classList.remove('active'); 
    }
    isTeamSelectVisible = false;

    const code = 'c7s2';
    const key = `${code}-${team}`;
    const titleKey = `${EVENT_KEYS[code]}-${team}`;
    const titleName = window._t?.[titleKey] || code;

    // Antes:
    // const ext = await window.electronAPI.existsAssets(`assets://fortnite-${code}-assets/live-event-${key}.webm`) ? 'webm' : 'mp4';
    // const path = `assets://fortnite-${code}-assets/live-event-${key}.${ext}`;
    const webmUrl = await window.videoDownloadManager.getLocalVideoUrl(code, `live-event-${key}.webm`);
    const ext = webmUrl ? 'webm' : 'mp4';
    const path = webmUrl || await window.videoDownloadManager.getLocalVideoUrl(code, `live-event-${key}.${ext}`);

    const title = document.getElementById('video-title');
    title.textContent = titleName || key;

    changeVideo(path);
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

    const teamSelect = document.getElementById('team-select-overlay');
    if (teamSelect) {
        teamSelect.classList.remove('active');
    }
    isTeamSelectVisible = false;
}

function openLinkOnBrowser(link) {
    window.api.openLink(link)
}

function removeCreatedEspecialDivs() {
    const moreVideos = document.querySelector('.moreVideos-section');
    const chooseTeam = document.getElementById('team-select-overlay');
    const author = document.querySelector('.author-div');

    if (moreVideos) moreVideos.remove();
    if (chooseTeam) chooseTeam.remove();
    if (author) author.remove();
}