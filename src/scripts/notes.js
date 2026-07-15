const content = document.getElementById("content");
const tablist = document.getElementById("tabs");
const tabs = document.querySelectorAll(".tab");

function parseLinks(text) {
  return text.replace(/\[([^=\]]+)=([^\]]+)\]/g, (match, label, url) => {
    return `<a href="${url}">${label}</a>`;
  });
}

function parseIMG(text) {
  text = text.replace(/\/img\//g, () => {
        return `<div class="image-uploader-placeholder" onclick="triggerImageUpload()"><p>Escolher imagem</p></div>`;
    });
    text = text.replace(/\{image=([^}]+)\}/g, (match, url) => {
        return `<img src="${url}" class="image">`;
    });

    return text;
}

function getNoteContent() {
    return noteContent.innerHTML
        .replace(/<div><br><\/div>/gi, '\n')
        .replace(/<br>/gi, '\n')
        .replace(/<div>/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
}
function setNoteContent(text) {
    if (!text) {
        noteContent.innerHTML = '<div><br></div>';
        return;
    }
    noteContent.innerHTML = text
        .split('\n')
        .map(line => `<div>${line || '<br>'}</div>`)
        .join('');
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
    .replace(/<b>/gi, "").replace(/<\/b>/gi, "")
    .replace(/<i>/gi, "").replace(/<\/i>/gi, "")
    .replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "")
    .replace(/<[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

const titleBar = document.querySelector('.title-bar');
const noteTitle = document.getElementById('title-note');

titleBar.style.display = 'none';

let sortableInstance = null;

async function loadNotes() {
  const res = await fetch(`documents://Notes/.NotesList`);
  const data = await res.text();
  const lines = data.split("\n").filter(l => l.trim() !== "");

  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  tablist.innerHTML = lines
    .map(name => `
        <p class="tab" data-name="${name.trim()}">
            <!-- <i class="fa-solid fa-grip-vertical tab-drag-handle" style="display: none;"></i> -->
            <i class="fa-solid fa-grip-vertical tab-drag-handle"></i>
            <span class="tab-name">${name.trim()}</span>
            <i id="delete-note" class="fa-solid fa-trash" onclick="deleteNote('${name.trim()}')" style="display: none;"></i>
        </p>`)
    .join("");

  sortableInstance = Sortable.create(tablist, {
    animation: 150,
    handle: '.tab-drag-handle',
    direction: 'vertical',
    forceFallback: true,
    fallbackOnBody: true,
    onEnd: () => {
      const newOrder = [...tablist.querySelectorAll('.tab')]
        .map(tab => tab.dataset.name)
        .join('\n');
      window.api.notes.saveOrder(newOrder);
    }
  });

  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      loadNote(tab, false);
      
      titleBar.style.display = 'flex';
    });
  });

  verificarHashEAbriNota();

  const activeTab = document.querySelector(".tab.active");
  if (activeTab) {
    loadNote(activeTab);
  }
};

(async () => {
    try {
        await loadNotes();
        console.log("Notas carregadas com sucesso!");
    } catch (err) {
        console.error("Erro ao carregar notas no início:", err);
    }
})();

const editBtn = document.getElementById("edit-note");

let rawContent = "";
let editing = false;

editBtn.addEventListener('click', () => editToggle())
function editToggle() {
  editing = !editing;

  if (!editing) {
    rawContent = getTextFromEditor();
    saveNote();
  }

  editBtn.className = editing ? "fa-solid fa-floppy-disk" : "fa-solid fa-pen-to-square";

  rawContent = rawContent || '';
  renderContent();
};
function saveNote() {
  const activeTab = document.querySelector(".tab.active");
  if (!activeTab) return;

  const name = activeTab.dataset.name;

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

function loadNote(tab, edit = false) {
  const name = tab.dataset.name;

  const safeName = encodeURIComponent(name);

  fetch(`documents://Notes/${safeName}.txt`)
    .then(res => {
        if (!res.ok) throw new Error("Nota não encontrada");
        return res.text();
    })
    .then(data => {
      rawContent = decodeHtml(data);

      editing = edit;
      editBtn.className = editing ? "fa-solid fa-floppy-disk" : "fa-solid fa-pen-to-square";

      renderContent();

      document.getElementById('title-note').textContent = name;
      document.querySelector('.note-sep-bar').style.display = 'flex';

      window.location.hash = safeName;
    })
    .catch(err => console.error("Erro ao carregar a nota:", err));
}

async function deleteNote(el) {
  let name = el;

  window.api.notes.delete(name);
  await loadNotes();

  const firstTab = tablist.querySelector('.tab');
  if (firstTab) {
    rawContent = '';
    content.innerHTML = '';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    firstTab.classList.add('active');
    loadNote(firstTab);
    titleBar.style.display = 'flex';
  } else {
    rawContent = '';
    content.innerHTML = '';
    titleBar.style.display = 'none';
  }
}
function verificarHashEAbriNota() {
  const hash = window.location.hash.substring(1);

  if (hash) {
    const nomeDaNotaSalva = decodeURIComponent(hash);
    const abas = document.querySelectorAll('.tab');

    const abaCorrespondente = Array.from(abas).find(tab => {
      return tab.dataset.name === nomeDaNotaSalva;
    });

    if (abaCorrespondente) {
      abaCorrespondente.classList.add("active");

      // document.title = `BoltNotes — ${nomeDaNotaSalva}`;
      document.getElementById('title-note').textContent = nomeDaNotaSalva;
      // document.getElementById('menuTitle').textContent = nomeDaNotaSalva;
      
      titleBar.style.display = 'flex';

      loadNote(abaCorrespondente);
    } else {
      console.log(`Aba não encontrada para a hash: ${nomeDaNotaSalva}`);
    }
  }
}
function renderContent() {
  if (editing) {
    content.innerHTML = rawContent.replace(/\n/g, "<br>");
  } else {
    let html = parseMarkdown(rawContent);
    html = parseLinks(html);
    html = parseIMG(html)
    html = html.replace(/<\/h([1-3])>\n/g, "</h$1>");
    html = html.replace(/\n/g, "<br>");
    content.innerHTML = html;
  }

  content.contentEditable = editing;
}

async function triggerImageUpload() {
    const imageProtocolPath = await window.api.notes.selectAndImage();
    if (!imageProtocolPath) return;

    rawContent = rawContent.replace('/img/', `{image=${imageProtocolPath}}`);
    
    renderContent();
    saveNote();
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
newBtn.addEventListener('click', () => createNote())

async function createNote() {
  const baseName = 'Nova nota';
  let name = baseName;
  let counter = 1;

  while (tablist.querySelector(`[data-name="${name}"]`)) {
    name = `${baseName} ( ${counter} )`;
    counter++;
  }

  rawContent = '';
  content.innerHTML = '';

  try {
    await window.api.notes.create(name);
    await loadPages();
    await loadNotes();

    setTimeout(() => {
      const newTab = tablist.querySelector(`[data-name="${name}"]`);
      if (newTab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        newTab.classList.add('active');

        loadNote(newTab, true);

        renderContent();

        requestAnimationFrame(() => {
          content.focus();
        });
      }
    }, 25);

    const safeNewName = encodeURIComponent(name);
    window.location.hash = safeNewName;
  } catch (err) {
    console.error("Erro:", err);
  }
}

async function loadPages() {
  const tablist = document.getElementById("tabs");
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      loadNote(tab, false);
    });
  });

  const activeTab = document.querySelector(".tab.active") || tabs[0];
  if (activeTab) {
    activeTab.classList.add("active");
    loadNote(activeTab);
  }
}

(async () => {
    try {
        await loadPages();
        console.log("Notas carregadas com sucesso!");
    } catch (err) {
        console.error("Erro ao carregar notas no início:", err);
    }
})();

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
    const invalid = newName.match(/[^a-z0-9 áéíóúâêîôûãõçíàèìòù\(\)]/gi);

    if (invalid) {
      // const todosProibidos = "! @ # $ % % & * _ + - = { } [ ] ^ ~ ; : . , / ? \\ | ' \"";
      alert(`Nome inválido.`);
      noteTitleElement.textContent = cleanOldTitleName;

      return;
    }
  }

  try {
    console.log("Enviando para o main:", cleanOldTitleName, newName);
    await window.electronAPI.notes.rename(cleanOldTitleName, newName);

    const safeNewName = encodeURIComponent(newName);

    window.location.hash = safeNewName;

    await loadNotes();
  } catch (err) {
    console.error("Erro ao renomear o título:", err);

    alert("Não foi possível salvar o novo nome.");
    noteTitleElement.textContent = cleanOldTitleName;
  }
}

// const editSortingBtn = document.getElementById('editSorting');
// editSortingBtn.addEventListener('click', () => {
//     const sortingBtns = document.querySelectorAll('.tab-drag-handle');
//     const isVisible = [...sortingBtns].some(btn => btn.style.display !== 'none');

//     sortingBtns.forEach(btn => {
//         btn.style.display = isVisible ? 'none' : 'block';
//     });
// });

const toggleDeleteBtn = document.getElementById('toggleDeleteBtns');
toggleDeleteBtn.addEventListener('click', () => {
    const deleteBtns = document.querySelectorAll('#delete-note');
    const isVisible = [...deleteBtns].some(btn => btn.style.display !== 'none');

    deleteBtns.forEach(btn => {
        btn.style.display = isVisible ? 'none' : 'block';
    });
});