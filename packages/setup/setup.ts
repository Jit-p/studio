import fs from "fs";
import path from "path";
import { BrowserWindow, ipcMain, WebContents } from "electron";

import type * as ExtensionsModule from "eez-studio-shared/extensions/extensions";
import { IExtension } from "eez-studio-shared/extensions/extension";

import { delay } from "eez-studio-shared/util";
import {
    isDev,
    getUserDataPath,
    makeFolder
} from "eez-studio-shared/util-electron";
import { EXTENSIONS_FOLDER_NAME } from "eez-studio-shared/conf";

async function setupExtensions(
    webContents: WebContents,
    resourcesPath: string,
    extensionsFolderPath: string
) {
    webContents.send("setupMessage", "Making extensions folder");
    await makeFolder(extensionsFolderPath);
    await delay(500);

    const fileList: string[] = [];

    fs.readdirSync(resourcesPath).forEach(fileName => {
        const filePath = resourcesPath + "/" + fileName;
        if (filePath.toLowerCase().endsWith(".zip")) {
            fileList.push(filePath);
        }
    });

    webContents.send(
        "setupMessage",
        `Installing ${fileList.length} extensions`
    );

    const { installExtension } =
        require("eez-studio-shared/extensions/extensions") as typeof ExtensionsModule;

    for (let i = 0; i < fileList.length; i++) {
        const filePath = fileList[i];

        const fileName = path.basename(filePath);

        webContents.send("setupMessage", `Installing extension ${fileName}`);

        try {
            const extension = await installExtension(filePath, {
                notFound() {},
                async confirmReplaceNewerVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                },
                async confirmReplaceOlderVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                },
                async confirmReplaceTheSameVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                }
            });
            if (!extension) {
                webContents.send("setupMessage", {
                    error: `Failed to install ${fileName}`
                });
                await delay(1000);
            }
        } catch (err) {
            webContents.send("setupMessage", {
                error: `Failed to install ${fileName} (${err.toString()})`
            });
            await delay(1000);
        }
    }
}

function isAnySetupRequired() {
    const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);
    if (!fs.existsSync(extensionsFolderPath)) {
        return true;
    }

    return false;
}

async function doSetup(webContents: WebContents) {
    const resourcesPath = process.resourcesPath!;

    const { loadExtensions } =
        require("eez-studio-shared/extensions/extensions") as typeof ExtensionsModule;
    loadExtensions([]);

    const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);
    if (!fs.existsSync(extensionsFolderPath)) {
        await setupExtensions(webContents, resourcesPath, extensionsFolderPath);
    }
}

export async function setup() {
    return new Promise<void>(resolve => {
        if (isDev || !isAnySetupRequired()) {
            const { loadExtensions } =
                require("eez-studio-shared/extensions/extensions") as typeof ExtensionsModule;
            loadExtensions([]);

            resolve();
            return;
        }

        let win = new BrowserWindow({
            webPreferences: {
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                nodeIntegrationInWorker: true,
                plugins: true,
                contextIsolation: false
            },
            width: 600,
            height: 200,
            backgroundColor: "#333",
            show: false
        });
        require("@electron/remote/main").enable(win.webContents);

        win.setMenu(null);
        win.loadURL(`file://${__dirname}/../setup/setup.html`);

        win.show();

        ipcMain.on("startSetup", async event => {
            await doSetup(event.sender);
            win.close();
            resolve();
        });
    });
}
