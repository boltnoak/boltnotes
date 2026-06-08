const {app, BrowserWindow, ipcMain, Menu, Tray, protocol, net, nativeImage, screen} = require('electron');
const { autoUpdater } = require('electron-updater');
const { pathToFileURL } = require('url');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');
const extract = require('extract-zip');

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

function downloadFile(url, destination, onProgress, retries = 3) {
  return new Promise((resolve, reject) => {

    const attempt = (currentUrl, triesLeft) => {
      const req = https.get(currentUrl, {
        headers: {
          'accept-encoding': 'identity',
          'user-agent': 'BoltNotes'
        }
      }, response => {

        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          return attempt(response.headers.location, triesLeft);
        }

        if (response.statusCode !== 200) {
          response.resume();
          return reject(new Error(`Download falhou: ${response.statusCode}`));
        }

        const total = Number(response.headers['content-length']) || null;
        let downloaded = 0;

        const file = fs.createWriteStream(destination);

        file.on('error', (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });

        response.on('data', chunk => {
          downloaded += chunk.length;
          if (onProgress) onProgress(downloaded, total);
        });

        response.pipe(file);

        // VERIFICAÇÃO CRÍTICA AQUI
        file.on('finish', () => {
          file.close(() => {
            // Se o servidor informou o tamanho total e o que baixamos não bate certo,
            // o arquivo foi cortado e está corrompido.
            if (total && downloaded !== total) {
              fs.unlink(destination, () => {}); // Apaga o lixo
              if (triesLeft > 0) {
                console.warn(`[Download] Incompleto (${downloaded}/${total} bytes). A tentar novamente...`);
                setTimeout(() => attempt(currentUrl, triesLeft - 1), 2000);
              } else {
                reject(new Error(`Download incompleto e corrompido: obtidos ${downloaded} de ${total} bytes.`));
              }
            } else {
              resolve();
            }
          });
        });

        response.on('error', (err) => {
          file.close();
          fs.unlink(destination, () => {});
          if (triesLeft > 0) {
            setTimeout(() => attempt(currentUrl, triesLeft - 1), 2000);
          } else {
            reject(err);
          }
        });
      });

      req.setTimeout(60000, () => {
        req.destroy();
        fs.unlink(destination, () => {});
        if (triesLeft > 0) {
          setTimeout(() => attempt(currentUrl, triesLeft - 1), 2000);
        } else {
          reject(new Error('Timeout após todas as tentativas'));
        }
      });

      req.on('error', (err) => {
        fs.unlink(destination, () => {});
        if (triesLeft > 0) {
          setTimeout(() => attempt(currentUrl, triesLeft - 1), 2000);
        } else {
          reject(err);
        }
      });
    };

    attempt(url, retries);
  });
}


  
async function downloadPackage(name) {
  const url = `https://github.com/boltnoak/boltnotes-assets/releases/latest/download/${name}`;
  const zipPath = path.join(app.getPath('userData'), name);

  let lastLog = '';

  await downloadFile(url, zipPath, (downloaded, total) => {
    const mb = (downloaded / 1024 / 1024).toFixed(1);
    const line = total
      ? `Assets - ${name}: ${Math.round(downloaded * 100 / total)}% (${mb} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`
      : `Assets - ${name}: ${mb} MB`;

    if (line !== lastLog) {
      lastLog = line;
      process.stdout.write(`\r${line}   `);
      win?.webContents.send('assets-progress', {
        package: name,
        downloaded,
        total,
        percent: total ? Math.round(downloaded * 100 / total) : null
      });
    }
  });

  process.stdout.write('\n');

  try {
    await extract(zipPath, { dir: ASSETS_DIR });
  } catch (err) {
    console.error(`Erro ao extrair ${name}:`, err);
    throw err;
  } finally {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
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


async function syncAssets() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  let remote, local;

  try {
    remote = await getRemoteManifest();
  } catch (err) {
    throw new Error(`Falha ao buscar manifest de assets remoto.`);
  }

  local = getLocalManifest() || { version: 0, packages: [] };

  for (const pkg of remote.packages) {
    const localPkg = local.packages.find(p => p.name === pkg.name);

    if (localPkg && localPkg.hash === pkg.hash) {
      console.log(`Assets - ${pkg.name} (atualizado)`);
      continue;
    }

    console.log(`Assets - Baixando ${pkg.name}...`);

    try {
      await downloadPackage(pkg.name);

      const idx = local.packages.findIndex(p => p.name === pkg.name);
      if (idx >= 0) {
        local.packages[idx] = pkg;
      } else {
        local.packages.push(pkg);
      }

      fs.writeFileSync(LOCAL_MANIFEST, JSON.stringify(local, null, 2));
      console.log(`Assets - ${pkg.name} salvo no manifest local`);

    } catch (err) {
      console.error(`Assets - Erro ao baixar ${pkg.name}:`, err.message);
    }
  }
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
let assetsReady = false;
let updateReady = false;

function getConfig() {
  const configPath = path.join(app.getPath('userData'),'config.json');
  const configDefault = {
    maximize_on_start: false,
    open_on_startup: false,
    minimize_to_tray: false,
    backlog_on_home: false,
    playing_now_on_home: false,
    notes_on_home: true,
    fortnite_on_home: true,
    show_version: true
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
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const larguraProporcional = Math.round(screenWidth * 0.9);
    const alturaProporcional = Math.round(screenHeight * 0.85);

    win = new BrowserWindow({
        width: larguraProporcional,
        height: alturaProporcional,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        show: false,
        hasShadow: false,
        // resizable: false,
        thickFrame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          autoplayPolicy: 'no-user-gesture-required'
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
      const url = new URL(req.url);

      const filePart =
        url.pathname === '/'
          ? url.hostname
          : url.hostname + url.pathname;

      const fullPath = path.join(ASSETS_DIR, decodeURIComponent(filePart));

      if (!fs.existsSync(fullPath)) {
        return new Response('Not Found', { status: 404 });
      }

      const stat = fs.statSync(fullPath);
      const range = req.headers.get('range');

      const mime = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.mkv': 'video/x-matroska',
        '.mp4': 'video/mp4'
      };

      const ext = path.extname(fullPath).toLowerCase();

      if (!range) {
        const stream = fs.createReadStream(fullPath);

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': mime[ext] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Accept-Ranges': 'bytes'
          }
        });
      }

      // RANGE REQUEST
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(fullPath, { start, end });

      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime[ext] || 'application/octet-stream'
        }
      });
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

    createWindow();

    if (app.isPackaged) {
        autoUpdater.checkForUpdates();
    }

    const configs = getConfig();

    

    manageStartup(configs.open_on_startup);

    win.once('ready-to-show', () => {
      if (configs.maximize_on_start) {
        win.maximize();
      }

      makeTray();
      win.show();

      syncAssets()
      .then(() => {
        assetsReady = true;
        win.webContents.send('assets-ready');
      })
      .catch(err => {
        console.error(err);
        win.webContents.send(
          'assets-error',
          err.message
        );
      });
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

ipcMain.handle('assets-check-status', () => {
    return assetsReady;
});

autoUpdater.on('checking-for-update', () => {
    win?.webContents.send('update-status', 'Verificando atualizações...');
});
autoUpdater.on('update-available', (info) => {
    win?.webContents.send('update-status', 'Atualização disponível!');
});
autoUpdater.on('download-progress', (progressObj) => {
    win?.webContents.send('update-progress', progressObj.percent);
});
autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    if (win && !win.isDestroyed()) {
      win?.webContents.send('update-ready-to-install');
    }

    const { Notification } = require('electron');
    new Notification({
        title: 'BoltNotes atualizado!',
        body: `Versão ${info.version} baixada.`,
        icon: path.join(__dirname, 'icon.png')
    }).show();
});
ipcMain.handle('update:check-status', () => {
    return updateReady;
});
ipcMain.on('update:restart', () => {
    autoUpdater.quitAndInstall();
});
autoUpdater.on('error', (err) => {
    console.error('AutoUpdater - Erro:', err.message);
    win?.webContents.send('update-status', 'Erro na atualização: ' + err.message);
});

// Menu
ipcMain.on('menu:maximize-app', () => {
  if (!win) return;
  
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.setMaximizable(true); 
    win.maximize();
  }
});
ipcMain.on('menu:minimize-app', () => { win.minimize(); });
ipcMain.on('menu:close-app', () => {
  const config = getConfig();

  if (config.minimize_to_tray) {
    win.hide();
  } else {
    isQuitting = true;
    app.quit();
  }
});
ipcMain.handle('menu:is-maximized', () => { return win.isMaximized() });

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
        path.join(ASSETS_DIR, 'fortnite/trailers')
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
  if (filePath.startsWith('assets://')) {
    const url = new URL(filePath);
    const filePart = url.pathname === '/' ? url.hostname : url.hostname + url.pathname;
    const fullPath = path.join(ASSETS_DIR, decodeURIComponent(filePart));
    return fs.existsSync(fullPath);
  }

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

  const isPackaged = app.isPackaged;

  const iconPath = isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join('build', 'icon.png');

  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });

  tray = new Tray(trayIcon);

  const navigateTo = (htmlFile) => {
    if (!win) return;
    win.loadFile(path.join(BUNDLE, 'pages', htmlFile));
    win.webContents.once('did-finish-load', () => {
      win.show();
      win.focus();
    });
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir BoltNotes', click: () => navigateTo('index.html') },
    { type: 'separator' },
    { label: 'Fortnite', click: () => navigateTo('fortnite.html') },
    { label: 'Notas', click: () => navigateTo('notes.html') },
    { label: 'Backlog de Jogos', click: () => navigateTo('games.html') },
    { type: 'separator' },
    { label: 'Preferências', click: () => navigateTo('config.html') },
    { 
      label: 'Fechar app', 
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('BoltNotes');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
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