/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-catch */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, shell } from 'electron'
import { PowerShell } from 'node-powershell'
import path from 'node:path'
import AutoLaunch from 'auto-launch'
import fs from 'fs'


let currentPowerShellSession: PowerShell | null = null;

const autoLauncher = new AutoLaunch({
  name: 'WallSwitch',
  path: app.getPath('exe'),
  isHidden: true
});

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
let tray: Tray | null = null

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const isDevelopment = !app.isPackaged;

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    width: 400,
    height: 590,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: isDevelopment,
    },
    autoHideMenuBar: !isDevelopment,
    frame: true,
  })

  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('WallSwitch')
  tray.setContextMenu(contextMenu)

  win.on('close', (event) => {
    event.preventDefault()
    win?.hide()
  })
  tray.on('double-click', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })


  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  // Check for auto-monitor on startup
  const configPath = path.join(app.getPath('userData'), 'wallpaperEngineConfig.json');
  try {
    if (fs.existsSync(configPath)) {
      const savedConfig = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(savedConfig);

      if (config.autoMonitor && config.wallpaperEnginePath && config.trackedGames.length > 0) {
        win?.webContents.once('did-finish-load', () => {
          win?.webContents.send('auto-start-monitoring', config);
          win?.hide(); // Hide window after auto-start
        });
      }
    }
  } catch (error) {
    console.error('Error reading config for auto-monitor:', error);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

app.on('before-quit', async () => {
  if (currentPowerShellSession) {
    try {
      await currentPowerShellSession.dispose();
    } catch (error) {
      console.error('Error disposing PowerShell session on app quit:', error);
    }
  }
});

async function setAutoLaunch(enable: boolean): Promise<boolean> {
  try {
    if (enable) {
      await autoLauncher.enable();
      console.log('Auto launch enabled');
      return true;
    } else {
      await autoLauncher.disable();
      console.log('Auto launch disabled');
      return false;
    }
  } catch (error) {
    console.error('Error setting auto launch:', error);
    return false;
  }
}

ipcMain.handle('execute-powershell-script', async (_event: any, script: string) => {
  if (currentPowerShellSession) {
    await currentPowerShellSession.dispose();
  }

  const ps = new PowerShell({
    executionPolicy: 'Bypass',
    noProfile: true,
  } as any);

  currentPowerShellSession = ps;

  try {
    const output = await ps.invoke(script);
    console.log(output);
    return output;
  } catch (error) {
    console.error('PowerShell script execution error:', error);
    throw error;
  }
});

ipcMain.handle('stop-powershell-script', async () => {
  if (currentPowerShellSession) {
    try {
      await currentPowerShellSession.dispose();
      currentPowerShellSession = null;
      console.log('PowerShell session stopped');
    } catch (error) {
      console.error('Error stopping PowerShell session:', error);
    }
  }
});


// File selection dialog
ipcMain.handle('select-file', async (_event, options) => {
  console.log('MAIN PROCESS: Select file dialog options:', JSON.stringify(options));
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      ...options
    });

    console.log('MAIN PROCESS: Full dialog result:', JSON.stringify({
      canceled: result.canceled,
      filePaths: result.filePaths
    }));

    return {
      canceled: result.canceled,
      filePath: result.filePaths[0] || null
    };
  } catch (error) {
    console.error('MAIN PROCESS: File selection error:', error);
    return {
      canceled: true,
      filePath: null
    };
  }
});

ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    const base64 = icon.toDataURL();
    return base64.split(',')[1];
  } catch (error) {
    console.error('Failed to get file icon:', error);
    return null;
  }
});

ipcMain.handle('show-window', () => {
  if (win) {
    win.show()
    win.focus()
  }
})

ipcMain.handle('hide-window', () => {
  if (win) {
    win.hide()
  }
})

ipcMain.handle('open-external-link', (_event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('toggle-auto-launch', async (_event, enable: boolean) => {
  return await setAutoLaunch(enable);
});

ipcMain.handle('save-config', (_event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'wallpaperEngineConfig.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error saving configuration:', error);
    return false;
  }
});

ipcMain.handle('load-config', () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'wallpaperEngineConfig.json');
    if (fs.existsSync(configPath)) {
      const savedConfig = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(savedConfig);
    }
    return null;
  } catch (error) {
    console.error('Error loading configuration:', error);
    return null;
  }
});