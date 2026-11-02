import { FeatureClass } from "../feature/FeatureClass";
import { Label } from "../label/Label";
import { CanvasVectorPainter } from "../../render/canvas/CanvasVectorPainter";
import { Extent } from "../geometry/Extent";
import { Renderer } from "../style/renderer/Renderer";
import { SimpleRenderer } from "../style/renderer/SimpleRenderer";
import { Layer } from "./Layer";

/** 将 FeatureClass、渲染策略和标注策略装配为可绘制图层。 */
export class FeatureLayer extends Layer {
    public constructor(
        private _featureClass: FeatureClass,
        private _renderer: Renderer = new SimpleRenderer(_featureClass.type),
        private readonly featurePainter = new CanvasVectorPainter()
    ) {
        super();
    }

    private _label?: Label;
    public labeled = false;

    public get label(): Label { return this._label; }
    public set label(value: Label) { this._label = value; }
    public get featureClass(): FeatureClass { return this._featureClass; }
    public set featureClass(value: FeatureClass) { this._featureClass = value; }
    public get renderer(): Renderer { return this._renderer; }
    public set renderer(value: Renderer) { this._renderer = value; }
    public get extent(): Extent | null { return this._featureClass.extent; }

    public draw(ctx: CanvasRenderingContext2D, extent: Extent, zoom: number): void {
        if (!this.visible || zoom < this.minZoom || zoom > this.maxZoom) return;
        this._featureClass.query(extent).forEach(feature => {
            this.featurePainter.drawFeature(ctx, feature, this._renderer.getSymbol(feature), extent);
        });
    }

    public drawLabel(ctx: CanvasRenderingContext2D, extent: Extent, zoom: number): void {
        if (!this._label || !this.visible || zoom < this.minZoom || zoom > this.maxZoom) return;
        this._label.draw(this._featureClass.query(extent), ctx);
    }
}
