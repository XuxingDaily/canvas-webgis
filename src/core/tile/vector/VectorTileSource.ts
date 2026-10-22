import { LocalTileGrid, TileCoordinate } from "../LocalTileGrid";
import { TileCache } from "../TileCache";
import { DecodedVectorTile, VectorTileLoader } from "./VectorTileLoader";

export interface VectorTileSourceOptions {
    urlTemplate: string;
    grid: LocalTileGrid;
    cacheSize?: number;
}

/**
 * 一个 MVT tileset 的共享数据源。
 *
 * 多个显示图层会复用同一个请求、解码结果和 LRU 缓存，所以同一 z/x/y
 * 无论包含多少命名图层，浏览器都只会下载一次。
 */
export class VectorTileSource {
    public readonly grid: LocalTileGrid;
    private readonly loader: VectorTileLoader;
    private readonly cache: TileCache<DecodedVectorTile>;
    private readonly loading = new Map<string, Promise<DecodedVectorTile>>();
    private readonly retryAfter = new Map<string, number>();

    public constructor(options: VectorTileSourceOptions) {
        this.grid = options.grid;
        this.loader = new VectorTileLoader({
            urlTemplate: options.urlTemplate,
            grid: options.grid
        });
        this.cache = new TileCache(options.cacheSize ?? 128);
    }

    public getCached(tile: TileCoordinate): DecodedVectorTile | undefined {
        return this.cache.get(this.grid.key(tile));
    }

    public load(tile: TileCoordinate): Promise<DecodedVectorTile> | undefined {
        const key = this.grid.key(tile);
        const existing = this.loading.get(key);
        if (existing) return existing;
        if ((this.retryAfter.get(key) ?? 0) > Date.now()) return undefined;

        const task = this.loader.load(tile)
            .then((decoded) => {
                this.cache.set(key, decoded);
                this.retryAfter.delete(key);
                return decoded;
            })
            .catch((error: unknown) => {
                this.retryAfter.set(key, Date.now() + 5000);
                console.error(`加载矢量瓦片 ${key} 失败`, error);
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
}
