import { classifyRings, VectorTile } from "@mapbox/vector-tile";
import type MvtPoint from "@mapbox/point-geometry";
import { PbfReader } from "pbf";
import { Feature } from "../../core/feature/Feature";
import { Extent } from "../../core/geometry/Extent";
import { Geometry } from "../../core/geometry/Geometry";
import { MultiPoint } from "../../core/geometry/MultiPoint";
import { MultiPolygon } from "../../core/geometry/MultiPolygon";
import { MultiPolyline } from "../../core/geometry/MultiPolyline";
import { Point } from "../../core/geometry/Point";
import { Polygon } from "../../core/geometry/Polygon";
import { Polyline } from "../../core/geometry/Polyline";
import { FeatureAdapter } from "../FeatureAdapter";

export interface MvtAdapterInput {
    buffer: ArrayBuffer | Uint8Array;
    tileExtent: Extent;
    signal?: AbortSignal;
}

export type DecodedVectorTile = Map<string, Feature[]>;

/** 将 MVT Protobuf 转换为按 source layer 分组的内部 Feature。 */
export class MvtAdapter implements FeatureAdapter<MvtAdapterInput, DecodedVectorTile> {
    public adapt(input: MvtAdapterInput): DecodedVectorTile {
        this.throwIfAborted(input.signal);
        if (input.buffer.byteLength === 0) return new Map();

        const vectorTile = new VectorTile(new PbfReader(input.buffer));
        const decoded: DecodedVectorTile = new Map();
        for (const [layerName, sourceLayer] of Object.entries(vectorTile.layers)) {
            this.throwIfAborted(input.signal);
            const features: Feature[] = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                this.throwIfAborted(input.signal);
                const sourceFeature = sourceLayer.feature(index);
                const geometry = this.createGeometry(
                    sourceFeature.type,
                    sourceFeature.loadGeometry(),
                    sourceFeature.extent,
                    input
                );
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

    private createGeometry(
        type: number,
        parts: MvtPoint[][],
        extent: number,
        input: MvtAdapterInput
    ): Geometry | null {
        const nonEmptyParts = parts.filter((part) => part.length > 0);
        if (nonEmptyParts.length === 0) return null;

        const toLocal = (point: { x: number; y: number }): [number, number] =>
            [
                input.tileExtent.xmin
                    + point.x / extent * (input.tileExtent.xmax - input.tileExtent.xmin),
                input.tileExtent.ymax
                    - point.y / extent * (input.tileExtent.ymax - input.tileExtent.ymin)
            ];

        switch (type) {
            case 1: {
                const points = nonEmptyParts.flat().map(toLocal);
                return points.length === 1 ? new Point(points[0]) : new MultiPoint(points);
            }
            case 2: {
                const lines = nonEmptyParts.map((part) => part.map(toLocal));
                return lines.length === 1 ? new Polyline(lines[0]) : new MultiPolyline(lines);
            }
            case 3: {
                const polygons = classifyRings(nonEmptyParts).map((polygon) =>
                    polygon.map((ring) => ring.map(toLocal))
                );
                if (polygons.length === 0) return null;
                return polygons.length === 1
                    ? new Polygon(polygons[0])
                    : new MultiPolygon(polygons);
            }
            default:
                return null;
        }
    }

    private throwIfAborted(signal?: AbortSignal): void {
        if (signal?.aborted) throw new DOMException("瓦片解码已过期", "AbortError");
    }
}
