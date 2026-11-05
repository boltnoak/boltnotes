document.addEventListener('DOMContentLoaded', () => {
    const fortniteHomeBtn = document.getElementById('fortnite');
    const savedUrl = sessionStorage.getItem('fortniteLastUrl') || "";

    if (fortniteHomeBtn && savedUrl) {
        fortniteHomeBtn.href = `pages/fortnite.html?num=${savedUrl}`;
    }
});

document.querySelectorAll('.page[href]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        window.parent.navigateShell(a.href);
    });
});