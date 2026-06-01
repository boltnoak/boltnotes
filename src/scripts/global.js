
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

    document.body.insertAdjacentHTML('afterbegin', data);

    document.getElementById('menuTitle').textContent = document.title;

    await updateMaximizeIcon();
}

initMenu();

function setupUpdateListeners() {
    const modal = document.getElementById('update-modal');
    const text = document.getElementById('update-text');
    const bar = document.getElementById('update-bar');
    const btnRestart = document.getElementById('btn-restart');
    const progressWrapper = document.getElementById('progress-wrapper');

    window.electronAPI.onUpdateStatus((msg) => {
        modal.style.display = 'block';
        text.innerText = msg;
    });

    window.electronAPI.onUpdateProgress((percent) => {
        bar.style.width = percent + '%';
    });

    window.electronAPI.onUpdateDownloaded(() => {
        text.innerText = "Atualização baixada!";
        progressWrapper.style.display = 'none';
        btnRestart.style.display = 'block';
    });
}

function restartApp() {
    window.electronAPI.send('update:restart');
}