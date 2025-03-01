import React from "react";
import {
    observable,
    action,
    computed,
    makeObservable,
    IReactionDisposer,
    reaction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import tinycolor from "tinycolor2";

import { objectClone } from "eez-studio-shared/util";
import { SearchInput } from "eez-studio-ui/search-input";

import {
    getClassesDerivedFrom,
    IObjectClassInfo,
    isProperSubclassOf
} from "project-editor/core/object";
import { DragAndDropManager } from "project-editor/core/dd";
import {
    createObject,
    getClass,
    NavigationStore,
    objectToClipboardData,
    setClipboardData
} from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    SubNavigation,
    SubNavigationItem
} from "project-editor/ui-components/SubNavigation";

export const ComponentsPalette = observer(
    class ComponentsPalette extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get items(): SubNavigationItem[] {
            return [
                {
                    name: NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_WIDGETS,
                    component: <ComponentsPalette1 type="widgets" />,
                    numItems: 0
                },
                {
                    name: NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_ACTIONS,
                    component: <ComponentsPalette1 type="actions" />,
                    numItems: 0
                }
            ];
        }

        render() {
            if (!this.context.projectTypeTraits.hasFlowSupport) {
                return <ComponentsPalette1 type="widgets" />;
            }

            const activeEditor = this.context.editorsStore.activeEditor;
            const showOnlyActions =
                activeEditor &&
                activeEditor.object instanceof ProjectEditor.ActionClass;

            if (showOnlyActions) {
                return <ComponentsPalette1 type="actions" />;
            }

            return (
                <SubNavigation
                    id={NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ID}
                    items={this.items}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

// Groups sort order:
//  !1 -> "Common Widgets" and odther LVGL widget groups
//  !2 -> "LVGL Actions"
//  !3 -> "Common Actions"
//  !4 -> Built-in groups
//  !5 -> "Other components"
//  !6 -> Extensions
//  !7 -> "User Widgets"
//  !8 -> "User Actions"

export const ComponentsPalette1 = observer(
    class ComponentsPalette1 extends React.Component<{
        type: "widgets" | "actions";
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        selectedComponentClass: IObjectClassInfo | undefined;

        searchText = "";

        dispose: IReactionDisposer;

        constructor(props: any) {
            super(props);

            this.readFromLocalStorage();

            makeObservable(this, {
                selectedComponentClass: observable,
                onSelect: action.bound,
                allComponentClasses: computed,
                groups: computed,
                searchText: observable,
                onSearchChange: action.bound,
                readFromLocalStorage: action
            });

            this.dispose = reaction(
                () => ({
                    searchText: this.searchText
                }),
                arg => {
                    localStorage.setItem(
                        "ComponentsPaletteSearchText_" + this.props.type,
                        arg.searchText
                    );
                }
            );
        }

        readFromLocalStorage() {
            this.searchText =
                localStorage.getItem(
                    "ComponentsPaletteSearchText_" + this.props.type
                ) || "";
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            this.dispose();
        }

        onSelect(widgetClass: IObjectClassInfo | undefined) {
            this.selectedComponentClass = widgetClass;
        }

        get allComponentClasses() {
            let baseClass;

            if (this.props.type == "actions") {
                baseClass = ProjectEditor.ActionComponentClass;
            } else {
                baseClass = ProjectEditor.WidgetClass;
            }

            const stockComponents = getClassesDerivedFrom(
                this.context,
                baseClass
            ).filter(objectClassInfo => {
                if (
                    objectClassInfo.objectClass ==
                        ProjectEditor.UserWidgetWidgetClass ||
                    objectClassInfo.objectClass ==
                        ProjectEditor.LVGLUserWidgetWidgetClass ||
                    objectClassInfo.objectClass ==
                        ProjectEditor.CallActionActionComponentClass
                ) {
                    return false;
                }

                if (
                    (this.context.projectTypeTraits.isFirmware ||
                        this.context.projectTypeTraits.isLVGL) &&
                    this.context.projectTypeTraits.hasFlowSupport
                ) {
                    return (
                        objectClassInfo.objectClass.classInfo.flowComponentId !=
                            undefined ||
                        (this.context.projectTypeTraits.isLVGL &&
                            isProperSubclassOf(
                                objectClassInfo.objectClass.classInfo,
                                ProjectEditor.WidgetClass.classInfo
                            ))
                    );
                }

                return true;
            });

            const userWidgets: IObjectClassInfo[] = [];
            if (this.props.type == "widgets") {
                for (const pageAsset of this.context.project._assets.pages) {
                    if (pageAsset.page.isUsedAsUserWidget) {
                        const widgetName = this.context.projectTypeTraits.isLVGL
                            ? "LVGLUserWidgetWidget"
                            : "UserWidgetWidget";

                        userWidgets.push({
                            id: `${widgetName}<${pageAsset.name}>`,
                            name: widgetName,
                            objectClass: this.context.projectTypeTraits.isLVGL
                                ? ProjectEditor.LVGLUserWidgetWidgetClass
                                : ProjectEditor.UserWidgetWidgetClass,
                            displayName: pageAsset.name,
                            componentPaletteGroupName: "!7User Widgets",
                            props: {
                                userWidgetPageName: pageAsset.name,
                                width: pageAsset.page.width,
                                height: pageAsset.page.height
                            }
                        });
                    }
                }

                userWidgets.sort((a, b) =>
                    a
                        .displayName!.toLowerCase()
                        .localeCompare(b.displayName!.toLowerCase())
                );
            }

            const userActions: IObjectClassInfo[] = [];
            if (this.props.type == "actions") {
                for (const actionAsset of this.context.project._assets
                    .actions) {
                    userActions.push({
                        id: `CallActionActionComponent<${actionAsset.name}>`,
                        name: "CallActionActionComponent",
                        objectClass:
                            ProjectEditor.CallActionActionComponentClass,
                        displayName: actionAsset.name,
                        componentPaletteGroupName: "!8User Actions",
                        props: {
                            action: actionAsset.name
                        }
                    });
                }
                userActions.sort((a, b) =>
                    a
                        .displayName!.toLowerCase()
                        .localeCompare(b.displayName!.toLowerCase())
                );
            }

            return [...stockComponents, ...userWidgets, ...userActions];
        }

        get groups() {
            const groups = new Map<string, IObjectClassInfo[]>();
            const searchText = this.searchText && this.searchText.toLowerCase();
            this.allComponentClasses.forEach(componentClass => {
                if (
                    searchText &&
                    componentClass.name.toLowerCase().indexOf(searchText) == -1
                ) {
                    return;
                }

                if (
                    componentClass.objectClass.classInfo
                        .enabledInComponentPalette
                ) {
                    if (
                        !componentClass.objectClass.classInfo.enabledInComponentPalette(
                            this.context.project.settings.general.projectType
                        )
                    ) {
                        return;
                    }
                }

                const parts = componentClass.name.split("/");
                let groupName;
                if (parts.length == 1) {
                    groupName =
                        componentClass.componentPaletteGroupName != undefined
                            ? componentClass.componentPaletteGroupName
                            : componentClass.objectClass.classInfo
                                  .componentPaletteGroupName;
                    if (groupName) {
                        if (!groupName.startsWith("!")) {
                            groupName = "!4" + groupName;
                        }
                    } else {
                        if (componentClass.name.endsWith("Widget")) {
                            groupName = "!1Basic";
                        } else if (
                            componentClass.name.endsWith("ActionComponent")
                        ) {
                            groupName = "!3Basic";
                        } else {
                            groupName = "!5Other components";
                        }
                    }
                } else if (parts.length == 2) {
                    groupName = "!6" + parts[0];
                }

                if (groupName) {
                    let componentClasses = groups.get(groupName);
                    if (!componentClasses) {
                        componentClasses = [];
                        groups.set(groupName, componentClasses);
                    }
                    componentClasses.push(componentClass);
                }
            });
            return groups;
        }

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();
        }

        render() {
            return (
                <div
                    className="EezStudio_ComponentsPalette_Enclosure"
                    onContextMenu={e => e.preventDefault()}
                >
                    <div className="EezStudio_Title">
                        <SearchInput
                            key="search-input"
                            searchText={this.searchText}
                            onClear={action(() => {
                                this.searchText = "";
                            })}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </div>

                    <div className="EezStudio_ComponentsPalette" tabIndex={0}>
                        {[...this.groups.entries()].sort().map(entry => (
                            <PaletteGroup
                                key={entry[0]}
                                name={entry[0]}
                                componentClasses={entry[1]}
                                selectedComponentClass={
                                    this.selectedComponentClass
                                }
                                onSelect={this.onSelect}
                            ></PaletteGroup>
                        ))}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class PaletteGroup extends React.Component<{
    name: string;
    componentClasses: IObjectClassInfo[];
    selectedComponentClass: IObjectClassInfo | undefined;
    onSelect: (componentClass: IObjectClassInfo | undefined) => void;
}> {
    render() {
        let name = this.props.name;
        if (name.startsWith("!")) {
            name = name.substring(2);
        }
        const target = `eez-component-palette-group-${name
            .replace(/(^-\d-|^\d|^-\d|^--)/, "a$1")
            .replace(/[\W]/g, "-")}`;
        return (
            <div className="eez-component-palette-group">
                <div className="eez-component-palette-header">{name}</div>
                <div id={target}>
                    <div className="eez-component-palette-body">
                        {this.props.componentClasses.map(componentClass => {
                            return (
                                <PaletteItem
                                    key={componentClass.id}
                                    componentClass={componentClass}
                                    onSelect={this.props.onSelect}
                                    selected={
                                        componentClass ===
                                        this.props.selectedComponentClass
                                    }
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getComponentName(componentClassName: string) {
    const parts = componentClassName.split("/");
    let name;
    if (parts.length == 2) {
        name = parts[1];
    } else {
        name = componentClassName;
    }

    if (name.startsWith("LVGL") && !name.endsWith("ActionComponent")) {
        name = name.substring("LVGL".length);
    }

    if (name.endsWith("EmbeddedWidget")) {
        name = name.substring(0, name.length - "EmbeddedWidget".length);
    } else if (name.endsWith("Widget")) {
        name = name.substring(0, name.length - "Widget".length);
    } else if (name.endsWith("ActionComponent")) {
        name = name.substring(0, name.length - "ActionComponent".length);
    }

    return name;
}

const PaletteItem = observer(
    class PaletteItem extends React.Component<{
        componentClass: IObjectClassInfo;
        selected: boolean;
        onSelect: (componentClass: IObjectClassInfo | undefined) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: {
            componentClass: IObjectClassInfo;
            selected: boolean;
            onSelect: (componentClass: IObjectClassInfo | undefined) => void;
        }) {
            super(props);

            makeObservable(this, {
                onDragStart: action.bound,
                onDragEnd: action.bound
            });
        }

        onDragStart(event: React.DragEvent<HTMLDivElement>) {
            event.stopPropagation();

            let protoObject = new this.props.componentClass.objectClass();

            const componentClass = getClass(protoObject);

            let defaultValue: Partial<Component> = {};

            if (componentClass.classInfo.defaultValue) {
                Object.assign(
                    defaultValue,
                    objectClone(componentClass.classInfo.defaultValue)
                );
            }

            if (componentClass.classInfo.componentDefaultValue) {
                Object.assign(
                    defaultValue,
                    objectClone(
                        componentClass.classInfo.componentDefaultValue(
                            this.context
                        )
                    )
                );
            }

            defaultValue.type = this.props.componentClass.name;

            Object.assign(defaultValue, this.props.componentClass.props);

            let object = createObject<Component>(
                this.context,
                defaultValue,
                this.props.componentClass.objectClass
            );

            if (object.left == undefined) {
                object.left = 0;
            }
            if (object.top == undefined) {
                object.top = 0;
            }
            if (object.width == undefined) {
                object.width = 0;
            }
            if (object.height == undefined) {
                object.height = 0;
            }

            setClipboardData(
                event,
                objectToClipboardData(this.context, object)
            );

            event.dataTransfer.effectAllowed = "copy";

            event.dataTransfer.setDragImage(
                DragAndDropManager.blankDragImage,
                0,
                0
            );

            // postpone render, otherwise we can receive onDragEnd immediatelly
            setTimeout(() => {
                DragAndDropManager.start(event, object, this.context);
            });
        }

        onDragEnd(event: any) {
            DragAndDropManager.end(event);
        }

        render() {
            const dragObject = DragAndDropManager.dragObject;
            const dragObjectClass = dragObject && getClass(dragObject);

            let dragging;

            if (dragObject) {
                if (
                    (dragObjectClass == ProjectEditor.UserWidgetWidgetClass ||
                        dragObjectClass ==
                            ProjectEditor.LVGLUserWidgetWidgetClass) &&
                    this.props.componentClass.objectClass == dragObjectClass
                ) {
                    dragging =
                        (dragObject as any).userWidgetPageName ==
                        this.props.componentClass.props?.userWidgetPageName;
                } else if (
                    dragObjectClass ==
                        ProjectEditor.CallActionActionComponentClass &&
                    this.props.componentClass.objectClass == dragObjectClass
                ) {
                    dragging =
                        (dragObject as any).action ==
                        this.props.componentClass.props?.action;
                } else {
                    dragging =
                        dragObjectClass ===
                        this.props.componentClass.objectClass;
                }
            } else {
                dragging = false;
            }

            let className = classNames("eez-component-palette-item", {
                selected: this.props.selected,
                dragging
            });

            const classInfo = this.props.componentClass.objectClass.classInfo;
            let icon = classInfo.icon as any;
            let label = this.props.componentClass.displayName
                ? this.props.componentClass.displayName
                : classInfo.componentPaletteLabel ||
                  getComponentName(this.props.componentClass.name);

            let titleStyle: React.CSSProperties | undefined;
            if (classInfo.componentHeaderColor) {
                titleStyle = {
                    backgroundColor: classInfo.componentHeaderColor,
                    color: tinycolor
                        .mostReadable(classInfo.componentHeaderColor, [
                            "#fff",
                            "0x333"
                        ])
                        .toHexString()
                };
            }

            return (
                <div
                    className={className}
                    onClick={() =>
                        this.props.onSelect(this.props.componentClass)
                    }
                    draggable={true}
                    onDragStart={this.onDragStart}
                    onDragEnd={this.onDragEnd}
                    style={titleStyle}
                >
                    {typeof icon === "string" ? <img src={icon} /> : icon}
                    <span title={label}>{label}</span>
                </div>
            );
        }
    }
);
