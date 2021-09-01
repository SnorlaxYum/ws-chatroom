const { app, BrowserWindow } = require('electron')
const path = require('path')
const { exec } = require('child_process')
const { get } = require('http')

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  return win
}

function sleep(t) {
  return new Promise(res => setTimeout(res, t))
}

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  })

  app.whenReady().then(async() => {
    const win = createWindow()
    let accessible = false
    exec(`yarn serve`)

    while(!accessible) {
      get('http://localhost:8080/rtc', (res) => {
        accessible = true
      }).on('error', (e) => {
        // console.error('error:', e)
        win.loadFile('loading.html')
      })
      
      await sleep(1000)
    }

    win.loadURL('http://localhost:8080/rtc')

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        win.loadURL('http://localhost:8080')
      }
    })
  })