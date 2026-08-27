/////////////////
/// DEV TOOLS ///
/////////////////
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
  }
  if (e.code == "F12") {
    window.electronAPI.devTools();
  }
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

/////////////////////////////////////
/// BARRA DE TÍTULO/BOTÕES DO APP ///
/////////////////////////////////////
function minimizeApp() {
  window.electronAPI.menu.minimizeApp();
}
function maximizeApp() {
  window.electronAPI.menu.maximizeApp();
}
function closeApp() {
  window.electronAPI.menu.closeApp();
}
async function updateCheckInit() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        const isUpdate = await window.electronAPI.checkUpdateStatus();

        if (isUpdate) {
            updateBtn.style.display = 'flex';
            console.log('Atualização encontrada!');
        }
        window.electronAPI.onUpdateReady(() => {
            console.log('Atualização pronta.');
            updateBtn.style.display = 'flex';
        });
        updateBtn.addEventListener('click', () => {
            window.electronAPI.restartAndInstall();
        });
    }
    applyLocale();
}
updateCheckInit();

requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        document.documentElement.classList.add('sidebar-color-ready');
    });
});

////////////////////////
/// ESTADO DA JANELA ///
////////////////////////
// window.electronAPI.onWindowStateChange((state) => {
//     sessionStorage.setItem('windowState', state);
//     applyWindowState(state);
// });
// function applyWindowState(state) {
//   const menuMax = document.getElementById('menuMax');
//   const isNormal = state === 'normal';

//   document.documentElement.classList.toggle('window-normal', isNormal);
//   document.documentElement.classList.toggle('window-maximized', !isNormal);

//   if (menuMax) {
//     menuMax.className = isNormal
//       ? 'fa-regular fa-window-maximize'
//       : 'fa-regular fa-window-restore';
//   }
// }
async function updateMaximizeIcon() {
    const menuMax = document.getElementById('menuMax');
    const isMaximized = await window.electronAPI.menu.isMaximized();
    menuMax.className = isMaximized
        ? 'fa-regular fa-window-restore'
        : 'fa-regular fa-window-maximize';
}

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
                const topicName = line.replace('#', '').trim();
                return `<div class="changelog-category">
                    <i class="fa-solid fa-circle-dot"></i>
                    <h4 class="changelog-category-text">${topicName}:</h4>
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

checkChangelog();

// async function openChangelog() {
//     const { shouldShow, version } = await window.electronAPI.changelog.check();

//     const changes = await window.electronAPI.changelog.get();
    
//     if (changes && changes.length > 0) {
//         const popup = document.getElementById('changelog-popup');
//         const list = document.getElementById('changelog-list');
//         const title = document.getElementById('changelog-version');
//         const closeBtn = document.getElementById('close-changelog-btn');

//         if (title && !title.length > 0) title.innerHTML = `<i class="fa-solid fa-rectangle-list"></i>Mudanças da versão ${version}${title.textContent}`;
//         if (list && !list.length > 0) list.innerHTML = changes.map(line => {
//             if (line.trim().startsWith('#')) {
//                 const topicName = line.replace('#', '').trim();
//                 return `<div class="changelog-category">
//                     <i class="fa-solid fa-circle-dot"></i>
//                     <h4 class="changelog-category-text">${topicName}:</h4>
//                 </div>`;
//             }
//             return `<div class="changelog-topic"><li><i class="fa-solid fa-caret-right"></i>${line}</li></div>`;
//         }).join('');
//         popup.style.display = 'flex';

//         closeBtn.addEventListener('click', async () => {
//             popup.style.display = 'none';
//             await window.electronAPI.changelog.markSeen(); 
//         }, { once: true });
//     }
// }

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
    const dataObj = new Date(Number(year), Number(month) - 1, Number(day));
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

async function fetchWithRetry(url, options = {}, retries = 2, delay = 1000) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        } catch (error) {
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function updateCacheInBackground(url, cacheKey) {
    const response = await fetchWithRetry(url, {}, 2, 1000);
    const data = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
}

async function fetchWithCache(url, cacheKeyName) {
    const cacheKey = `cache:${cacheKeyName}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        try {
            const parsedCache = JSON.parse(cached);

            // Atualiza em segundo plano, sem bloquear o retorno
            updateCacheInBackground(url, cacheKey).catch(() => {});

            return parsedCache;
        } catch (error) {
            console.warn(`Cache corrompido ou quebrado, buscando novo: ${cacheKeyName}`);
        }
    }

    try {
        const response = await fetchWithRetry(url, {}, 2, 1000);
        const data = await response.json();

        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    } catch (error) {
        console.warn(`Falha ao buscar online e sem cache disponível: ${cacheKeyName}`);
        return null;
    }
}