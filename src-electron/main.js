const {app, BrowserWindow, dialog, ipcMain, Menu, Tray, protocol, net, nativeImage, screen} = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const os = require('os');
const log = require('electron-log');
const { URL } = require('url');

const isSilent = process.argv.includes('--silent');
if (isSilent) console.log('Iniciando silenciosamente...');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoInstallOnAppQuit = false;

const DOCUMENTS = path.join(
    app.getPath('documents'),
    'BoltNotes'
);
const BUNDLE = path.join(
    __dirname,
    '..',
    'src'
);

function startFolders() {
    const folders = [
        DOCUMENTS,
        path.join(DOCUMENTS, 'Fortnite'),
        path.join(DOCUMENTS, 'Games'),
        path.join(DOCUMENTS, 'Notes'),
        path.join(DOCUMENTS, 'Notes', 'Media')
    ];
    folders.forEach(folder => {if (!fs.existsSync(folder)) {fs.mkdirSync(folder, { recursive: true })}});
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
    }
]);

let win;
let tray = null;
let trayIcon;
let isQuitting = false;
let updateReady = false;
// let trayNameIcon;

function getConfig() {
    const configPath = path.join(app.getPath('userData'),'config.json');
    const defaults = {
        language: 'en',
        maximize_on_start: false,
        open_on_startup: false,
        minimize_to_tray: false,
        backlog_on_home: false,
        notes_on_home: true,
        fortnite_on_home: true,
        show_version: true,
        last_seen_version: null,
        theme: 'dark',
        featured: 'playing_now',
        welcomed: false,
        show_featured_changer: false
    };
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data)
        }
    } catch (erro) { console.error("getConfig error:", erro) }
    return defaults;
}

app.on('before-quit', () => { isQuitting = true });
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
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    const width = Math.round(screenWidth * 0.86);
    const height = Math.round(screenHeight * 0.85);

    const isWindows = process.platform === 'win32';

    win = new BrowserWindow({
        width: width,
        height: height,
        show: false,
        frame: isWindows,
        hasShadow: isWindows,
        autoHideMenuBar: isWindows,
        resizable: !isWindows,
        maximizable: !isWindows,
        titleBarStyle: 'hidden',
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: true,
            autoplayPolicy: 'no-user-gesture-required',
            additionalArguments: [app.isPackaged ? '--production' : '--development']
        }
    });
    win.loadFile(path.join(BUNDLE, 'pages', 'shell.html'));
}

const preloaded = {};
const PAGES = ['fortnite', 'fortnite-chapter', 'games'];

function createHiddenWindow(name) {
    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadFile(path.join(BUNDLE, 'pages', `${name}.html`));
    preloaded[name] = win;
    return win;
}
function preloadAll() { PAGES.forEach(name => createHiddenWindow(name)) }

const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mkv': 'video/x-matroska',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json',
};
const ROOT_FOLDERS = ['Notes', 'Fortnite', 'Games', 'Themes'];
const ROOT_MAP = Object.fromEntries(ROOT_FOLDERS.map(f => [f.toLowerCase(), f]));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock && app.isPackaged) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (!win) return;

        const isSilentSecond = commandLine.includes('--silent');

        if (win.isMinimized()) win.restore();
        
        if (!isSilentSecond) {
            win.show();
        } else {
            win.hide();
        }
    });
    app.whenReady().then(async () => {
        app.whenReady().then(() => {
            protocol.handle('documents', async (req) => {
                try {
                const url = new URL(req.url);
                let file = decodeURIComponent(url.hostname + url.pathname);

                if (file.endsWith('/')) file = file.slice(0, -1);
                const [first, ...rest] = file.split('/');
                file = [ROOT_MAP[first.toLowerCase()] ?? first, ...rest].join('/');

                const fullPath = path.join(DOCUMENTS, file);
                if (!fullPath.startsWith(path.join(DOCUMENTS, path.sep))) return new Response('Forbidden', { status: 403 });
                if (req.method === 'PUT') {
                    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
                    const tmp = fullPath + '.part';
                    await fs.promises.writeFile(tmp, Buffer.from(await req.arrayBuffer()));
                    await fs.promises.rename(tmp, fullPath);
                    return new Response(null, { status: 201 });
                }
                if (req.method === 'DELETE') {
                    await fs.promises.rm(fullPath, { force: true });
                    return new Response(null, { status: 204 });
                }
                if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

                const stat = await fs.promises.stat(fullPath).catch(() => null);
                if (!stat || !stat.isFile()) return new Response('Not found', { status: 404 });

                const contentType = MIME[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
                const range = req.headers.get('range');

                if (req.method === 'HEAD') {
                    return new Response(null, {
                        status: 200,
                        headers: {
                            'Content-Type': contentType,
                            'Content-Length': String(stat.size),
                            'Accept-Ranges': 'bytes',
                        },
                    });
                }
                if (!range) {
                    return new Response(fs.createReadStream(fullPath), {
                        status: 200,
                        headers: {
                            'Content-Type': contentType,
                            'Content-Length': String(stat.size),
                            'Accept-Ranges': 'bytes',
                        },
                    });
                }

                const match = /bytes=(\d*)-(\d*)/.exec(range);
                let start = match && match[1] !== '' ? Number(match[1]) : 0;
                let end = match && match[2] !== '' ? Number(match[2]) : stat.size - 1;
                end = Math.min(end, stat.size - 1);

                if (start > end || start >= stat.size) {
                    return new Response(null, {
                        status: 416,
                        headers: { 'Content-Range': `bytes */${stat.size}` },
                    });
                }

                return new Response(fs.createReadStream(fullPath, { start, end }), {
                    status: 206,
                    headers: {
                        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': String(end - start + 1),
                        'Content-Type': contentType,
                    },
                });
                } catch (e) {
                    console.error('documents protocol error:', e);
                    return new Response(e.message, { status: 500 });
                }
            });
        });

        startFolders();
        preloadAll();
        createWindow();

        const configs = getConfig();
        manageStartup(configs.open_on_startup);

        win.once('ready-to-show', async () => {
            makeTray();
            if (configs.maximize_on_start) { win.maximize() }
            if (!isSilent) {
                setTimeout(() => win.show(), 2500);
            } else {win.hide()}

            if (app.isPackaged) { autoUpdater.checkForUpdates() }

            if (!configs.welcomed) { win.loadFile(path.join(BUNDLE, 'pages', 'welcome.html'));
            } else { win.loadFile(path.join(BUNDLE, 'pages', 'shell.html')) }
        });

        win.on('maximize', () => { win.webContents.send('window-state-change', 'maximized') });
        win.on('unmaximize', () => { win.webContents.send('window-state-change', 'normal') });
        win.on('close', (event) => {
            const config = getConfig();
            if (!isQuitting && config.minimize_to_tray && win !== null) {
                event.preventDefault();
                win.hide();
            }
        });
    });
}

/////////////
// UPDATES //
/////////////
autoUpdater.on('checking-for-update', () => { win?.webContents.send('update-status', 'Verificando atualizações...') });
autoUpdater.on('update-available', (info) => { win?.webContents.send('update-status', 'Atualização disponível!') });
autoUpdater.on('download-progress', (progressObj) => { win?.webContents.send('update-progress', progressObj.percent) });
autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    if (win && !win.isDestroyed()) {
      win?.webContents.send('update-ready-to-install');
    }

    const { Notification } = require('electron');
    new Notification({
        title: 'Atualização baixada!',
        body: `Versão: ${info.version}`,
        icon: path.join(__dirname, 'tray-icon.png')
    }).show();
});
ipcMain.handle('update:check-status', () => { return updateReady });
ipcMain.on('update:restart', () => { autoUpdater.quitAndInstall() });
autoUpdater.on('error', (err) => {
    console.error('AutoUpdater - Erro:', err.message);
    win?.webContents.send('update-status', 'Erro na atualização: ' + err.message);
});
ipcMain.handle('updates:check-update', async () => {
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    const currentVersion = app.getVersion();
    const latestVersion = result?.updateInfo?.version;

    if (latestVersion && latestVersion !== currentVersion) {
      return {
        status: 'available',
        version: latestVersion
      };
    }

    return {
      status: 'up-to-date'
    };
  } catch (error) {
    console.error(error);
    return {
      status: 'error'
    };
  }
});

////////////////////
// MENU FUNCTIONS //
////////////////////
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
ipcMain.on('menu:is-maximized-sync', (event) => {
    event.returnValue = win ? win.isMaximized() : false;
});

/////////////////////
// BASIC FUNCTIONS //
/////////////////////
ipcMain.on('devTools', () => {
    if (!app.isPackaged && win && !win.isDestroyed()) { win.webContents.toggleDevTools() }
});
ipcMain.handle('i18n:get', () => {
    const config = getConfig();
    const locale = config.language || 'en';
    const localePath = path.join(BUNDLE, 'locales', `${locale}.json`);
    if (!fs.existsSync(localePath)) return {};
    return JSON.parse(fs.readFileSync(localePath, 'utf-8'));
});
ipcMain.handle('open-external-link', async (event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
});
ipcMain.handle('app-version', () => { return app.getVersion() });

//////////////////////
// CONFIG FUNCTIONS //
//////////////////////
ipcMain.handle('config:get', () => { return getConfig() });
ipcMain.on('config:update', (event, { key, value }) => {
    const configFile = path.join(app.getPath('userData'),'config.json');
    const config = getConfig();

    config[key] = value;

    try {
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`Config - value of "${key}" changed to: ${value}`);

        if (key === 'open_on_startup') manageStartup(value);
    } catch (erro) { console.error("Erro ao salvar config.json:", erro) }
});

function manageStartup(openOSstart) {
    if (!app.isPackaged) return; 

    const osType = process.platform;

    if (osType === 'win32') {
        app.setLoginItemSettings({
            openAtLogin: openOSstart,
            path: app.getPath('exe')
        });
    }
  
    else if (osType === 'linux') {
        const homeDir = os.homedir();
        const autostartDir = path.join(homeDir, '.config', 'autostart');
        const autostartPath = path.join(autostartDir, 'boltnotes.desktop');

        if (openOSstart) {
            if (!fs.existsSync(autostartDir)) {
                fs.mkdirSync(autostartDir, { recursive: true });
            }

            const isPackaged = app.isPackaged;
            const iconPath = isPackaged
                ? path.join(process.resourcesPath, 'app-icon.png')
                : path.join('build', 'icon.png');
            const execPath = process.env.APPIMAGE || app.getPath('exe');

            const desktopEntry = `[Desktop Entry]
Type=Application
Name=BoltNotes
Comment=Notes, Games Backlog and Fortnite Season Reviews
Comment[en]=Notes, Games Backlog and Fortnite Season Reviews
Comment[pt_BR]=Notas, Backlog de Jogos e Reviews de Temporada do Fortnite
Exec="${execPath}"
Icon=${iconPath}
Terminal=false
X-GNOME-Autostart-enabled=true
Categories=Utility;Game;
`;
            try { fs.writeFileSync(autostartPath, desktopEntry, 'utf-8');
            } catch (err) { console.error("manageStartup error:", err) }
        }
        else {
            if (fs.existsSync(autostartPath)) {
                try { fs.unlinkSync(autostartPath);
                } catch (err) { console.error("manageStartup error:", err) }
            }
        }
    }
}

function makeTray() {
    if (tray) return;
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'tray-icon.png')
        : path.join('build', 'tray-icon.png');

    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
    // trayNameIcon = nativeImage.createFromPath(iconPath).resize({ width: 14, height: 14 });

    tray = new Tray(trayIcon);
    if (app.isPackaged) { const name = 'BoltNotes';
        tray.setToolTip(name);
    } else { const name = 'BoltNotes (Dev)';
        tray.setToolTip(name) }

    tray.setContextMenu(
        Menu.buildFromTemplate([
            // {
            //   label: 'BoltNotes',
            //   icon: trayNameIcon,
            //   enabled: false,
            // },
            // { type: 'separator' },
            {
                label: 'Quit BoltNotes',
                click: () => {
                    isQuitting = true;
                    app.quit();
                },
            },
        ])
    );
    tray.on('click', () => {
        if (win) {
            win.show();
            win.focus();
        }
    });
}

////////////
// THEMES //
////////////
const THEMES_DIR = path.join(BUNDLE, 'themes');
const USER_THEMES_DIR = path.join(DOCUMENTS, 'Themes');
function ensureThemesFolder() {
    fs.mkdirSync(USER_THEMES_DIR, { recursive: true });

    fs.readdirSync(THEMES_DIR)
        .filter(f => f.endsWith('.boltss'))
        .forEach(file =>
            fs.copyFileSync(path.join(THEMES_DIR, file), path.join(USER_THEMES_DIR, file))
        );

    const names = fs.readdirSync(USER_THEMES_DIR)
        .filter(f => f.endsWith('.boltss'))
        .map(f => f.slice(0, -'.boltss'.length));

    fs.writeFileSync(path.join(USER_THEMES_DIR, '.ThemeList'), names.join('\n'));
}
ensureThemesFolder();

///////////
// GAMES //
///////////
ipcMain.handle('games:get-steam-data', async (_, appid) => {
    const id = String(appid ?? '').trim();
    if (!id) return null;

    try {
        const res = await net.fetch(
            `https://store.steampowered.com/api/appdetails?appids=${id}&cc=br&l=pt`
        );
        if (!res.ok) return null;

        const json = await res.json();
        if (!json?.[id]?.success) return null;

        const d = json[id].data;

        let releaseDate = d.release_date?.date ?? '';
        const parsed = new Date(releaseDate);
        if (!isNaN(parsed.getTime())) releaseDate = parsed.toLocaleDateString('pt-BR');

        const totalAchievements = Number(d.achievements?.total) || 0;

        return {
            releaseDate,
            developer: (d.developers ?? []).join(', '),
            publisher: (d.publishers ?? []).join(', '),
            hasAchievements: totalAchievements > 0,
            totalAchievements,
        };
    } catch (e) {
        console.error('Erro ao buscar dados da Steam para o appid', appid, e);
        return null;
    }
});