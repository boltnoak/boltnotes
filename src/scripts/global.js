
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
window.electronAPI.onWindowStateChange((state) => {
  const menuMax = document.getElementById('menuMax');

  if (state === 'maximized') {
    document.body.classList.add('is-maximized');
    menuMax.className = 'fa-regular fa-window-restore';
  } else {
    document.body.classList.remove('is-maximized');
    menuMax.className = 'fa-regular fa-window-maximize';
  }
});
function closeApp() {
  window.electronAPI.menu.closeApp();
}

window.electronAPI.onWindowStateChange((state) => {
    sessionStorage.setItem('windowState', state);
    applyWindowState(state);
});

function applyWindowState(state) {
    document.documentElement.classList.toggle('maximized', state === 'maximized');
}

applyWindowState(sessionStorage.getItem('windowState') || 'normal');

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

    document.getElementById('menuTitle').textContent = document.title;

    await updateMaximizeIcon();
    applyWindowState(sessionStorage.getItem('windowState') || 'normal');

    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
      window.electronAPI.onUpdateReady(() => {
        updateBtn.style.display = 'block';
      });

      const jaTemUpdate = await window.electronAPI.checkUpdateStatus();
      if (jaTemUpdate) updateBtn.style.display = 'block';

      updateBtn.addEventListener('click', () => {
        window.electronAPI.restartAndInstall();
      });
    }
}

initMenu();

window.onload = function () {
    const loadingScreen = document.getElementById('loading-screen');
      
    loadingScreen.classList.add('hidden');

    setTimeout(() => {
        loadingScreen.remove();
    }, 100);
};