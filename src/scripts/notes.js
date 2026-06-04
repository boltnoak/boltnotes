const content = document.getElementById("content");
const tablist = document.getElementById("tabs");
const tabs = document.querySelectorAll(".tab");

function parseLinks(text) {
  return text.replace(/\[([^=\]]+)=([^\]]+)\]/g, (match, label, url) => {
    return `<a href="${url}">${label}</a>`;
  });
}

function parseMarkdown(text) {
  return text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^ ### (.*)$/gm, " # $1")
    .replace(/^ ## (.*)$/gm, " # $1")
    .replace(/^ # (.*)$/gm, " # $1");
}

function getTextFromEditor() {
  return content.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<div>/gi, "\n")
    .replace(/<\/p>/gi, "")
    .replace(/<p>/gi, "\n")
    .replace(/\n+/g, "\n")
    .trim();
}

function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

const titleBar = document.querySelector('.title-bar');
const noteTitle = document.getElementById('title-note');

titleBar.style.display = 'none';

fetch(`documents://notes.data`)
  .then(res => res.text())
  .then(data => {
    const lines = data.split("\n").filter(l => l.trim() !== "");

    tablist.innerHTML = lines
      .map(name => `
        <p class="tab">
          ${name.trim()}
          <i id="delete-note" class="fa-solid fa-trash" onclick="deleteNote('${name.trim()}')"></i>
        </p>`)
      .join("");

    const tabs = document.querySelectorAll(".tab");

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {

        tabs.forEach(t => t.classList.remove("active"));

        tab.classList.add("active");

        loadNote(tab);
        
        titleBar.style.display = 'flex';
      });
    });

    const activeTab = document.querySelector(".tab.active");
    if (activeTab) {
      loadNote(activeTab);
    }
  });

const editBtn = document.getElementById("edit-note");

let rawContent = "";
let editing = false;

editBtn.addEventListener("click", () => {
  editing = !editing;

  if (!editing) {
    rawContent = getTextFromEditor();
    saveNote();
  }

  editBtn.className = editing ? "fa-solid fa-floppy-disk" : "fa-solid fa-pen-to-square";

  renderContent();
});
function saveNote() {
  const activeTab = document.querySelector(".tab.active");
  if (!activeTab) return;

  const name = activeTab.firstChild.textContent.trim();

  window.api.notes.save(name, rawContent);
}

let saveTimeout;

content.addEventListener("input", () => {
  if (!editing) return;

  rawContent = getTextFromEditor();

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveNote();
  }, 500);
});

function loadNote(tab) {
  const name = tab.firstChild.textContent.trim();

  const safeName = encodeURIComponent(name);

  fetch(`documents://Notes/${safeName}.txt`)
    .then(res => {
        if (!res.ok) throw new Error("Nota não encontrada");
        return res.text();
    })
    .then(data => {
      rawContent = decodeHtml(data);

      renderContent();

      document.getElementById('title-note').textContent = name;
      document.getElementById('menuTitle').textContent = document.title;
      document.querySelector('.note-sep-bar').style.display = 'flex';
    })
    .catch(err => console.error("Erro ao carregar a nota:", err));
}

function deleteNote(el) {
  let name = el;

  window.api.notes.delete(name);
  window.location.reload();
}

function renderContent() {
  if (editing) {
    content.innerHTML = rawContent.replace(/\n/g, "<br>");
  } else {
    let html = parseMarkdown(rawContent);
    html = parseLinks(html);
    html = html.replace(/<\/h([1-3])>\n/g, "</h$1>");
    html = html.replace(/\n/g, "<br>");
    content.innerHTML = html;
  }

  content.contentEditable = editing;
}

content.addEventListener("click", (e) => {
  const link = e.target.closest('a');
  if (link) {
    e.preventDefault();
    const url = link.getAttribute('href');
    if (url) {
      window.api.openLink(url); 
    }
  }
});

const activeTab = document.querySelector(".tab.active");
if (activeTab) {
  loadNote(activeTab);
}

const newBtn = document.getElementById("newNote-add");

if (newBtn) {
  newBtn.addEventListener("click", async () => {
    const input = document.getElementById("newNote-name");
    let name = input.value;

    if (!name) return;

    name = name.trim();

    if (!/^[a-z0-9 ]+$/i.test(name)) {
      alert("Nome inválido");
      return;
    }

    input.value = "";

    try {
      await window.api.notes.create(name);
      await loadPages();

      window.location.reload();
    } catch (err) {
      console.error("Erro:", err);
    }
  });
}

async function loadPages() {
  const tablist = document.getElementById("tabs");
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      loadNote(tab);
    });
  });

  const activeTab = document.querySelector(".tab.active") || tabs[0];
  if (activeTab) {
    activeTab.classList.add("active");
    loadNote(activeTab);
  }
}

loadPages();

const noteTitleElement = document.getElementById('title-note');
let oldTitleName = "";
let isEditing = false;

noteTitleElement.addEventListener('click', () => {
  if (!isEditing) {
    oldTitleName = noteTitleElement.textContent.trim();
    isEditing = true;
    
    noteTitleElement.contentEditable = true;
    noteTitleElement.focus();
  }
});

noteTitleElement.addEventListener('blur', () => {
  finishTitleExecution();
});

noteTitleElement.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    noteTitleElement.blur();
  }
  if (e.key === 'Escape') {
    noteTitleElement.textContent = oldTitleName;
    noteTitleElement.contentEditable = false;
    isEditing = false;
  }
});

async function finishTitleExecution() {
  if (!isEditing) return; 

  noteTitleElement.contentEditable = false;
  isEditing = false;
  
  let newName = noteTitleElement.textContent.trim();
  const cleanOldTitleName = oldTitleName.trim(); 

  if (!newName || newName === cleanOldTitleName) {
    noteTitleElement.textContent = cleanOldTitleName;
    return;
  }

  if (!/^[a-z0-9 ]+$/i.test(newName)) {
    alert("Nome inválido. Use apenas letras, números e espaços.");
    noteTitleElement.textContent = cleanOldTitleName;
    return;
  }

  try {
    console.log("Enviando para o main:", cleanOldTitleName, newName);
    await window.electronAPI.notes.rename(cleanOldTitleName, newName);
    window.location.reload();
  } catch (err) {
    console.error("Erro ao renomear o título:", err);
    alert("Não foi possível salvar o novo nome.");
    noteTitleElement.textContent = cleanOldTitleName;
  }
}