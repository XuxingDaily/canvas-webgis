import { FeatureAdapter } from "../../../format/FeatureAdapter";
import {
    DecodedVectorTile,
    MvtAdapter,
    MvtAdapterInput
} from "../../../format/mvt/MvtAdapter";
import { LocalTileGrid, TileCoordinate } from "../LocalTileGrid";

export interface VectorTileLoaderOptions {
    urlTemplate: string;
    grid: LocalTileGrid;
    adapter?: FeatureAdapter<MvtAdapterInput, DecodedVectorTile>;
}

/** 请求 MVT，并把响应交给格式适配器转换为内部 Feature。 */
export class VectorTileLoader {
    private readonly adapter: FeatureAdapter<MvtAdapterInput, DecodedVectorTile>;

    public constructor(private readonly options: VectorTileLoaderOptions) {
        this.adapter = options.adapter ?? new MvtAdapter();
    }

    public async load(tileCoordinate: TileCoordinate, signal?: AbortSignal): Promise<DecodedVectorTile> {
        const response = await fetch(this.tileUrl(tileCoordinate), { signal });
        if (!response.ok) {
            throw new Error(`矢量瓦片请求失败：${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        if (signal?.aborted) throw new DOMException("瓦片请求已过期", "AbortError");
        return this.adapter.adapt({
            buffer,
            tileExtent: this.options.grid.tileExtent(tileCoordinate),
            signal
        });
    }

    private tileUrl(tile: TileCoordinate): string {
        return this.options.urlTemplate
            .replace("{z}", String(tile.z))
            .replace("{x}", String(tile.x))
            .replace("{y}", String(tile.y));
    }

}
