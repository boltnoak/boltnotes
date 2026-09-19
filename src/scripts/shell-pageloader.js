document.addEventListener('DOMContentLoaded', () => {
  const fortniteHomeBtn = document.getElementById('fortnite');
  const savedUrl = window.parent.getFortniteLastUrl?.();

  if (fortniteHomeBtn && savedUrl) {
    fortniteHomeBtn.setAttribute('href', savedUrl);
  }
});

document.querySelectorAll('.page[href]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const page = a.getAttribute('href');
    window.parent.navigateShell(page);
  });
});