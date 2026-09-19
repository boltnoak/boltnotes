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
    onEnd: () => {
      const newOrder = [...tablist.querySelectorAll('.tab')].map(t => t.dataset.name).join('\n');
      window.api.notes.saveOrder(newOrder);
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

function saveNote() {
  const name = tablist.querySelector(".tab.active")?.dataset.name;
  if (!name) return;
  window.api.notes.save(name, rawContent);
}

async function deleteNote(name) {
  window.api.notes.delete(name);
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
    await window.api.notes.create(name);
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
function editToggle() {
  editing = !editing;
  if (!editing) {
    rawContent = getTextFromEditor();
    saveNote();
  }
  editBtn.className = editing ? "normal-btn fa-solid fa-floppy-disk" : "normal-btn fa-solid fa-pen-to-square";
  renderContent();
}

content.addEventListener("input", () => {
  if (!editing) return;
  rawContent = getTextFromEditor();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveNote, 500);
});

content.addEventListener("click", (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();
  const url = link.getAttribute('href');
  if (url) window.api.openLink(url);
});

async function triggerImageUpload() {
  const imageProtocolPath = await window.api.notes.selectAndImage();
  if (!imageProtocolPath) return;

  rawContent = rawContent.replace('/img/', `{image=${imageProtocolPath}}`);
  renderContent();
  saveNote();
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
    await window.api.notes.rename(cleanOldName, newName);
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
editBtn.addEventListener('click', editToggle);
newBtn.addEventListener('click', createNote);

toggleDeleteBtn.addEventListener('click', () => {
  const deleteBtns = document.querySelectorAll('#delete-note');
  const isVisible = [...deleteBtns].some(btn => btn.style.display !== 'none');
  deleteBtns.forEach(btn => { btn.style.display = isVisible ? 'none' : 'block'; });
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (editing) editToggle();
  }
});

/////////////////////
/// INICIALIZAÇÃO ///
/////////////////////
loadNotes().catch(err => console.error("Erro ao carregar notas no início:", err));