import { Extent } from "../geometry/Extent";
import { TileCoordinate } from "../tile/LocalTileGrid";
import { RasterTileSource } from "../tile/raster/RasterTileSource";
import { Layer } from "./Layer";

export interface RasterTileLayerOptions {
    name?: string;
    source: RasterTileSource;
    opacity?: number;
    minZoom?: number;
    maxZoom?: number;
}

/** 按视口调度并在主 Canvas 上合成 XYZ 栅格瓦片。 */
export class RasterTileLayer extends Layer {
    public readonly source: RasterTileSource;
    public opacity: number;

    public constructor(options: RasterTileLayerOptions) {
        super(options.name ?? "");
        this.source = options.source;
        this.opacity = options.opacity ?? 1;
        this.minZoom = options.minZoom ?? options.source.grid.minZoom;
        this.maxZoom = options.maxZoom ?? options.source.grid.maxZoom;
    }

    public get extent(): Extent { return this.source.grid.extent; }

    public draw(ctx: CanvasRenderingContext2D, viewExtent: Extent): void {
        if (!this.visible) return;
        const tileZoom = this.source.grid.zoomForScale(ctx.getTransform().a);
        if (tileZoom < this.minZoom || tileZoom > this.maxZoom) return;

        this.source.grid.tilesForExtent(viewExtent, tileZoom).forEach(tile => {
            const image = this.source.getCached(tile);
            if (image) this.drawTile(ctx, tile, image);
            else {
                const task = this.source.load(tile);
                if (task) void task
                    .then(() => this.requestRender())
                    .catch((_error: unknown): void => undefined);
            }
        });
    }

    public clearCache(): void { this.source.clearCache(); }

    private drawTile(ctx: CanvasRenderingContext2D, tile: TileCoordinate, image: HTMLImageElement): void {
        const extent = this.source.grid.tileExtent(tile);
        const matrix = ctx.getTransform();
        const left = matrix.a * extent.xmin + matrix.e;
        const right = matrix.a * extent.xmax + matrix.e;
        const top = matrix.d * extent.ymax + matrix.f;
        const bottom = matrix.d * extent.ymin + matrix.f;

        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
        ctx.drawImage(
            image,
            Math.min(left, right),
            Math.min(top, bottom),
            Math.abs(right - left),
            Math.abs(bottom - top)
        );
        ctx.restore();
    }
}
