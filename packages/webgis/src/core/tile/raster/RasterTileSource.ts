import { LocalTileGrid, TileCoordinate } from "../LocalTileGrid";
import { TileCache } from "../TileCache";

export interface RasterTileSourceOptions {
    urlTemplate: string;
    grid: LocalTileGrid;
    cacheSize?: number;
    crossOrigin?: string | null;
}

/** 栅格瓦片图片的加载、并发去重、失败退避和 LRU 缓存。 */
export class RasterTileSource {
    public readonly grid: LocalTileGrid;
    private readonly cache: TileCache<HTMLImageElement>;
    private readonly loading = new Map<string, Promise<HTMLImageElement>>();
    private readonly retryAfter = new Map<string, number>();

    public constructor(private readonly options: RasterTileSourceOptions) {
        this.grid = options.grid;
        this.cache = new TileCache(options.cacheSize ?? 128);
    }

    public getCached(tile: TileCoordinate): HTMLImageElement | undefined {
        return this.cache.get(this.grid.key(tile));
    }

    public load(tile: TileCoordinate): Promise<HTMLImageElement> | undefined {
        const key = this.grid.key(tile);
        const existing = this.loading.get(key);
        if (existing) return existing;
        if ((this.retryAfter.get(key) ?? 0) > Date.now()) return undefined;

        const task = this.loadImage(this.tileUrl(tile))
            .then(image => {
                this.cache.set(key, image);
                this.retryAfter.delete(key);
                return image;
            })
            .catch((error: unknown) => {
                this.retryAfter.set(key, Date.now() + 5000);
                throw error;
            })
            .finally(() => this.loading.delete(key));
        this.loading.set(key, task);
        return task;
    }

    public clearCache(): void {
        this.cache.clear();
        this.retryAfter.clear();
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            if (this.options.crossOrigin !== undefined) image.crossOrigin = this.options.crossOrigin;
            image.decoding = "async";
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`栅格瓦片加载失败：${url}`));
            image.src = url;
        });
    }

    private tileUrl(tile: TileCoordinate): string {
        return this.options.urlTemplate
            .replace("{z}", String(tile.z))
            .replace("{x}", String(tile.x))
            .replace("{y}", String(tile.y));
    }
}
