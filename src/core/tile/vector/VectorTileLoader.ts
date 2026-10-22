import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { Feature } from "../../feature/Feature";
import { Geometry } from "../../geometry/Geometry";
import { MultiPoint } from "../../geometry/MultiPoint";
import { MultiPolyline } from "../../geometry/MultiPolyline";
import { Point } from "../../geometry/Point";
import { Polygon } from "../../geometry/Polygon";
import { Polyline } from "../../geometry/Polyline";
import { LocalTileGrid, TileCoordinate } from "../LocalTileGrid";

export interface VectorTileLoaderOptions {
    urlTemplate: string;
    grid: LocalTileGrid;
}

export type DecodedVectorTile = Map<string, Feature[]>;

/** 请求 MVT，并把瓦片内部坐标解码成项目使用的局部坐标 Feature。 */
export class VectorTileLoader {
    public constructor(private readonly options: VectorTileLoaderOptions) {}

    public async load(tileCoordinate: TileCoordinate): Promise<DecodedVectorTile> {
        const response = await fetch(this.tileUrl(tileCoordinate));
        if (!response.ok) {
            throw new Error(`矢量瓦片请求失败：${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) return new Map();

        const vectorTile = new VectorTile(new PbfReader(buffer));
        const decoded: DecodedVectorTile = new Map();
        for (const [layerName, sourceLayer] of Object.entries(vectorTile.layers)) {
            const features: Feature[] = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const sourceFeature = sourceLayer.feature(index);
                const parts = sourceFeature.loadGeometry().map((part) =>
                    part.map((point) => this.options.grid.tilePointToLocal(
                        tileCoordinate,
                        point.x,
                        point.y,
                        sourceFeature.extent
                    ))
                );
                const geometry = this.createGeometry(sourceFeature.type, parts);
                if (!geometry) continue;

                features.push(new Feature(geometry, {
                    ...sourceFeature.properties,
                    id: sourceFeature.id ?? sourceFeature.properties.id
                }));
            }
            decoded.set(layerName, features);
        }
        return decoded;
    }

    private tileUrl(tile: TileCoordinate): string {
        return this.options.urlTemplate
            .replace("{z}", String(tile.z))
            .replace("{x}", String(tile.x))
            .replace("{y}", String(tile.y));
    }

    private createGeometry(type: number, parts: number[][][]): Geometry | null {
        const nonEmptyParts = parts.filter((part) => part.length > 0);
        if (nonEmptyParts.length === 0) return null;

        switch (type) {
            case 1: {
                const points = nonEmptyParts.flat();
                return points.length === 1 ? new Point(points[0]) : new MultiPoint(points);
            }
            case 2:
                return nonEmptyParts.length === 1
                    ? new Polyline(nonEmptyParts[0])
                    : new MultiPolyline(nonEmptyParts);
            case 3:
                // Polygon 的 evenodd 填充规则可以同时处理外环、洞和多个面。
                return new Polygon(nonEmptyParts);
            default:
                return null;
        }
    }
}
