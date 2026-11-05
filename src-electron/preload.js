const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
    isMaximized: () => ipcRenderer.sendSync('menu:is-maximized-sync'),
    onMaximizedChange: (callback) => ipcRenderer.on('window:maximized-changed', (_e, isMax) => callback(isMax)),
});

const isDev = process.argv.includes('--development');
contextBridge.exposeInMainWorld('electronAPI', {
    devTools: () => ipcRenderer.send('devTools'),
    isFlatpak: () => ipcRenderer.invoke('app:is-flatpak'),
    isDev: isDev,

    get_i18n: () => ipcRenderer.invoke('i18n:get'),
    openLink: (url) => ipcRenderer.invoke('open-external-link', url),
    openFile: (url) => ipcRenderer.invoke('open-file', url),
    getAppVersion: () => ipcRenderer.invoke('app-version'),

    getSteamData: (appid) => ipcRenderer.invoke('games:get-steam-data', appid),
    findCachedImage: (folder, baseName) => ipcRenderer.invoke('find-cached-image', { folder, baseName }),

    menu: {
        maximizeApp: () => ipcRenderer.send('menu:maximize-app'),
        minimizeApp: () => ipcRenderer.send('menu:minimize-app'),
        closeApp: () => ipcRenderer.send('menu:close-app')
    },

    config: {
        getConfig: () => ipcRenderer.invoke('config:get'),
        updateConfig: (key,value) => ipcRenderer.send('config:update',{key,value})
    },

    updates: {
        checkUpdates: () => ipcRenderer.invoke('updates:check-update'),
        onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, msg) => callback(msg)),
        onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),
        onUpdateReady: (callback) => ipcRenderer.on('update-ready-to-install', callback),
        restartAndInstall: () => ipcRenderer.send('update:restart'),
        checkUpdateStatus: () => ipcRenderer.invoke('update:check-status')
    }
});