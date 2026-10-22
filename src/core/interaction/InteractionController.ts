import { View } from "../view/View";

export interface InteractionCallbacks {
    onViewChange: () => void;
    onClick: (coordinate: number[]) => void;
    onResize: () => void;
}

/** 将 DOM 输入事件转换成视图操作和地图语义事件。 */
export class InteractionController {
    public constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly view: View,
        private readonly callbacks: InteractionCallbacks
    ) {
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onDoubleClick = this.onDoubleClick.bind(this);
        this.onResize = this.onResize.bind(this);
        this.attach();
    }

    private drag = { active: false, moved: false, x: 0, y: 0 };

    public destroy(): void {
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mouseup", this.onMouseUp);
        this.canvas.removeEventListener("wheel", this.onWheel);
        this.canvas.removeEventListener("dblclick", this.onDoubleClick);
        window.removeEventListener("resize", this.onResize);
    }

    private attach(): void {
        this.canvas.addEventListener("mousedown", this.onMouseDown);
        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseup", this.onMouseUp);
        this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
        this.canvas.addEventListener("dblclick", this.onDoubleClick);
        window.addEventListener("resize", this.onResize);
    }

    private onMouseDown(event: MouseEvent): void {
        this.drag.active = true;
        this.drag.moved = false;
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.drag.active) return;
        const deltaX = event.clientX - this.drag.x;
        const deltaY = event.clientY - this.drag.y;
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) this.drag.moved = true;
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
        this.view.panBy(deltaX, deltaY);
        this.callbacks.onViewChange();
    }

    private onMouseUp(event: MouseEvent): void {
        const isClick = this.drag.active && !this.drag.moved;
        this.drag.active = false;
        if (isClick) {
            this.callbacks.onClick(this.view.toCoordinate([event.offsetX, event.offsetY]));
        }
    }

    private onWheel(event: WheelEvent): void {
        event.preventDefault();
        if (event.deltaY === 0) return;
        const deltaZoom = event.deltaY < 0 ? 1 : -1;
        if (this.view.zoomAt({ x: event.offsetX, y: event.offsetY }, deltaZoom) !== 0) {
            this.callbacks.onViewChange();
        }
    }

    private onDoubleClick(event: MouseEvent): void {
        event.preventDefault();
        if (this.view.zoomAt({ x: event.offsetX, y: event.offsetY }, 2) !== 0) {
            this.callbacks.onViewChange();
        }
    }

    private onResize(): void { this.callbacks.onResize(); }
}
