const {contextBridge,ipcRenderer} = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    let isMaximized = false;
    try { isMaximized = ipcRenderer.sendSync('menu:is-maximized-sync');
    } catch {}
    document.documentElement.classList.toggle('window-maximized', !!isMaximized);
});

const isDev = process.argv.includes('--development');

contextBridge.exposeInMainWorld('electronAPI', {
    onWindowStateChange: (callback) => ipcRenderer.on('window-state-change', (event, state) => callback(state)),
    devTools: () => ipcRenderer.send('devTools'),
    isDev: isDev,

    get_i18n: () => ipcRenderer.invoke('i18n:get'),
    openLink: (url) => ipcRenderer.invoke('open-external-link', url),
    getAppVersion: () => ipcRenderer.invoke('app-version'),

    getSteamAchievements: (appid) => ipcRenderer.invoke('games:steam-achievements', appid),
    getSteamData: (appid) => ipcRenderer.invoke('games:get-steam-data', appid),

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