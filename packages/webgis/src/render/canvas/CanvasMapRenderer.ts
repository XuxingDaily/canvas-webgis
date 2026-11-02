import { FeatureLayer } from "../../core/layer/FeatureLayer";
import { Layer } from "../../core/layer/Layer";
import { Extent } from "../../core/geometry/Extent";

/** 一帧地图的 Canvas 合成器：清屏、应用视图矩阵并调度图层。 */
export class CanvasMapRenderer {
    public constructor(private context: CanvasRenderingContext2D) {}

    public setContext(context: CanvasRenderingContext2D): void { this.context = context; }

    public clear(): void {
        const ctx = this.context;
        ctx.resetTransform();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    public render(layers: readonly Layer[], transform: DOMMatrix, viewExtent: Extent, zoom: number): void {
        const ctx = this.context;
        this.clear();
        ctx.setTransform(transform);
        layers.forEach(layer => layer.draw(ctx, viewExtent, zoom));
        layers
            .filter((layer): layer is FeatureLayer => layer instanceof FeatureLayer && layer.labeled)
            .forEach(layer => layer.drawLabel(ctx, viewExtent, zoom));
    }
}
