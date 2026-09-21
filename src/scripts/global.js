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
function minimizeApp() { window.electronAPI.menu.minimizeApp() }
function maximizeApp() { window.electronAPI.menu.maximizeApp() }
function closeApp() { window.electronAPI.menu.closeApp() }

async function updateCheckInit() {
    const updateBtn = window.parent ? window.parent.document.getElementById('update-btn') : null;
    if (updateBtn) {
        const isUpdate = await window.electronAPI.updates.checkUpdateStatus();

        if (isUpdate) {
            updateBtn.style.display = 'flex';
            console.log('Atualização encontrada!');
        }
        window.electronAPI.updates.onUpdateReady(() => {
            console.log('Atualização pronta.');
            updateBtn.style.display = 'flex';
        });
        updateBtn.addEventListener('click', () => {
            window.electronAPI.updates.restartAndInstall();
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

const THEMES_URL = 'documents://Themes';

async function getTheme(themeName) {
  const name = String(themeName ?? '').replace(/[\\/]/g, '').trim();
  if (!name) return null;

  try {
    const res = await fetch(`${THEMES_URL}/${encodeURIComponent(name)}.boltss`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
async function listThemes() {
  let names;
  try {
    const res = await fetch(`${THEMES_URL}/.ThemeList`);
    if (!res.ok) return [];
    names = (await res.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }

  return Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`${THEMES_URL}/${encodeURIComponent(name)}.boltss`);
        if (!res.ok) throw new Error();
        const css = await res.text();
        const bg = css.match(/--bg\s*:\s*([^;}\n]+)/)?.[1].trim() ?? '#050505';
        return { name, bg };
      } catch {
        return { name, bg: '#000000' };
      }
    })
  );
}