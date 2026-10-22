import { Feature } from "../feature/Feature";
import { CanvasVectorPainter } from "../../render/canvas/CanvasVectorPainter";
import { Extent } from "../geometry/Extent";
import { Renderer } from "../style/renderer/Renderer";
import { TileCoordinate } from "../tile/LocalTileGrid";
import { VectorTileSource } from "../tile/vector/VectorTileSource";
import { Layer } from "./Layer";

export interface VectorTileLayerOptions {
    name: string;
    sourceLayer: string;
    source: VectorTileSource;
    renderer: Renderer;
    minZoom?: number;
    maxZoom?: number;
}

/** 按视口加载、缓存并绘制局部坐标 MVT 的图层。 */
export class VectorTileLayer extends Layer {
    private readonly sourceLayer: string;
    private readonly source: VectorTileSource;
    private readonly renderer: Renderer;
    private readonly featurePainter = new CanvasVectorPainter();

    public constructor(options: VectorTileLayerOptions) {
        super(options.name);
        this.sourceLayer = options.sourceLayer;
        this.source = options.source;
        this.renderer = options.renderer;
        this.minZoom = options.minZoom ?? options.source.grid.minZoom;
        this.maxZoom = options.maxZoom ?? options.source.grid.maxZoom;
    }

    public get extent(): Extent { return this.source.grid.extent; }

    public draw(ctx: CanvasRenderingContext2D, viewExtent: Extent): void {
        if (!this.visible) return;
        const tileZoom = this.source.grid.zoomForScale(ctx.getTransform().a);
        if (tileZoom < this.minZoom || tileZoom > this.maxZoom) return;

        for (const tile of this.source.grid.tilesForExtent(viewExtent, tileZoom)) {
            const decoded = this.source.getCached(tile);
            if (decoded !== undefined) {
                this.drawTile(ctx, viewExtent, tile, decoded.get(this.sourceLayer) ?? []);
            } else {
                const task = this.source.load(tile);
                if (task) void task
                    .then((): void => this.requestRender())
                    .catch((): void => undefined);
            }
        }
    }

    public clearCache(): void { this.source.clearCache(); }

    private drawTile(
        ctx: CanvasRenderingContext2D,
        viewExtent: Extent,
        tile: TileCoordinate,
        features: Feature[]
    ): void {
        const bounds = this.source.grid.tileExtent(tile);
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.xmin, bounds.ymin, bounds.xmax - bounds.xmin, bounds.ymax - bounds.ymin);
        ctx.clip();
        features.forEach(feature => {
            this.featurePainter.drawFeature(ctx, feature, this.renderer.getSymbol(feature), viewExtent);
        });
        ctx.restore();
    }
}
