import { Extent } from "../geometry/Extent";

export interface ViewSize {
    width: number;
    height: number;
}

export interface ViewOptions {
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
}

/** 独立保存地图视图状态与坐标变换。 */
export class View {
    public constructor(options: ViewOptions = {}) {
        this._zoom = options.zoom ?? 3;
        this._minZoom = options.minZoom ?? 3;
        this._maxZoom = options.maxZoom ?? 20;
        this._zoom = this.clampZoom(this._zoom);
    }

    private _zoom: number;
    private _minZoom: number;
    private _maxZoom: number;
    private _transform = new DOMMatrix();

    public get zoom(): number { return this._zoom; }
    public get minZoom(): number { return this._minZoom; }
    public set minZoom(value: number) {
        this._minZoom = value;
        this._zoom = this.clampZoom(this._zoom);
    }
    public get maxZoom(): number { return this._maxZoom; }
    public set maxZoom(value: number) {
        this._maxZoom = value;
        this._zoom = this.clampZoom(this._zoom);
    }
    public get transform(): DOMMatrix { return this._transform; }

    /** 将指定范围适配到视口。 */
    public fit(extent: Extent, size: ViewSize, zoom: number = this._zoom): void {
        this._zoom = this.clampZoom(zoom);
        const width = extent.xmax - extent.xmin;
        const height = extent.ymax - extent.ymin;
        if (width === 0 || height === 0) return;

        const center = View.getCenter(extent);
        const a = size.height / height * extent.xscale;
        const d = size.height / height * extent.yscale;
        const e = size.width / 2 - a * center[0];
        const f = size.height / 2 - d * center[1];
        this._transform = new DOMMatrix([a, 0, 0, d, e, f]);
    }

    /** 按屏幕像素平移视图。 */
    public panBy(deltaX: number, deltaY: number): void {
        const matrix = this._transform;
        this._transform = new DOMMatrix([
            matrix.a, matrix.b, matrix.c, matrix.d,
            matrix.e + deltaX, matrix.f + deltaY
        ]);
    }

    /** 以指定屏幕点为锚点缩放，返回实际发生的层级变化。 */
    public zoomAt(screenPoint: { x: number; y: number }, deltaZoom: number): number {
        const nextZoom = this.clampZoom(this._zoom + deltaZoom);
        const appliedDelta = nextZoom - this._zoom;
        if (appliedDelta === 0) return 0;

        const scale = Math.pow(2, appliedDelta);
        const matrix = this._transform;
        this._transform = new DOMMatrix([
            matrix.a * scale,
            matrix.b,
            matrix.c,
            matrix.d * scale,
            screenPoint.x - scale * (screenPoint.x - matrix.e),
            screenPoint.y - scale * (screenPoint.y - matrix.f)
        ]);
        this._zoom = nextZoom;
        return appliedDelta;
    }

    public getExtent(size: ViewSize): Extent {
        const topLeft = this.toCoordinate([0, 0]);
        const bottomRight = this.toCoordinate([size.width, size.height]);
        return new Extent(
            Math.max(topLeft[1], bottomRight[1]),
            Math.min(topLeft[1], bottomRight[1]),
            Math.min(topLeft[0], bottomRight[0]),
            Math.max(topLeft[0], bottomRight[0])
        );
    }

    public toCoordinate(screenCoordinate: number[]): number[] {
        const matrix = this._transform;
        return [
            (screenCoordinate[0] - matrix.e) / matrix.a,
            (screenCoordinate[1] - matrix.f) / matrix.d
        ];
    }

    public toScreen(coordinate: number[]): number[] {
        const matrix = this._transform;
        return [
            matrix.a * coordinate[0] + matrix.e,
            matrix.d * coordinate[1] + matrix.f
        ];
    }

    public static getCenter(extent: Extent): number[] {
        return [(extent.xmax + extent.xmin) / 2, (extent.ymax + extent.ymin) / 2];
    }

    private clampZoom(zoom: number): number {
        return Math.max(this._minZoom, Math.min(this._maxZoom, zoom));
    }
}
