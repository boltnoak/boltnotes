
const pageBase = document.querySelector('base').href.replace('file://', '');

// Recarregar página e ferramentas de dev
window.addEventListener('keydown', (e) => {
  if (e.code == "F5") {
  const bodyElement = document.querySelector('.pageBody');
    if (bodyElement) {
      // Salva o scroll da DIV .pageBody
      sessionStorage.setItem('pageBodyScroll', bodyElement.scrollTop);
    }
  window.location.reload()};
  
  if (e.code == "F12") {
  window.electronAPI.devTools()};
});

// Restaurar o scroll após o reload
window.addEventListener('load', () => {
  const savedScroll = sessionStorage.getItem('pageBodyScroll');
  
  if (savedScroll) {
    const bodyElement = document.querySelector('.pageBody');
    const target = parseInt(savedScroll, 10);

    if (bodyElement) {
      let attempts = 0;
      const scrollRetry = setInterval(() => {
        bodyElement.scrollTop = target;
        attempts++;

        if (Math.abs(bodyElement.scrollTop - target) <= 1 || attempts > 20) {
          clearInterval(scrollRetry);
          sessionStorage.removeItem('pageBodyScroll');
        }
      }, 100);
    }
  }
});

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
}

initMenu();

// Detecta se a página atual é a página de entrada (index.html)
const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

window.addEventListener('load', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const startingScreen = document.getElementById('starting-screen');
    const loadingDetails = document.getElementById('loading-details');
    const progressBarFill = document.getElementById('progress-bar-fill');

    if (isIndexPage) {
        const isReady = await window.electronAPI.checkAssetsStatus();
        
        if (isReady) {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            if (startingScreen) startingScreen.style.display = 'none';

            setTimeout(() => {
                if (loadingScreen) loadingScreen.remove();
                if (startingScreen) startingScreen.remove();
            }, 400);
        } else {
            if (startingScreen) {
                startingScreen.style.display = 'flex';
                startingScreen.classList.remove('hidden');
            }
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => loadingScreen.remove(), 400);
            }
        }

        window.electronAPI.onAssetsProgress((() => {
            let lastUpdate = 0;
            return (data) => {
                if (!loadingDetails || !progressBarFill) return;
                
                const now = Date.now();
                if (now - lastUpdate < 200) return;
                lastUpdate = now;

                const mb = (data.downloaded / 1024 / 1024).toFixed(1);
                const totalMb = data.total ? (data.total / 1024 / 1024).toFixed(1) : '?';

                loadingDetails.textContent = `Baixando ${data.package} (${data.percent ?? '...'}%) — ${mb} MB / ${totalMb} MB`;

                if (data.percent !== null) {
                    progressBarFill.style.width = `${data.percent}%`;
                }
            };
        })());

        window.electronAPI.onAssetsReady(() => {
            const loadingTitle = document.getElementById('loading-title');
            if (loadingTitle) loadingTitle.textContent = "Tudo pronto!";
            if (loadingDetails) loadingDetails.textContent = "";
            if (progressBarFill) progressBarFill.style.width = "100%";
            
            if (startingScreen) {
                setTimeout(() => {
                    startingScreen.style.opacity = "0";
                    setTimeout(() => {
                        startingScreen.style.display = "none";
                        startingScreen.remove();
                    }, 500);
                }, 500);
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
                }, 3000);
            }
        });
    } 
    else {
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.remove();
            }, 400);
        }
    }
});