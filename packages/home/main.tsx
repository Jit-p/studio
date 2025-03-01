/// <reference path="./globals.d.ts"/>
import "bootstrap";
import { ipcRenderer } from "electron";
import { runInAction } from "mobx";
import React from "react";
import { createRoot } from "react-dom/client";
import { configure } from "mobx";
import { observer } from "mobx-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { loadExtensions } from "eez-studio-shared/extensions/extensions";
import { getNodeModuleFolders } from "eez-studio-shared/extensions/yarn";

import * as notification from "eez-studio-ui/notification";
import { showAboutBox } from "eez-studio-ui/about-box";

import type * as ImportInstrumentDefinitionModule from "instrument/import-instrument-definition";

import { handleDragAndDrop } from "home/drag-and-drop";
import { loadTabs, ProjectEditorTab, tabs } from "home/tabs-store";
import { settingsController } from "home/settings";
import { App } from "home/app";
import { openProject } from "home/open-project";

import { LineMarkers } from "project-editor/flow/connection-line/ConnectionLineComponent";

import "home/settings";
import { extensionsCatalog } from "./extensions-manager/catalog";

configure({ enforceActions: "observed" });

// make sure we store all the values waiting to be stored inside blur event handler
function blurAll() {
    var tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
}

async function beforeAppClose() {
    blurAll();

    for (const tab of tabs.tabs) {
        if (tab.beforeAppClose) {
            if (!(await tab.beforeAppClose())) {
                return false;
            }
        }
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();

    return true;
}

ipcRenderer.on("beforeClose", async () => {
    if (await beforeAppClose()) {
        ipcRenderer.send("readyToClose");
    }
});

ipcRenderer.on("reload", async () => {
    if (await beforeAppClose()) {
        ipcRenderer.send("reload");
    }
});

ipcRenderer.on("switch-theme", async () => {
    settingsController.switchTheme(!settingsController.isDarkTheme);
});

ipcRenderer.on(
    "importInstrumentDefinitionFile",
    (sender: any, filePath: string) => {
        const { importInstrumentDefinition } =
            require("instrument/import-instrument-definition") as typeof ImportInstrumentDefinitionModule;
        importInstrumentDefinition(filePath);
    }
);

ipcRenderer.on("show-about-box", async () => {
    showAboutBox();
});

ipcRenderer.on("open-project", async (sender: any, filePath: any) => {
    openProject(filePath);
});

ipcRenderer.on("load-debug-info", async (sender: any, filePath: any) => {
    try {
        let tab = tabs.activeTab;
        if (tab instanceof ProjectEditorTab) {
            tab.loadDebugInfo(filePath);
        }
    } catch (err) {
        console.error(err);
    }
});

ipcRenderer.on("save-debug-info", () => {
    try {
        let tab = tabs.activeTab;
        if (tab instanceof ProjectEditorTab) {
            tab.saveDebugInfo();
        }
    } catch (err) {
        console.error(err);
    }
});

ipcRenderer.on("new-project", async (sender: any, filePath: any) => {
    const { showNewProjectWizard } = await import(
        "project-editor/project/ui/Wizard"
    );
    showNewProjectWizard();
});

ipcRenderer.on("add-instrument", async (sender: any, filePath: any) => {
    const { showAddInstrumentDialog } = await import(
        "instrument/add-instrument-dialog"
    );

    const { selectedInstrument } = await import("home/home-tab");

    showAddInstrumentDialog(instrumentId => {
        setTimeout(() => {
            runInAction(() => selectedInstrument.set(instrumentId));
        }, 100);
    });
});

const Main = observer(
    class Main extends React.Component<{ children: React.ReactNode }> {
        render() {
            return (
                <DndProvider backend={HTML5Backend}>
                    {this.props.children}
                    {notification.container}
                </DndProvider>
            );
        }
    }
);

async function main() {
    let nodeModuleFolders: string[];
    try {
        nodeModuleFolders = await getNodeModuleFolders();
    } catch (err) {
        console.info(`Failed to get node module folders.`);
        nodeModuleFolders = [];
    }

    await loadExtensions(nodeModuleFolders);

    extensionsCatalog.load();

    loadTabs();

    const root = createRoot(document.getElementById("EezStudio_Content")!);
    root.render(
        <Main>
            <App />
            <LineMarkers />
        </Main>
    );

    handleDragAndDrop();

    ipcRenderer.send("open-command-line-project");
}

main();

//require("eez-studio-shared/module-stat");
