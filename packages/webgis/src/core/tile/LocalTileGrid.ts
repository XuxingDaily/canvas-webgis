import { Extent } from "../geometry/Extent";

export interface TileCoordinate {
    z: number;
    x: number;
    y: number;
}

export interface LocalTileGridOptions {
    originX: number;
    originY: number;
    worldSpanLocal: number;
    tilePixels?: number;
    minZoom?: number;
    maxZoom?: number;
}

/** 矢量与栅格瓦片共享的局部平面坐标金字塔，原点位于完整范围左上角。 */
export class LocalTileGrid {
    public readonly originX: number;
    public readonly originY: number;
    public readonly worldSpanLocal: number;
    public readonly tilePixels: number;
    public readonly minZoom: number;
    public readonly maxZoom: number;

    public constructor(options: LocalTileGridOptions) {
        this.originX = options.originX;
        this.originY = options.originY;
        this.worldSpanLocal = options.worldSpanLocal;
        this.tilePixels = options.tilePixels ?? 256;
        this.minZoom = options.minZoom ?? 0;
        this.maxZoom = options.maxZoom ?? 22;
    }

    public get extent(): Extent {
        return new Extent(this.originY, this.originY - this.worldSpanLocal, this.originX, this.originX + this.worldSpanLocal);
    }

    public tileSize(z: number): number {
        this.validateZoom(z);
        return this.worldSpanLocal / Math.pow(2, z);
    }

    public tileExtent(tile: TileCoordinate): Extent {
        const size = this.tileSize(tile.z);
        const xmin = this.originX + tile.x * size;
        const xmax = xmin + size;
        const ymax = this.originY - tile.y * size;
        const ymin = ymax - size;
        return new Extent(ymax, ymin, xmin, xmax);
    }

    public tilesForExtent(view: Extent, z: number): TileCoordinate[] {
        this.validateZoom(z);
        const global = this.extent;
        if (!global.intersect(view)) return [];
        const count = Math.pow(2, z);
        const size = this.tileSize(z);
        const xmin = Math.max(view.xmin, global.xmin);
        const xmax = Math.min(view.xmax, global.xmax);
        const ymin = Math.max(view.ymin, global.ymin);
        const ymax = Math.min(view.ymax, global.ymax);
        const startX = this.clamp(Math.floor((xmin - this.originX) / size), 0, count - 1);
        const endX = this.clamp(Math.floor((xmax - this.originX) / size), 0, count - 1);
        const startY = this.clamp(Math.floor((this.originY - ymax) / size), 0, count - 1);
        const endY = this.clamp(Math.floor((this.originY - ymin) / size), 0, count - 1);
        const result: TileCoordinate[] = [];
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) result.push({ z, x, y });
        }
        return result;
    }

    public zoomForScale(scaleX: number): number {
        const localUnitsPerPixel = 1 / Math.abs(scaleX);
        const rawZoom = Math.log2(this.worldSpanLocal / (this.tilePixels * localUnitsPerPixel));
        return this.clamp(Math.round(rawZoom), this.minZoom, this.maxZoom);
    }

    public tilePointToLocal(tile: TileCoordinate, tileX: number, tileY: number, mvtExtent = 4096): [number, number] {
        const bounds = this.tileExtent(tile);
        const size = this.tileSize(tile.z);
        return [bounds.xmin + tileX / mvtExtent * size, bounds.ymax - tileY / mvtExtent * size];
    }

    public key(tile: TileCoordinate): string {
        return `${tile.z}:${tile.x}:${tile.y}`;
    }

    private validateZoom(z: number): void {
        if (!Number.isInteger(z) || z < this.minZoom || z > this.maxZoom) throw new Error(`非法瓦片层级：${z}`);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max));
    }
}

export const LOCAL_TILE_GRID = new LocalTileGrid({
    // originX, originY, worldSpanLocal 共同决定 BBOX，即瓦片金字塔的范围，一般为正方形。
    // BBOX(originX, originY - worldSpanLocal, originX + worldSpanLocal, originY)
    // 覆盖广州数据 Web Mercator 包围盒的正方形范围。
    // tileLocalSize = 262144 / 2^z
    originX: 12550000,
    originY: 2800000,
    worldSpanLocal: 262144,

    // 一个瓦片在标准显示比例下，对应多少个逻辑屏幕像素
    // tilePixels 结合当前仿射矩阵的缩放参数，用于计算最合适的瓦片层级 zoom
    // 设 scaleX = 屏幕像素 / 局部坐标单位，则 localUnitPerPixel = 1 / Math.abs(scaleX)
    // 进而，zoom = Math.round(Math.log2(worldSpanLocal / (tilePixels * localUnitPerPixel)))
    tilePixels: 256,
    minZoom: 0,
    maxZoom: 22
});
