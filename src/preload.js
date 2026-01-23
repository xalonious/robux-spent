const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickCookieFile: () => ipcRenderer.invoke("pick-cookie-file"),
  validateCookie: (payload) => ipcRenderer.invoke("validate-cookie", payload),
  scanSpend: (payload) => ipcRenderer.invoke("scan-spend", payload),
  onProgress: (cb) => {
    const handler = (_evt, payload) => cb(payload);
    ipcRenderer.on("scan-progress", handler);
    return () => ipcRenderer.removeListener("scan-progress", handler);
  },
});
