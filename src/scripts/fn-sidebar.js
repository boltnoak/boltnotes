document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');

    function isMouseOverHeader(e) {
        const rect = header.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    }

    // Corrige o estado herdado do localStorage assim que souber onde o mouse realmente está
    function syncInitialState(e) {
        const overHeader = isMouseOverHeader(e);
        document.documentElement.classList.toggle('sidebar-expanded', overHeader);
        localStorage.setItem('sidebarExpanded', overHeader ? 'true' : 'false');
        document.removeEventListener('mousemove', syncInitialState);
    }
    document.addEventListener('mousemove', syncInitialState);

    header.addEventListener('mouseenter', () => {
        document.documentElement.classList.add('sidebar-expanded');
        localStorage.setItem('sidebarExpanded', 'true');
    });

    header.addEventListener('mouseleave', () => {
        document.documentElement.classList.remove('sidebar-expanded');
        localStorage.setItem('sidebarExpanded', 'false');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const fortniteBtn = document.querySelector('a.sidebar-btn[href*="fortnite"]');
    const fortniteHomeBtn = document.getElementById('fortnite');
    const savedUrl = sessionStorage.getItem('fortniteLastUrl');

    if (fortniteBtn && savedUrl) {
        fortniteBtn.setAttribute('href', savedUrl);
    }
    if (fortniteHomeBtn && savedUrl) {
        fortniteHomeBtn.setAttribute('href', savedUrl);
    }
});