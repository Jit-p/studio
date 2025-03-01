import { ipcRenderer } from "electron";
import React from "react";
import {
    observable,
    computed,
    runInAction,
    action,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { _keys } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    showGenericDialog,
    FieldComponent
} from "eez-studio-ui/generic-dialog";
import { Tree } from "eez-studio-ui/tree";

import { Button } from "eez-studio-ui/button";

import {
    EezObject,
    PropertyProps,
    getProperty
} from "project-editor/core/object";
import { getObjectFromPath, getProjectStore } from "project-editor/store";

import { usage, SearchCallbackMessage } from "project-editor/core/search";
import type { ImportDirective } from "project-editor/project/project";

export const ImportDirectiveCustomUI = observer((props: PropertyProps) => {
    return (
        <div className="EezStudio_ImportDirectiveCustomUIContainer">
            <Button
                color="primary"
                size="small"
                onClick={() => showUsage(props.objects[0] as ImportDirective)}
            >
                Usage
            </Button>

            <Button
                color="primary"
                size="small"
                onClick={() => openProject(props.objects[0] as ImportDirective)}
            >
                Open
            </Button>
        </div>
    );
});

class UsageTreeNode {
    id: string;
    label: string;
    children: UsageTreeNode[];
    selected: boolean;
    expanded: boolean;

    constructor(label: string, children?: (string | UsageTreeNode)[]) {
        makeObservable(this, {
            selected: observable,
            expanded: observable
        });

        this.id = label;
        this.label = label;
        this.children = children
            ? children.map(child =>
                  typeof child == "string"
                      ? new UsageTreeNode(child, [])
                      : child
              )
            : [];
        this.selected = false;
        this.expanded = children ? children.length > 0 : false;
    }
}

interface IAssetsUsage {
    assets: {
        [path: string]: string;
    };
    selectedAsset: string | undefined;
}

const UsageTreeField = observer(
    class UsageTreeField extends FieldComponent {
        selectedNode: UsageTreeNode | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedNode: observable,
                rootNode: computed
            });
        }

        get rootNode() {
            let assetsUsage: IAssetsUsage =
                this.props.values[this.props.fieldProperties.name];
            return new UsageTreeNode(
                "",
                _keys(assetsUsage.assets)
                    .sort()
                    .map(key => {
                        return new UsageTreeNode(
                            humanize(key),
                            assetsUsage.assets[key].split(", ")
                        );
                    })
            );
        }

        selectNode = action((node: UsageTreeNode) => {
            if (this.selectedNode) {
                this.selectedNode.selected = false;
            }

            this.selectedNode = node;

            let assetsUsage: IAssetsUsage =
                this.props.values[this.props.fieldProperties.name];
            if (this.selectedNode && this.selectedNode.children.length === 0) {
                assetsUsage.selectedAsset = this.selectedNode.id;
            } else {
                assetsUsage.selectedAsset = undefined;
            }

            if (this.selectedNode) {
                this.selectedNode.selected = true;
            }
        });

        render() {
            return (
                <Tree
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                />
            );
        }
    }
);

class BuildAssetsUssage {
    assets: {
        [path: string]: Set<string>;
    } = {};

    assetsUsage: IAssetsUsage = {
        assets: {},
        selectedAsset: undefined
    };

    constructor(private importDirective: ImportDirective) {
        makeObservable(this, {
            assetsUsage: observable
        });
    }

    onMessage(message: SearchCallbackMessage) {
        if (message.type == "value") {
            const path =
                message.valueObject.propertyInfo
                    .referencedObjectCollectionPath!;

            const importedProject = this.importDirective.project!;

            const assetName = message.valueObject.value;
            if (
                !importedProject._assets.maps["name"].assetCollectionPaths.has(
                    path
                )
            ) {
                // console.log("NOT INTERESTED", path, assetName);
                return true;
            }

            const collection = getObjectFromPath(
                importedProject,
                path.split("/")
            ) as EezObject[];
            const object =
                collection &&
                collection.find(
                    object => assetName == getProperty(object, "name")
                );

            if (object) {
                // console.log("FOUND", path, assetName, object);
                const set = this.assets[path] ?? new Set<string>();
                set.add(assetName);
                this.assets[path] = set;
                runInAction(
                    () =>
                        (this.assetsUsage.assets[path] =
                            Array.from(set).join(", "))
                );
            } else {
                // console.log("NOT FOUND", path, assetName);
            }
            return true;
        } else {
            // console.log("finish");
            return true;
        }
    }
}

function showUsage(importDirective: ImportDirective) {
    const buildAssetsUsage = new BuildAssetsUssage(importDirective);

    const projectStore = getProjectStore(importDirective);

    usage(projectStore, message => buildAssetsUsage.onMessage(message));

    showGenericDialog({
        dialogDefinition: {
            title: "Imported Project Assets Usage",
            fields: [
                {
                    name: "assetsUsage",
                    fullLine: true,
                    type: UsageTreeField
                }
            ]
        },
        values: {
            assetsUsage: buildAssetsUsage.assetsUsage
        },
        okButtonText: "Search",
        okEnabled: result => {
            const assetsUsage: IAssetsUsage = result.values.assetsUsage;
            return !!assetsUsage.selectedAsset;
        }
    })
        .then(
            action(result => {
                const assetsUsage: IAssetsUsage = result.values.assetsUsage;
                if (assetsUsage.selectedAsset) {
                    projectStore.uiStateStore.searchPattern =
                        assetsUsage.selectedAsset;
                    projectStore.uiStateStore.searchMatchCase = true;
                    projectStore.uiStateStore.searchMatchWholeWord = true;
                    projectStore.uiStateStore.replaceEnabled = false;
                    projectStore.startSearch();
                }
            })
        )
        .catch(() => {});
}

function openProject(importDirective: ImportDirective) {
    const projectStore = getProjectStore(importDirective);
    ipcRenderer.send(
        "open-file",
        projectStore.getAbsoluteFilePath(importDirective.projectFilePath)
    );
}
