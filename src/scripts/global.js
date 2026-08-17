const pageBase = document.querySelector('base').href.replace('file://', '');

// Ferramentas de dev
window.addEventListener('keydown', (e) => {
  if (!window.electronAPI || !window.electronAPI.isDev) {
    if (e.code === "F5" || e.code === "F12") {
      e.preventDefault();
    }
    return;
  }

  if (e.code == "F5") {
    const bodyElement = document.querySelector('.pageBody');
    if (bodyElement) {
      sessionStorage.setItem('pageBodyScroll', bodyElement.scrollTop);
    }
    window.location.reload();
  };
  
  if (e.code == "F12") {
    window.electronAPI.devTools();
  };
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!e.target.isContentEditable) return;
    
    e.preventDefault();
    document.execCommand('insertLineBreak');
});

document.addEventListener('paste', (e) => {
    if (!e.target.isContentEditable) return;
    
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
});

// Restaurar o scroll após o reload
// window.addEventListener('load', () => {
//   const savedScroll = sessionStorage.getItem('pageBodyScroll');
  
//   if (savedScroll) {
//     const bodyElement = document.querySelector('.pageBody');
//     const target = parseInt(savedScroll, 10);

//     if (bodyElement) {
//       let attempts = 0;
//       const scrollRetry = setInterval(() => {
//         bodyElement.scrollTop = target;
//         attempts++;

//         if (Math.abs(bodyElement.scrollTop - target) <= 1 || attempts > 20) {
//           clearInterval(scrollRetry);
//           sessionStorage.removeItem('pageBodyScroll');
//         }
//       }, 100);
//     }
//   }
// });

// let lastScrollPercent = 0;

// function getScrollPercent() {
//     const bodyElement = document.querySelector('.pageBody');
//     if (!bodyElement) return 0;
//     const maxScroll = bodyElement.scrollHeight - bodyElement.clientHeight;
//     return maxScroll > 0 ? bodyElement.scrollTop / maxScroll : 0;
// }

// function applyScrollPercent(percent) {
//     const bodyElement = document.querySelector('.pageBody');
//     if (!bodyElement) return;
//     const maxScroll = bodyElement.scrollHeight - bodyElement.clientHeight;
//     bodyElement.scrollTop = percent * maxScroll;
// }

// window.addEventListener('resize', () => {
//     applyScrollPercent(lastScrollPercent);
// });

// document.addEventListener('scroll', (e) => {
//     if (e.target.classList?.contains('pageBody')) {
//         lastScrollPercent = getScrollPercent();
//     }
// }, true);

// Menu
function minimizeApp() {
  window.electronAPI.menu.minimizeApp();
}
function maximizeApp() {
  window.electronAPI.menu.maximizeApp();
}
function closeApp() {
  window.electronAPI.menu.closeApp();
}

window.electronAPI.onWindowStateChange((state) => {
    sessionStorage.setItem('windowState', state);
    applyWindowState(state);
});

function applyWindowState(state) {
  const menuMax = document.getElementById('menuMax');
  const isNormal = state === 'normal';

  document.documentElement.classList.toggle('window-normal', isNormal);
  document.documentElement.classList.toggle('window-maximized', !isNormal);

  if (menuMax) {
    menuMax.className = isNormal
      ? 'fa-regular fa-window-maximize'
      : 'fa-regular fa-window-restore';
  }
}

async function updateMaximizeIcon() {
    const menuMax = document.getElementById('menuMax');

    const isMaximized = await window.electronAPI.menu.isMaximized();

    menuMax.className = isMaximized
        ? 'fa-regular fa-window-restore'
        : 'fa-regular fa-window-maximize';
}

document.addEventListener('DOMContentLoaded', async () => {
  const versao = await window.api.getAppVersion();
  
  const elementoVersao = document.getElementById('app-version');
  if (elementoVersao) {
    elementoVersao.innerText = `v${versao}`;
  }
});

async function initMenu() {
    const res = await fetch('components/menu.bolt');
    const data = await res.text();

    const container = document.querySelector('.app-container');
    (container || document.body).insertAdjacentHTML('afterbegin', data);

    const menuMax = document.getElementById('menuMax');
    const savedState = sessionStorage.getItem('windowState') || 'normal';
    if (menuMax) {
        menuMax.className = savedState === 'maximized'
            ? 'fa-regular fa-window-restore'
            : 'fa-regular fa-window-maximize';
    }

    const menu = document.getElementById('menu');
    let dragging = false;
    let lastX, lastY;

    menu.addEventListener('mousedown', (e) => {
        if (e.target.closest('.menuButtons') || e.target.closest('#update-btn')) return;

        const isMaximized = sessionStorage.getItem('windowState') === 'maximized';
        if (isMaximized) return;
        
        dragging = true;
        lastX = e.screenX;
        lastY = e.screenY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.screenX - lastX;
        const dy = e.screenY - lastY;
        lastX = e.screenX;
        lastY = e.screenY;
        window.electronAPI.menu.dragWindow({ mouseX: dx, mouseY: dy });
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('menuTitle').textContent = document.title;

    await updateMaximizeIcon();
    applyWindowState(sessionStorage.getItem('windowState') || 'normal');

    const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
        console.log('AutoUpdater - Verificando status...');
      
        const jaTemUpdate = await window.electronAPI.checkUpdateStatus();
        console.log('AutoUpdater - Tem update?', jaTemUpdate);
      
        if (jaTemUpdate) updateBtn.style.display = 'block';

        window.electronAPI.onUpdateReady(() => {
            console.log('AutoUpdater - Evento recebido!');
            updateBtn.style.display = 'block';
        });

        updateBtn.addEventListener('click', () => {
            window.electronAPI.restartAndInstall();
        });
    }
    applyLocale();
}
initMenu();

const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

async function checkChangelog() {
    const { shouldShow, version } = await window.electronAPI.changelog.check();
    if (!shouldShow) return;

    const changes = await window.electronAPI.changelog.get();
    
    if (changes && changes.length > 0) {
        const popup = document.getElementById('changelog-popup');
        const list = document.getElementById('changelog-list');
        const title = document.getElementById('changelog-version');
        const closeBtn = document.getElementById('close-changelog-btn');

        title.innerHTML = `<i class="fa-solid fa-rectangle-list"></i>Mudanças da versão ${version}${title.textContent}`;
        list.innerHTML = changes.map(line => {
            if (line.trim().startsWith('#')) {
                const nomeDoTopico = line.replace('#', '').trim();
                return `<div class="changelog-category">
                    <i class="fa-solid fa-circle-dot"></i>
                    <h4 class="changelog-category-text">${nomeDoTopico}:</h4>
                </div>`;
            }
            return `<div class="changelog-topic"><li><i class="fa-solid fa-caret-right"></i>${line}</li></div>`;
        }).join('');
        popup.style.display = 'flex';

        closeBtn.addEventListener('click', async () => {
            popup.style.display = 'none';
            await window.electronAPI.changelog.markSeen(); 
        }, { once: true });
    }
}

window.addEventListener('load', async () => {
    const startingScreen = document.getElementById('starting-screen');
    const loadingDetails = document.getElementById('loading-details');
    const loadingProgress = document.getElementById('loading-progress');
    const progressBarFill = document.getElementById('progress-bar-fill');

    if (isIndexPage) {
        const isReady = await window.electronAPI.checkAssetsStatus();
        
        if (isReady) {
            if (startingScreen) startingScreen.style.display = 'none';

            setTimeout(() => {
                if (startingScreen) startingScreen.remove();
                checkChangelog();
                initFeaturedFortnite();
            }, 400);
        } else {
            if (startingScreen) {
                startingScreen.style.display = 'flex';
                startingScreen.classList.remove('hidden');
            }
        }

        window.electronAPI.onAssetsProgress((() => {
            let lastUpdate = 0;
            return (data) => {
                if (!loadingDetails || !progressBarFill) return;
                
                const now = Date.now();
                if (data.percent !== 100 && (now - lastUpdate < 200)) return;
                lastUpdate = now;

                const mb = (data.downloaded / 1024 / 1024).toFixed(1);
                const totalMb = data.total ? (data.total / 1024 / 1024).toFixed(1) : '?';

                loadingDetails.textContent = `${window._t['downloading']} ${data.package} (${data.percent ?? '...'}%)`;
                loadingProgress.textContent = `${mb} MB / ${totalMb} MB`;

                if (data.percent !== null) {
                    progressBarFill.style.width = `${data.percent}%`;
                }
            };
        })());

        window.electronAPI.onAssetsReady(() => {
            const loadingTitle = document.getElementById('loading-title');
            const shineEffect = document.querySelector('.shine-effect');
            if (loadingTitle) {
                loadingTitle.setAttribute('data-i18n', 'sync-assets-finished');
                loadingDetails.style.display = 'none';
                applyLocale();
            }
            if (loadingDetails) loadingDetails.textContent = "";
            if (loadingProgress) loadingProgress.textContent = "";
            if (progressBarFill) progressBarFill.style.width = "100%";
            if (shineEffect) shineEffect.style.display = 'none';
            
            if (startingScreen) {
                setTimeout(() => {
                    startingScreen.style.opacity = "0";
                    setTimeout(() => {
                        startingScreen.style.display = "none";
                        startingScreen.remove();
                        checkChangelog();
                    }, 500);
                }, 400);
            }
        });

        window.electronAPI.onAssetsError((errorMsg) => {
            if (loadingDetails) {
                loadingDetails.textContent = `${errorMsg}`;
                loadingDetails.style.color = "var(--red)";
            }
            
            const shineEffect = document.querySelector('.shine-effect');
            if (shineEffect) shineEffect.style.display = 'none';
            
            if (progressBarFill) {
                progressBarFill.style.width = '100%';
                progressBarFill.style.backgroundColor = "var(--red)";
            }
            
            if (startingScreen) {
                setTimeout(() => {
                    startingScreen.style.opacity = "0";
                    setTimeout(() => { 
                        startingScreen.style.display = "none"; 
                        startingScreen.remove();
                    }, 500);
                }, 2500);
            }
        });
    } else {
        return;
    }
});

async function viewDownloadPackage(packageName) {
    const name = document.querySelector('.download-status-name');
    name.textContent = packageName;
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

async function formatDate(dataStr, style = 'default') {
    if (!dataStr) return '';

    const [day, month, year] = dataStr.split('/');
    const dataObj = new Date(`${year}-${month}-${day}`);
    if (isNaN(dataObj)) return dataStr;

    const config = await window.electronAPI.config.getConfig();
    let locale = config?.language || 'pt-BR';
    if (locale === 'en') locale = 'en-US';

    if (style === 'ordinal' && locale === 'en-US') {
        const dayNum = parseInt(day, 10);
        const suffix = getOrdinalSuffix(dayNum);
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(dataObj);
        return `${monthName} ${dayNum}${suffix}, ${year}`; // Ex: June 5th, 2026
    }

    switch (style) {
        case 'ordinal': // Ex: 5 de junho de 2026 / June 5th, 2026
            if (locale === 'en-US') {
                const dayNum = parseInt(day, 10);
                const suffix = getOrdinalSuffix(dayNum);
                const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(dataObj);
                return `${monthName} ${dayNum}${suffix}, ${year}`;
            }
            return new Intl.DateTimeFormat(locale, { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            }).format(dataObj);

        case 'short-month': // Ex: 5 de jun. de 2026 / Jun 5, 2026
            return new Intl.DateTimeFormat(locale, { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            }).format(dataObj);

        case 'wide': // Ex: 5 de junho de 2026 / June 5, 2026
            return new Intl.DateTimeFormat(locale, { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            }).format(dataObj);

        case 'month-year': // Ex: jun. de 2026" / "Jun 2026
            return new Intl.DateTimeFormat(locale, { 
                month: 'short', 
                year: 'numeric' 
            }).format(dataObj);

        case 'default': // Ex: 05/06/2026
            return new Intl.DateTimeFormat(locale, { 
                day: 'numeric', 
                month: 'numeric', 
                year: 'numeric' 
            }).format(dataObj);
        default:
            return dataStr;
    }
}