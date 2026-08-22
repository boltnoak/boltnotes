const basePagePathLog = document.querySelector('base').href
    .replace(/.*(?=BoltNotes\/)/, 'Documentos/')
    .replace('file://', '')

console.log(`Local: ${basePagePathLog}`);

document.addEventListener('DOMContentLoaded', async () => {
  const version = await window.api.getAppVersion();
  const versionEl = document.getElementById('app-version');

  if (versionEl) {
    versionEl.innerText = `v${version}`;
  }
});