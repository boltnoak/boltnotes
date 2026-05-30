const {app, BrowserWindow, ipcMain, Menu, Tray, protocol, net} = require('electron');
const { autoUpdater } = require('electron-updater');
const { pathToFileURL } = require('url');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');
const AdmZip = require('adm-zip');

const ASSETS_DIR = path.join(
  app.getPath('userData'),
  'assets'
);

const LOCAL_MANIFEST = path.join(
  app.getPath('userData'),
  'assets-manifest.json'
);

const MANIFEST_URL =
  'https://github.com/boltnoak/boltnotes-assets/releases/latest/download/manifest.json';

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https.get(url, response => {
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function getRemoteManifest() {
  const response = await fetch(MANIFEST_URL);

  return response.json();
}

function getLocalManifest() {
  if (!fs.existsSync(LOCAL_MANIFEST)) {
    return null;
  }

  return JSON.parse(
    fs.readFileSync(LOCAL_MANIFEST, 'utf8')
  );
}

async function downloadPackage(name) {
  const url =
    `https://github.com/boltnoak/boltnotes-assets/releases/latest/download/${name}`;

  const zipPath = path.join(
    app.getPath('userData'),
    name
  );

  await downloadFile(url, zipPath);

  const zip = new AdmZip(zipPath);

  zip.extractAllTo(ASSETS_DIR, true);

  fs.unlinkSync(zipPath);
}

async function syncAssets() {
  fs.mkdirSync(ASSETS_DIR, {
    recursive: true
  });

  const remote = await getRemoteManifest();
  const local = getLocalManifest();

  for (const pkg of remote.packages) {
    const localPkg =
      local?.packages?.find(
        p => p.name === pkg.name
      );

    if (
      !localPkg ||
      localPkg.hash !== pkg.hash
    ) {
      console.log(
        `Baixando ${pkg.name}`
      );

      await downloadPackage(pkg.name);
    }
  }

  fs.writeFileSync(
    LOCAL_MANIFEST,
    JSON.stringify(remote, null, 2)
  );
}

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

const DOCUMENTS = path.join(
    app.getPath('documents'),
    'BoltNotes'
);

const APPDATA = path.join(
    app.getPath('userData')
);

const COVERS = path.join(
    APPDATA,
    'game-covers'
);

const BUNDLE = path.join(
    __dirname
);

function startFolders() {
    const foldersToCreate = [
        DOCUMENTS,
        path.join(DOCUMENTS, 'Fortnite'),
        path.join(DOCUMENTS, 'Games'),
        path.join(DOCUMENTS, 'Notes')
    ];

    foldersToCreate.forEach(folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            console.log(`BoltNotes - Pasta criada: ${folder}`);
        }
    });
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'documents',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    },
    {
      scheme: 'assets',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
]);

let win;
let tray = null;
let isQuitting = false;

function getConfig() {
  const configPath = path.join(app.getPath('userData'),'config.json');
  const configDefault = {
    maximize_on_start: false,
    open_on_startup: false,
    minimize_to_tray: false
  };
  try {
    if (fs.existsSync(configPath)) {
      const dadosBrutos = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(dadosBrutos) }} catch (erro) {
    console.error("Erro ao ler o arquivo de configuração, usando padrão:", erro)}
  return configDefault;
}

app.on('before-quit', () => {
  isQuitting = true;
});
process.on('SIGTERM', () => {
  isQuitting = true;
  app.quit();
});
process.on('SIGINT', () => {
  isQuitting = true;
  app.quit();
});

Menu.setApplicationMenu(null);
app.commandLine.appendSwitch('enable-smooth-scrolling');

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 600,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        show: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
    });
    win.loadFile(path.join(BUNDLE,'pages','index.html'));
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {

    protocol.handle('assets', (req) => {

      const file = decodeURIComponent(
        req.url.replace('assets://', '')
      );

      const fullPath = path.join(BUNDLE,'assets',file);

      return net.fetch(
        pathToFileURL(fullPath).toString()
      );
    });

    protocol.handle('documents', (req) => {
      let file = decodeURIComponent(req.url.replace('documents://', ''));

      if (file.endsWith('/')) {
          file = file.slice(0, -1);
      }

      if (file.startsWith('notes/')) {
          file = 'Notes/' + file.slice(6);
      }

      const fullPath = path.join(DOCUMENTS, file);

      if (!fs.existsSync(fullPath)) {
          return new Response('', { 
              status: 200,
              headers: { 'Content-Type': 'text/plain' }
          });
      }
      return net.fetch(pathToFileURL(fullPath).toString());
    });

    startFolders();

    await syncAssets();

    createWindow();

    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }

    const configs = getConfig();

    if (configs.maximize_on_start) {
      win.maximize();
    }

    manageStartup(configs.open_on_startup);

    win.once('ready-to-show', () => {
      makeTray();
      win.show();
    });

    win.on('maximize', () => { win.webContents.send('window-state-change', 'maximized'); });
    win.on('unmaximize', () => { win.webContents.send('window-state-change', 'normal'); });
    win.on('close', (event) => {
      const config = getConfig();
      if (!isQuitting && config.minimize_to_tray && win !== null) {
        event.preventDefault();
        win.hide();
      }
    });
  });
}

autoUpdater.on('checking-for-update', () => {
    console.log('Checking...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available', info);
});

autoUpdater.on('update-not-available', () => {
    console.log('No updates');
});

autoUpdater.on('download-progress', (progress) => {
    console.log(progress.percent);
});

autoUpdater.on('update-downloaded', () => {
    console.log('Downloaded');

    autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (err) => {
    console.log(err);
});

// Menu
ipcMain.on('menu:maximize-app', () => {
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});
  ipcMain.on('menu:minimize-app', () => { win.minimize(); });
  ipcMain.on('menu:close-app', () => { app.quit(); });
  ipcMain.handle('menu:is-maximized', () => {
  return win.isMaximized();
});

// Básico
ipcMain.handle('fortnite:fetch-trailers', async () => {
  try {
    const gistUrl = 'https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-trailers.json';
    const response = await fetch(gistUrl);
    if (!response.ok) {
      throw new Error('Falha ao baixar o arquivo do Gist');
    }
    const data = await response.json(); 
    return data;
  } catch (error) {
    console.error('Erro ao buscar trailers:', error);
    return null;
  }
});
ipcMain.handle('fortnite:fetch-seasons', async () => {
  try {
    const gistUrl = 'https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-seasons.json';
    const response = await fetch(gistUrl);
    if (!response.ok) {
      throw new Error('Falha ao baixar o arquivo do Gist');
    }
    const data = await response.json(); 
    return data;
  } catch (error) {
    console.error('Erro ao buscar trailers:', error);
    return null;
  }
});
ipcMain.handle('fortnite:list-trailers', () => {
    return fs.readdirSync(
        path.join(BUNDLE,'assets','fortnite/trailers')
    );
});
ipcMain.handle('games:fetch-gamesdb', async () => {
  try {
    const gistUrl = 'https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/gamesdb.json';
    const response = await fetch(gistUrl);
    if (!response.ok) {
      throw new Error('Falha ao baixar o arquivo do Gist');
    }
    const data = await response.json(); 
    return data;
  } catch (error) {
    console.error('Erro ao buscar trailers:', error);
    return null;
  }
});
ipcMain.on('devTools', () => {
  if (!app.isPackaged && win && !win.isDestroyed()) {
    win.webContents.toggleDevTools();
  }
});
ipcMain.handle("exists", async (_, filePath) => {
    const fullPath = path.join(__dirname, filePath);
    return fs.existsSync(fullPath);
});
ipcMain.handle('load', (_, dirPath) => {
  const fullPath = path.join(DOCUMENTS, dirPath);

  if (!fs.existsSync(fullPath)) return [];

  return fs.readdirSync(fullPath);
});
ipcMain.handle('open-external-link', async (event, url) => {
  console.log("Abrindo no navegador:", url);
  
  const { shell } = require('electron');
  await shell.openExternal(url);
});
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('info:user-data', () => {
  return APPDATA;
});
ipcMain.handle('info:documents', () => {
  return DOCUMENTS;
});

// Configurações
ipcMain.handle('config:get', () => {
    return getConfig();
});
ipcMain.on('config:update', (event, { key, value }) => {
    const configPath = path.join(app.getPath('userData'),'config.json');
    const currentConfig = getConfig();

    currentConfig[key] = value;

    try {
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
      console.log(`Preferencias - "${key}" mudado para: ${value}`);

      if (key === 'open_on_startup') {
          manageStartup(value);
      }

    } catch (erro) {
      console.error("Erro ao salvar config.json:", erro);
    }
});
function manageStartup(abrirComOOS) {
  if (!app.isPackaged) return; 

  const osType = process.platform;

  if (osType === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: abrirComOOS,
      path: app.getPath('exe')
    });
  } 
  
  else if (osType === 'linux') {
    const homedir = os.homedir();
    const autostartDir = path.join(homedir, '.config', 'autostart');
    const desktopFilePath = path.join(autostartDir, 'boltnotes.desktop');

    if (abrirComOOS) {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }

      const desktopContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=BoltNotes
Comment=Aplicativo de Notas e Hub de Jogos
Exec="${app.getPath('exe')}"
Icon=${path.join(__dirname, 'icon.png')}
Terminal=false
StartupNotify=false
X-GNOME-Autostart-enabled=true
`;

      try {
        fs.writeFileSync(desktopFilePath, desktopContent, 'utf-8');
        console.log("[Startup] Arquivo .desktop criado com sucesso no Linux.");
      } catch (err) {
        console.error("Erro ao criar arquivo de inicialização no Linux:", err);
      }
    }
    else {
      if (fs.existsSync(desktopFilePath)) {
        try {
          fs.unlinkSync(desktopFilePath);
          console.log("[Startup] Arquivo .desktop removido do autostart.");
        } catch (err) {
          console.error("Erro ao remover arquivo de inicialização no Linux:", err);
        }
      }
    }
  }
}
function makeTray() {
  if (tray !== null) return;

  const iconPath = path.join(BUNDLE, 'icon.png');
  
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir BoltNotes', click: () => {
      win.loadFile(path.join(BUNDLE,'pages','index.html'));

      win.webContents.once('did-finish-load', () => {
        win.show();
      });
    }},
    { type: 'separator' },
    { label: 'Fortnite', click: () => {
      win.loadFile(path.join(BUNDLE,'pages','fortnite.html'));

      win.webContents.once('did-finish-load', () => {
        win.show();
      });
    }},
    { label: 'Notas', click: () => {
      win.loadFile(path.join(BUNDLE,'pages','notes.html'));

      win.webContents.once('did-finish-load', () => {
        win.show();
      });
    }},
    { label: 'Backlog de Jogos', click: () => {
      win.loadFile(path.join(BUNDLE,'pages','games.html'));

      win.webContents.once('did-finish-load', () => {
        win.show();
      });
    }},
    { type: 'separator' },
    { label: 'Preferencias', click: () => {
      win.loadFile(path.join(BUNDLE,'pages','config.html'));
      
      win.webContents.once('did-finish-load', () => {
        win.show();
      });
    }},
    { label: 'Fechar app', click: () => {
      if (!win) return;
      win = null;
      app.quit();
    }}
  ]);

  tray.setToolTip('BoltNotes');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
      win.show();
  });
}

// Carrgar/Salvar .JSON
ipcMain.handle("json:load", async (_, filePath) => {
    const fullPath = path.join(DOCUMENTS, filePath);

    if (!fs.existsSync(fullPath)) return {};

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
});
ipcMain.handle("json:save", async (_, { filePath, data }) => {
    const fullPath = path.join(DOCUMENTS, filePath);

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, JSON.stringify(data, null, 2));

    return true;
});

// Notas
ipcMain.handle('notes:create', (_, name) => {
  const notesDir = path.join(DOCUMENTS, 'Notes');
  const pagesPath = path.join(DOCUMENTS, 'notes.data');

  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }
  const filePath = path.join(notesDir, name + '.txt');

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
  if (!fs.existsSync(pagesPath)) {
    fs.writeFileSync(pagesPath, '');
  }

  const newTab = `\n${name}`;
  const pagesContent = fs.readFileSync(pagesPath, 'utf-8');

  if (!pagesContent.includes(`>${name}<`)) {
    fs.appendFileSync(pagesPath, newTab);
  }

  return name;
});
ipcMain.handle('notes:delete', (_, name) => {
  const notesDir = path.join(DOCUMENTS, 'Notes');
  const pagesPath = path.join(DOCUMENTS, 'notes.data');

  const filePath = path.join(notesDir, name + '.txt');

  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
  if (fs.existsSync(pagesPath)) {
    const pagesContent = fs.readFileSync(pagesPath, 'utf-8');
    const lines = pagesContent.split(/\r?\n/);
    const updatedLines = lines.filter(line => line.trim() !== name.trim());
    const newContent = updatedLines.join('\n');
    
    fs.writeFileSync(pagesPath, newContent, 'utf-8');
  }

  return name;
});
ipcMain.handle("notes:save", async (event, name, content) => {
  const filePath = path.join(DOCUMENTS, 'Notes', `${name}.txt`);
  fs.writeFileSync(filePath, content);
});
ipcMain.handle('notes:count', () => {
  const dir = path.join(DOCUMENTS, 'Notes');

  if (!fs.existsSync(dir)) {
    return 0;
  }
  const files = fs.readdirSync(dir);
  const count = files.filter(f => f.endsWith('.txt')).length;

  return count;
});
ipcMain.handle('notes:rename', async (event, oldName, newName) => {
  console.log("Renomeando nota de:", oldName, "para:", newName);

  const notesDir = path.join(DOCUMENTS,'Notes');
  const pagesPath = path.join(DOCUMENTS,'notes.data');

  const cleanOldName = oldName.trim();
  const cleanNewName = newName.trim();

  const oldFilePath = path.join(notesDir, `${cleanOldName}.txt`);
  const newFilePath = path.join(notesDir, `${cleanNewName}.txt`);

  try {
    if (fs.existsSync(oldFilePath)) {
      fs.renameSync(oldFilePath, newFilePath);
    } else {
      console.log(`Tentou buscar: "${oldFilePath}" mas não existia.`);
      throw new Error("O arquivo original da nota não foi encontrado.");
    }

    if (fs.existsSync(pagesPath)) {
      const pagesContent = fs.readFileSync(pagesPath, 'utf-8');
      const lines = pagesContent.split(/\r?\n/);
      
      const updatedLines = lines.map(line => {
        return line.trim() === cleanOldName ? cleanNewName : line;
      });
      
      fs.writeFileSync(pagesPath, updatedLines.join('\n'), 'utf-8');
    }

    return { success: true, newName: cleanNewName };

  } catch (error) {
    console.error("Erro no processo Main ao renomear:", error);
    throw error;
  }
});

// Jogos
ipcMain.handle('games:ensure-cover', async (_, { appid, name, cover }) => {
  const https = require('https');

  const coversDir = path.join(COVERS);

  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }

  const safeName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filePath = path.join(coversDir, safeName + '.jpg');

  if (fs.existsSync(filePath)) {
    return filePath;
  }
  let url = cover;
  if (!url && appid) {
    url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }
  if (!url) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    https.get(url, res => {
      if (res.statusCode !== 200) {
        fs.unlinkSync(filePath);
        return resolve(null);
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', err => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      resolve(null);
    });
  });
});