//////////////////
/// CONSTANTES ///
//////////////////
const content = document.getElementById("content");
const tablist = document.getElementById("tabs");
const titleBar = document.querySelector('.title-bar');
const noteTitleElement = document.getElementById('title-note');
const editBtn = document.getElementById("edit-note");
const newBtn = document.getElementById("newNote-add");
const toggleDeleteBtn = document.getElementById('toggleDeleteBtns');
// titleBar.style.display = 'none';
document.querySelector('.note-list-bar').style.display = 'flex';

/////////////////
/// VARIÁVEIS ///
/////////////////
let sortableInstance = null;
let rawContent = "";
let editing = false;
let isEditingTitle = false;
let oldTitleName = "";
let saveTimeout;
let isFirstLoad = true;

////////////////////
/// RENDERIZAÇÃO ///
////////////////////
function parseLinks(text) {
  return text.replace(/\[([^=\]]+)=([^\]]+)\]/g, (_, label, url) => `<a href="${url}">${label}</a>`);
}
function parseIMG(text) {
  text = text.replace(/\/img\//g,
    () => `<div class="image-uploader-placeholder" onclick="triggerImageUpload()"><p>Escolher imagem</p></div>`);
  return text.replace(/\{image=([^}]+)\}/g,
    (_, url) => `<img src="documents://Notes/Media/${url}" class="image">`);
}
function parseMarkdown(text) {
  return text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>");
}
function parseHidden(text) {
  return text.replace(/\n^\/\/ (.*)$/gm, "")
}
function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function getTextFromEditor() {
  return content.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "")
    .replace(/<(div|p)>/gi, "\n")
    .replace(/<\/?[bi]>/gi, "")
    .replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "")
    .replace(/<[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
    .trim();
}
function renderContent() {
  if (editing) {
    content.innerHTML = rawContent.replace(/\n/g, "<br>");
  } else {
    let html = parseMarkdown(rawContent);
    html = parseLinks(html);
    html = parseHidden(html);
    html = parseIMG(html);
    html = html.replace(/<\/h([1-3])>\n/g, "</h$1>").replace(/\n/g, "<br>");
    content.innerHTML = html;
  }
  content.contentEditable = editing;
}

/////////////////////////
/// CARREGAR / SALVAR ///
/////////////////////////
const BASE = 'documents://Notes';

const noteUrl = (name) => `${BASE}/${encodeURIComponent(name)}.txt`;
const LIST_URL = `${BASE}/.NotesList`;

async function renameNote(oldName, newName) {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();

  if (!cleanNew) throw new Error('O novo nome não pode ser vazio.');
  if (cleanOld === cleanNew) return { success: true, newName: cleanNew };

  // 1. Lê a nota original
  const oldRes = await fetch(noteUrl(cleanOld));
  if (!oldRes.ok) {
    throw new Error('O arquivo original da nota não foi encontrado.');
  }
  const content = await oldRes.text();

  // 2. Evita sobrescrever uma nota existente (o renameSync original sobrescrevia em silêncio)
  const exists = await fetch(noteUrl(cleanNew));
  if (exists.ok) {
    throw new Error(`Já existe uma nota chamada "${cleanNew}".`);
  }

  // 3. Grava com o novo nome
  const putRes = await fetch(noteUrl(cleanNew), { method: 'PUT', body: content });
  if (!putRes.ok) throw new Error('Falha ao criar a nota com o novo nome.');

  // 4. Atualiza o .NotesList
  const listRes = await fetch(LIST_URL);
  if (listRes.ok) {
    const text = await listRes.text();
    const updated = text
      .split(/\r?\n/)
      .map((line) => (line.trim() === cleanOld ? cleanNew : line))
      .join('\n');

    const listPut = await fetch(LIST_URL, { method: 'PUT', body: updated });
    if (!listPut.ok) {
      // desfaz para não deixar a nota duplicada
      await fetch(noteUrl(cleanNew), { method: 'DELETE' });
      throw new Error('Falha ao atualizar a lista de notas.');
    }
  }

  // 5. Só apaga a antiga depois que tudo deu certo
  await fetch(noteUrl(cleanOld), { method: 'DELETE' });

  return { success: true, newName: cleanNew };
}

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    return { ok: false, status: 0, text: async () => '' };
  }
}

async function createNoteFile(name) {
  const clean = name.trim();
  if (!clean) throw new Error('O nome da nota não pode ser vazio.');

  // 1. Cria o arquivo só se ainda não existir (não sobrescreve conteúdo)
  const exists = await safeFetch(noteUrl(clean));
  if (!exists.ok) {
    const put = await safeFetch(noteUrl(clean), { method: 'PUT', body: '' });
    if (!put.ok) throw new Error('Falha ao criar a nota.');
  }

  // 2. Lê a lista (se não existir, começa vazia)
  const listRes = await safeFetch(LIST_URL);
  const text = listRes.ok ? await listRes.text() : '';
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

  // 3. Adiciona no topo se ainda não estiver
  if (!lines.includes(clean)) {
    lines.unshift(clean);
    const listPut = await safeFetch(LIST_URL, { method: 'PUT', body: lines.join('\n') });
    if (!listPut.ok) throw new Error('Falha ao atualizar a lista de notas.');
  }

  return clean;
}
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    return { ok: false, status: 0, text: async () => '' };
  }
}

async function deleteNoteFile(name) {
  const clean = name.trim();

  // 1. Remove da lista primeiro
  const listRes = await safeFetch(LIST_URL);
  if (listRes.ok) {
    const text = await listRes.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== clean);

    const listPut = await safeFetch(LIST_URL, { method: 'PUT', body: lines.join('\n') });
    if (!listPut.ok) throw new Error('Falha ao atualizar a lista de notas.');
  }

  // 2. Apaga o arquivo
  const del = await safeFetch(noteUrl(clean), { method: 'DELETE' });
  if (!del.ok) throw new Error('Falha ao apagar a nota.');

  return clean;
}
async function saveNoteFile(name, content) {
  const clean = name.trim();
  if (!clean) throw new Error('O nome da nota não pode ser vazio.');

  let res;
  try {
    res = await fetch(noteUrl(clean), { method: 'PUT', body: content ?? '' });
  } catch {
    throw new Error('Falha ao salvar a nota.');
  }

  if (!res.ok) throw new Error('Falha ao salvar a nota.');
}
async function saveNotesOrder(content) {
  const body = Array.isArray(content) ? content.join('\n') : (content ?? '');

  let res;
  try {
    res = await fetch(LIST_URL, { method: 'PUT', body });
  } catch {
    throw new Error('Falha ao salvar a ordem das notas.');
  }

  if (!res.ok) throw new Error('Falha ao salvar a ordem das notas.');
}
const MEDIA_BASE = 'documents://Notes/Media';
const mediaUrl = (fileName) => `${MEDIA_BASE}/${encodeURIComponent(fileName)}`;

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED_EXT.map((e) => `.${e}`).join(',');

    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));

    input.click();
  });
}

async function selectAddImage() {
  const file = await pickImageFile();
  if (!file) return null;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return null;

  const uniqueFileName = `img_${Date.now()}.${ext}`;

  try {
    const res = await fetch(mediaUrl(uniqueFileName), { method: 'PUT', body: file });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return uniqueFileName;
  } catch (error) {
    console.error('Erro ao salvar a imagem:', error?.message ?? error);
    return null;
  }
}

async function loadNotes() {
  const res = await fetch(`documents://Notes/.NotesList`);
  const data = await res.text();
  const names = data.split("\n").map(l => l.trim()).filter(Boolean);

  const activeName = tablist.querySelector(".tab.active")?.dataset.name;

  tablist.innerHTML = names.map(name => `
      <p class="tab${name === activeName ? ' active' : ''}" data-name="${name}">
          <!-- <i class="fa-solid fa-grip-vertical tab-drag-handle"></i> -->
          <span class="tab-name">${name}</span>
          <i id="delete-note" class="fa-solid fa-trash" style="display: none;"></i>
      </p>`).join("");

  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = Sortable.create(tablist, {
    animation: 150,
    handle: '.tab',
    direction: 'vertical',
    forceFallback: true,
    fallbackOnBody: true,
    onEnd: async () => {
      const newOrder = [...tablist.querySelectorAll('.tab')].map(t => t.dataset.name).join('\n');
      await saveNotesOrder(newOrder);
    }
  });

  // if (isFirstLoad) {
  //   isFirstLoad = false;
  //   openFromHash();
  // } else {
  //   openFromHash() || openTab(tablist.querySelector(".tab.active") || tablist.querySelector(".tab"));
  // }
}

tablist.addEventListener("click", (e) => {
  if (e.target.closest("#delete-note")) {
    const tab = e.target.closest(".tab");
    if (tab) deleteNote(tab.dataset.name);
    return;
  }
  const tab = e.target.closest(".tab");
  if (!tab) return;
  openTab(tab);
});

function openTab(tab) {
  if (!tab) return;
  tablist.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  loadNote(tab, false);
  // titleBar.style.display = 'flex';
}

async function loadNote(tab, edit = false) {
  const name = tab.dataset.name;
  const safeName = encodeURIComponent(name);

  try {
    const res = await fetch(`documents://Notes/${safeName}.txt`);
    if (!res.ok) throw new Error("Nota não encontrada");
    const data = await res.text();

    rawContent = decodeHtml(data);
    editing = edit;
    editBtn.className = editing ? "normal-btn fa-solid fa-floppy-disk" : "normal-btn fa-solid fa-pen-to-square";

    renderContent();
    noteTitleElement.textContent = name;
    window.location.hash = safeName;
    document.querySelector('.note-list-bar').style.display = 'none';
    document.querySelector('.note-view').style.display = 'flex';
    document.querySelector('.open-note-bar').style.display = 'flex';
  } catch (err) {
    console.error("Erro ao carregar a nota:", err);
  }
}

function openFromHash() {
  const hash = decodeURIComponent(window.location.hash.substring(1));
  if (!hash) return false;

  const tab = [...tablist.querySelectorAll('.tab')].find(t => t.dataset.name === hash);
  if (!tab) return false;

  tab.classList.add("active");
  openTab(tab);
  return true;
}

async function saveNote() {
  const name = tablist.querySelector(".tab.active")?.dataset.name;
  if (!name) return;
  await saveNoteFile(name, rawContent);
}

async function deleteNote(name) {
  await deleteNoteFile(name);
  await loadNotes();

  if (!tablist.querySelector('.tab')) {
    rawContent = '';
    content.innerHTML = '';
    // titleBar.style.display = 'none';
  }
}

async function createNote() {
  const baseName = 'Nova nota';
  let name = baseName;
  let counter = 1;
  while ([...tablist.querySelectorAll('.tab')].some(t => t.dataset.name === name)) {
    name = `${baseName} (${counter})`;
    counter++;
  }

  rawContent = '';
  content.innerHTML = '';

  try {
    await createNoteFile(name);
    await loadNotes();

    // requestAnimationFrame(() => {
    //   const newTab = [...tablist.querySelectorAll('.tab')].find(t => t.dataset.name === name);
    //   if (!newTab) return;
    //   openTab(newTab);
    //   loadNote(newTab, true).then(() => content.focus());
    // });
  } catch (err) {
    console.error("Erro ao criar nota:", err);
  }
}
function exitNote() {
  window.location.hash = "";
  document.querySelector('.note-view').style.display = 'none';
  document.querySelector('.open-note-bar').style.display = 'none';
  document.querySelector('.note-list-bar').style.display = 'flex';
}

//////////////
/// EDIÇÃO ///
//////////////
async function editToggle() {
  editing = !editing;
  if (!editing) {
    rawContent = getTextFromEditor();
    await saveNote();
  }
  editBtn.className = editing ? "normal-btn fa-solid fa-floppy-disk" : "normal-btn fa-solid fa-pen-to-square";
  renderContent();
}

content.addEventListener("input", async () => {
  if (!editing) return;
  rawContent = getTextFromEditor();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveNote();
  }, 500);
});

content.addEventListener("click", (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();
  const url = link.getAttribute('href');
  if (url) window.electronAPI.openLink(url);
});

async function triggerImageUpload() {
  const imageProtocolPath = await selectAddImage();
  if (!imageProtocolPath) return;

  rawContent = rawContent.replace('/img/', `{image=${imageProtocolPath}}`);
  renderContent();
  await saveNote();
}

//////////////
/// TÍTULO ///
//////////////
noteTitleElement.addEventListener('click', () => {
  if (isEditingTitle) return;
  oldTitleName = noteTitleElement.textContent.trim();
  isEditingTitle = true;
  noteTitleElement.contentEditable = true;
  noteTitleElement.focus();
});
noteTitleElement.addEventListener('blur', finishTitleEdit);
noteTitleElement.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    noteTitleElement.blur();
  }
  if (e.key === 'Escape') {
    noteTitleElement.textContent = oldTitleName;
    noteTitleElement.contentEditable = false;
    isEditingTitle = false;
  }
});

async function finishTitleEdit() {
  if (!isEditingTitle) return;

  noteTitleElement.contentEditable = false;
  isEditingTitle = false;

  const newName = noteTitleElement.textContent.trim();
  const cleanOldName = oldTitleName.trim();

  if (!newName || newName === cleanOldName) {
    noteTitleElement.textContent = cleanOldName;
    return;
  }

  if (!/^[a-z0-9 áéíóúâêîôûãõçíàèìòù()]+$/i.test(newName)) {
    alert(`Nome inválido.`);
    noteTitleElement.textContent = cleanOldName;
    return;
  }

  try {
    await renameNote(cleanOldName, newName);
    window.location.hash = encodeURIComponent(newName);
    await loadNotes();
  } catch (err) {
    console.error("Erro ao renomear o título:", err);
    alert("Não foi possível salvar o novo nome.");
    noteTitleElement.textContent = cleanOldName;
  }
}

///////////////
/// ATALHOS ///
///////////////
editBtn.addEventListener('click', async (event) => {
    await editToggle(event);
});
newBtn.addEventListener('click', createNote);

toggleDeleteBtn.addEventListener('click', () => {
  const deleteBtns = document.querySelectorAll('#delete-note');
  const isVisible = [...deleteBtns].some(btn => btn.style.display !== 'none');
  deleteBtns.forEach(btn => { btn.style.display = isVisible ? 'none' : 'block'; });
});

document.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (editing) await editToggle();
  }
});

/////////////////////
/// INICIALIZAÇÃO ///
/////////////////////
loadNotes().catch(err => console.error("Erro ao carregar notas no início:", err));