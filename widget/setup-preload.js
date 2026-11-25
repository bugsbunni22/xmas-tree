const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tree", { save: (url) => ipcRenderer.invoke("setup:save", url) });
