if (require('electron-squirrel-startup')){
    return;
}

const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
const electron = require('electron');
const ipcMain = electron.ipcMain;
const app = electron.app;
const autoUpdater = electron.autoUpdater;
const Menu = electron.Menu;
const Tray = electron.Tray;
const BrowserWindow = electron.BrowserWindow;

const peer = require('./peer');
const time = require('./time');

const iconICOPath = path.resolve(__dirname, 'icon.ico');
const iconPNGPath = path.resolve(__dirname, 'icon.png');// for displayBalloon

let mainWindow, tray = null;
let updateWindow = null, settingsWindow = null;

// console to log file
var logFile = fs.createWriteStream('log.txt', { flags: 'a' });// 'w' to truncate the file every time the process starts. 'a' is append
var logStdout = process.stdout;

console.log = function () {
    logFile.write(util.format.apply(null, arguments) + '\n');
    logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = console.log;

function handleSquirrelEvent() {
    if (process.argv.length === 1) {
        return false;
    }

    const ChildProcess = require('child_process');
    const path = require('path');

    const appFolder = path.resolve(process.execPath, '..');
    const rootAtomFolder = path.resolve(appFolder, '..');
    const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
    const exeName = path.basename(process.execPath);

    const spawn = function(command, args) {
        let spawnedProcess, error;

        try {
            spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
        }
        catch (error) {}

        return spawnedProcess;
    };

    const spawnUpdate = function(args) {
        return spawn(updateDotExe, args);
    };

    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
        // Optionally do things such as:
        // - Add your .exe to the PATH
        // - Write to the registry for things like file associations and
        //   explorer context menus

        // Install desktop and start menu shortcuts
        spawnUpdate(['--createShortcut', exeName]);

        setTimeout(app.quit, 1000);
        return true;
    case '--squirrel-uninstall':
        // Undo anything you did in the --squirrel-install and
        // --squirrel-updated handlers

        // Remove desktop and start menu shortcuts
        spawnUpdate(['--removeShortcut', exeName]);

        setTimeout(app.quit, 1000);
        return true;
    case '--squirrel-obsolete':
        // This is called on the outgoing version of your app before
        // we update to the new version - it's the opposite of
        // --squirrel-updated

        app.quit();
        return true;
    }
}

if (handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

// Single instance
const shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory){
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
})

if (shouldQuit) {
    app.quit();
}

var disableHardwareAcceleration = true;
for(let key in process.argv){
    if(process.argv[key] == "--enableHardwareAcceleration"){
        disableHardwareAcceleration = false;
        break;
    }
}

if(disableHardwareAcceleration == true){
    app.disableHardwareAcceleration();
}

function createFeedURL(){
    var randomKey = function(length, chars){
        chars = chars || "ABCDEFGHIJKLMNOPQRSTUVWXTZ0123456789";
        var randomString = "";
        for (var i = 0; i < length; i++) {
            randomString += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return randomString;
    };

    return "http://eew.earthquake.tw/_" + randomKey(10) + "/releases/win32/latest";
}

function createWindow () {
    mainWindow = new BrowserWindow({
        width: 908,
        height: 746,//746
        resizable: false,
        frame: false,
        title: "地牛Wake Up!",
        icon: iconICOPath,
        thickFrame: false,
        show: false
    })
    mainWindow.loadURL('file://' + __dirname + '/app/index.htm');

    if(devMode == true){
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function () {
        app.quit();
    });

    mainWindow.once('ready-to-show', function () {
        for(var key in process.argv){
            if(process.argv[key] == "--hidden"){
                return;
            }
        }
        mainWindow.show();
        /*
        setTimeout(function(){
            mainWindow.show();
        }, 0);
        */
    });

    tray = new Tray(iconICOPath);
    tray.setToolTip('地牛Wake Up!');
    tray.setContextMenu(Menu.buildFromTemplate([{
        label: '設定',
        click: function(){
            createSettingsWindow();
        }
    }, {
        label: '結束',
        click: function(){
            app.quit();
        }
    }]));
    tray.on("double-click", function(event, bounds){
        mainWindow.show();
    });
}

function createSettingsWindow() {
    try{
        settingsWindow.show();
    }
    catch(error){
        settingsWindow = new BrowserWindow({
            width: 388,
            height: 511,
            resizable: false,
            frame: false,
            title: "設定",
            icon: iconICOPath,
            thickFrame: false,
            show: false
        })

        settingsWindow.loadURL('file://' + __dirname + '/app/settings.htm');

        if(devMode == true){
            settingsWindow.webContents.openDevTools();
        }

        settingsWindow.once('ready-to-show', function () {
            settingsWindow.show();
        });
    }
}

function createUpdateWindow() {
    try{
        updateWindow.show();
    }
    catch(error){
        updateWindow = new BrowserWindow({
            width: 408,
            height: 206,
            resizable: false,
            frame: false,
            title: "更新",
            icon: iconICOPath,
            thickFrame: false,
            show: false
        })

        updateWindow.loadURL('file://' + __dirname + '/app/update.htm');

        updateWindow.once('ready-to-show', function () {
            updateWindow.show();
        });
    }
}

app.on('ready', function(){
    autoUpdater.on('update-downloaded', function() {
        mainWindow.webContents.send("update-downloaded");

        tray.displayBalloon({
            icon: iconPNGPath,
            title: "地牛Wake Up!",
            content: "已經有新版的程式可供更新。"
        });
    }).on("error", function(error){});

    createWindow();

    try {
        autoUpdater.setFeedURL(createFeedURL());
        autoUpdater.checkForUpdates();
    }
    catch (error) {}

    setInterval(function(){
        try {
            autoUpdater.setFeedURL(createFeedURL());
            autoUpdater.checkForUpdates();
        }
        catch (error) {}
    }, 43200 * 1000);
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('browser-window-focus', function (event, window){
    //event.sender.send('focus', 'focus');
    window.send('focus', 'focus');
});

app.on('browser-window-blur', function (event, window){
    //event.sender.send('blur', 'blur');
    window.send('blur', 'blur');
});

// Load setting object to global
var settingsFile = path.join(app.getPath('userData'), 'settings.json');
if (fs.existsSync(settingsFile)) {
    global.settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
}

// Default settings
var extend = util._extend;
global.settings = extend({
    "townID": 6300200,
    "alertIntensity": 3,
    "autorun": true,
    "showPWave": true,
    "applySiteEffect": true,
    "portAuto": true
}, global.settings);

// Auto launch
var setAutoLaunch = function(){
    var AutoLaunch = require('auto-launch');
    var appLauncher = new AutoLaunch({
        name: '地牛Wake Up!',
        isHidden: true
    });

    if(global.settings.autorun != appLauncher.isEnabled()){
        if(global.settings.autorun == true){
            appLauncher.enable();
        }
        else{
            appLauncher.disable();
        }
    }
};

var devMode = false;
for(let key in process.argv){
    if(process.argv[key] == "--dev"){
        devMode = true;
        break;
    }
}

if(devMode == false){
    setAutoLaunch();
}

// Start SNTP time sync
global.now = time.now;
time.start(function(error){
    if (error){
        console.log("# sync time failed. Retry 10 seconds later...");
    }
    else{
        console.log("# sync time OK.");
    }
});

// Start connection when UI is ok
global.peerInstance = null;

var startConnection = function(){
    console.log("# start connection.");

    if(global.peerInstance != null){
        global.peerInstance.stopAllThread();
        global.peerInstance.getUdpSocket().close();
        global.peerInstance = null;
    }

    setTimeout(function(){
        global.peerInstance = peer.create({
            portNumber: global.settings.portAuto == true ? 0 : global.settings.portNumber,
            outgoingAmount: 10,
            incomingAmount: 15,
            getWarning: function(message){
                mainWindow.webContents.send("get-warning", message);
            },
            connectionStatusChanged: function(port, server, peer){
                mainWindow.webContents.send("connection-status-changed", port, server, peer);
            }
        });
    }, 3000);

    mainWindow.webContents.send("connection-started");
};

ipcMain.on('ready', function (event){
    startConnection();
});

ipcMain.on('create-update-window', function (event){
    createUpdateWindow();
});

ipcMain.on('update-app', function (event){
    autoUpdater.quitAndInstall();
});

ipcMain.on('create-settings-window', function (event){
    createSettingsWindow();
});

ipcMain.on('settings-changed', function (event, reconnect){
    if(devMode == false){
        setAutoLaunch();
    }

    if(reconnect == true){
        startConnection();
    }

    mainWindow.webContents.send("settings-changed");
});
