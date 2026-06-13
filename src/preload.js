const {contextBridge,ipcRenderer} = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  try {
    const isMaximized = ipcRenderer.sendSync('menu:is-maximized-sync');
    
    if (isMaximized) {
      document.documentElement.classList.remove('window-normal');
      window.sessionStorage.setItem('windowState', 'maximized');
    } else {
      document.documentElement.classList.add('window-normal');
      window.sessionStorage.setItem('windowState', 'normal');
    }
  } catch (err) {
    document.documentElement.classList.add('window-normal');
    window.sessionStorage.setItem('windowState', 'normal');
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-change', (event, state) => callback(state)),
  exists: (filePath) => ipcRenderer.invoke('exists',filePath),
  devTools: () => ipcRenderer.send('devTools'),

  menu: { maximizeApp: () => ipcRenderer.send('menu:maximize-app'),
    minimizeApp: () => ipcRenderer.send('menu:minimize-app'),
    closeApp: () => ipcRenderer.send('menu:close-app'),
    isMaximized: () => ipcRenderer.invoke('menu:is-maximized')},

  json: { load: (filePath) => ipcRenderer.invoke('json:load',filePath),
    save: (filePath,data) => ipcRenderer.invoke('json:save',{filePath,data}) },

  config: { getConfig: () => ipcRenderer.invoke('config:get'),
    updateConfig: (key,value) => ipcRenderer.send('config:update',{key,value}) },

  notes: {
    rename: (oldName, newName) => ipcRenderer.invoke('notes:rename', oldName, newName)
  },

  checkAssetsStatus: () => ipcRenderer.invoke('assets-check-status'),
  onAssetsProgress: (callback) => {
    ipcRenderer.on('assets-progress', (_, data) => callback(data));
  },
  onAssetsReady: (callback) => {
    ipcRenderer.on('assets-ready', () => callback());
  },
  onAssetsError: (callback) => {
    ipcRenderer.on('assets-error', (_, msg) => callback(msg));
  },

  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, msg) => callback(msg)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),

  onUpdateReady: (callback) => ipcRenderer.on('update-ready-to-install', callback),
  restartAndInstall: () => ipcRenderer.send('update:restart'),
  checkUpdateStatus: () => ipcRenderer.invoke('update:check-status')
});
contextBridge.exposeInMainWorld('api', {
  load: (path) => ipcRenderer.invoke('load',path),

  notes: { create: (name) => ipcRenderer.invoke('notes:create',name),
    delete: (name) => ipcRenderer.invoke('notes:delete',name),
    save: (name,content) => ipcRenderer.invoke('notes:save',name,content),
    count: () => ipcRenderer.invoke('notes:count') },
  
  games: { add: (game) => ipcRenderer.invoke('games:add',game),
    ensureCover: (data) => ipcRenderer.invoke('games:ensure-cover',data) },

  openLink: (url) => ipcRenderer.invoke('open-external-link', url),
  getAppVersion: () => ipcRenderer.invoke('app-version'),

  fortnite: { getTrailers: () => ipcRenderer.invoke('fortnite:fetch-trailers'),
    getSeasons: () => ipcRenderer.invoke('fortnite:fetch-seasons'),
    getGamesDB: () => ipcRenderer.invoke('games:fetch-gamesdb'),
    listTrailers: () => ipcRenderer.invoke('fortnite:list-trailers') },

  addGameToGist: (gameData) => ipcRenderer.invoke('add-game-to-gist', gameData),
  restartApp: () => ipcRenderer.send('update:restart')
});

contextBridge.exposeInMainWorld('info', {
  getUserData: () => ipcRenderer.invoke('info:user-data'),
  getDocuments: () => ipcRenderer.invoke('info:documents')
});