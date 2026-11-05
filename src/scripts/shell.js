let cachedFortniteChapters = '';

function bindSidebarEvents() {
    document.querySelectorAll('header .sidebar-btn[data-nav]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            navigateShell(btn.dataset.nav);
        }
    });
}
bindSidebarEvents()

function navigateShell(page) {
    const filename = page.split('/').pop().split('.')[0].split('?')[0];

    document.getElementById('content').src = page;
    
    document.querySelectorAll('.sidebar-btn[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === filename);
    });
}

const menuMax = document.getElementById('menuMax');
function updateMaxIcon(isMax) {
    menuMax.classList.toggle('maximized', isMax);
    menuMax.setAttribute('aria-label', isMax ? 'Restaurar' : 'Maximizar');
}
updateMaxIcon(window.windowControls.isMaximized());
window.windowControls.onMaximizedChange(updateMaxIcon);