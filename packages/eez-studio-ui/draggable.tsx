import { closestBySelector } from "eez-studio-shared/dom";

export const DRAGGABLE_OVERLAY_ELEMENT_ID = "eez-draggable-overlay-element";

////////////////////////////////////////////////////////////////////////////////

interface DraggableConfig {
    onDragStart?(e: PointerEvent, x: number, y: number): any;
    onDragMove?(e: PointerEvent, x: number, y: number, params: any): void;
    onDragEnd?(e: PointerEvent | undefined, cancel: boolean, params: any): void;
    onMove?(e: PointerEvent): void;
    onDraggableWheel?(event: WheelEvent): void;
}

export class Draggable {
    element: Element | null = null;
    overlayElement: HTMLDivElement | null = null;
    cursor: string | undefined = undefined;
    dragging: boolean = false;
    xDragStart: number = 0;
    yDragStart: number = 0;
    params: any;
    savedBodyUserSelect: string | null = null;
    capturedPointerId: number = 0;

    constructor(private config: DraggableConfig) {}

    attach(element: Element | null) {
        if (this.dragging) {
            return;
        }

        if (this.element) {
            this.finishDragging(undefined, true);
            this.element.removeEventListener("pointerdown", this.onPointerDown);
            this.element.removeEventListener("pointermove", this.onPointerMove);
        }

        this.element = element;

        if (this.element) {
            this.element.addEventListener("pointerdown", this.onPointerDown);
            this.element.addEventListener("pointermove", this.onPointerMove);
        }
    }

    onPointerDown = (e: PointerEvent) => {
        if (!this.element) {
            return;
        }

        // put in focus first parent with tabindex attribute
        const parentWithTabindex = closestBySelector(
            this.element,
            "[tabindex]"
        );
        if (parentWithTabindex) {
            parentWithTabindex.focus();
        }

        this.finishDragging(undefined, true);

        if (closestBySelector(e.target, ".eez-flow-editor-capture-pointers")) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.element.addEventListener("pointerup", this.onPointerUp);
        this.element.addEventListener("pointercancel", this.onPointerCancel);

        window.addEventListener("keydown", this.onKeyDown);

        this.overlayElement = document.createElement("div");
        this.overlayElement.id = DRAGGABLE_OVERLAY_ELEMENT_ID;
        this.overlayElement.style.position = "absolute";
        this.overlayElement.style.left = "0";
        this.overlayElement.style.top = "0";
        this.overlayElement.style.width = "100%";
        this.overlayElement.style.height = "100%";
        this.overlayElement.style.backgroundColor = "transparent";
        this.overlayElement.style.zIndex = "1000";
        this.overlayElement.style.backgroundColor = "transparent";
        this.overlayElement.style.cursor = this.cursor || "default";
        this.overlayElement.addEventListener("pointermove", e => {
            this.finishDragging(e, true);
        });
        this.overlayElement.addEventListener("wheel", this.onWheel, {
            passive: false
        });

        this.savedBodyUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";

        document.body.appendChild(this.overlayElement);

        this.capturedPointerId = e.pointerId;
        this.element.setPointerCapture(e.pointerId);

        this.dragging = true;

        this.xDragStart = e.clientX;
        this.yDragStart = e.clientY;

        if (this.config.onDragStart) {
            this.params = this.config.onDragStart(
                e,
                this.xDragStart,
                this.yDragStart
            );
        } else {
            this.params = undefined;
        }
    };

    onPointerMove = (e: PointerEvent) => {
        if (this.dragging) {
            if (this.config.onDragMove) {
                this.config.onDragMove(
                    e,
                    e.clientX - this.xDragStart,
                    e.clientY - this.yDragStart,
                    this.params
                );
            }
        } else {
            if (this.config.onMove) {
                this.config.onMove(e);
            }
        }
    };

    onPointerUp = (e: PointerEvent) => {
        this.finishDragging(e, false);
    };

    onPointerCancel = (e: PointerEvent) => {
        this.finishDragging(e, true);
    };

    onWheel = (e: WheelEvent) => {
        if (this.config.onDraggableWheel) {
            this.config.onDraggableWheel(e);
        }
    };

    onKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode == 27 /* ESC */) {
            e.preventDefault();
            e.stopPropagation();

            this.finishDragging(undefined, true);
        }
    };

    finishDragging = (e: PointerEvent | undefined, cancel: boolean) => {
        if (!this.dragging) {
            return;
        }

        if (this.config.onDragEnd) {
            try {
                this.config.onDragEnd(e, cancel, this.params);
            } catch {}
        }

        if (this.overlayElement) {
            this.overlayElement.remove();
        }

        document.body.style.userSelect = this.savedBodyUserSelect || "";

        if (this.element) {
            this.element.releasePointerCapture(this.capturedPointerId);

            this.element.removeEventListener("pointerup", this.onPointerUp);
            this.element.removeEventListener(
                "pointercancel",
                this.onPointerCancel
            );
        }

        window.removeEventListener("keydown", this.onKeyDown);

        this.dragging = false;
    };
}
