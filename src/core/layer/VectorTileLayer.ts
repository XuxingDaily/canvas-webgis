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

        const ready: Array<{ tile: TileCoordinate; decoded: ReturnType<VectorTileSource["getCached"]> }> = [];
        const fallback = new Map<string, { tile: TileCoordinate; decoded: NonNullable<ReturnType<VectorTileSource["getCached"]>> }>();
        const allowPolygonFallback = !["road", "boundary_outline"].includes(this.sourceLayer);

        const tiles = this.source.grid.tilesForExtent(viewExtent, tileZoom);
        this.source.retainLoading(tiles);
        for (const tile of tiles) {
            const decoded = this.source.getCached(tile);
            if (decoded !== undefined) {
                ready.push({ tile, decoded });
            } else {
                if (allowPolygonFallback) {
                    const ancestor = this.source.getCachedAncestor(tile);
                    if (ancestor) fallback.set(this.source.grid.key(ancestor.tile), ancestor);
                }
                const task = this.source.load(tile);
                if (task) void task
                    .then((): void => this.requestRender())
                    .catch((): void => undefined);
            }
        }

        // Draw each cached parent once, then replace its ready children on top.
        fallback.forEach(({ tile, decoded }) => {
            this.drawTile(ctx, viewExtent, tile, decoded.get(this.sourceLayer) ?? []);
        });
        ready.forEach(({ tile, decoded }) => {
            if (decoded) this.drawTile(ctx, viewExtent, tile, decoded.get(this.sourceLayer) ?? []);
        });
    }

    public clearCache(): void { this.source.clearCache(); }

    private drawTile(
        ctx: CanvasRenderingContext2D,
        viewExtent: Extent,
        tile: TileCoordinate,
        features: Feature[]
    ): void {
        // ST_AsMVTGeom already clips every geometry and includes a 64-unit
        // render buffer. A second Canvas clip creates anti-aliased cracks at
        // tile borders and cuts off that buffer, so draw the decoded geometry
        // directly and let adjacent buffered tiles overlap by a fraction.
        features.forEach(feature => {
            this.featurePainter.drawFeature(ctx, feature, this.renderer.getSymbol(feature), viewExtent);
        });
    }
}
