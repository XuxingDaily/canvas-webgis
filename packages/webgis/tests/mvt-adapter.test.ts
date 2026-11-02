import { PbfWriter } from "pbf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiPolygon } from "../src/core/geometry/MultiPolygon";
import { Point } from "../src/core/geometry/Point";
import { LocalTileGrid } from "../src/core/tile/LocalTileGrid";
import { VectorTileLoader } from "../src/core/tile/vector/VectorTileLoader";
import { FeatureAdapter } from "../src/format/FeatureAdapter";
import {
    DecodedVectorTile,
    MvtAdapter,
    MvtAdapterInput
} from "../src/format/mvt/MvtAdapter";

interface EncodedFeature {
    id: number;
    type: 1 | 2 | 3;
    geometry: number[];
    property?: { key: string; value: string };
}

const grid = new LocalTileGrid({
    originX: 0,
    originY: 100,
    worldSpanLocal: 100,
    minZoom: 0,
    maxZoom: 4
});

const tileCoordinate = { z: 0, x: 0, y: 0 };

describe("MvtAdapter", () => {
    it("decodes a source layer, properties and tile-local coordinates", () => {
        const buffer = encodeTile("poi", [{
            id: 7,
            type: 1,
            geometry: encodePaths([[[2048, 1024]]]),
            property: { key: "kind", value: "park" }
        }]);

        const decoded = new MvtAdapter().adapt({
            buffer,
            tileExtent: grid.tileExtent(tileCoordinate)
        });
        const feature = decoded.get("poi")?.[0];

        expect(feature?.geometry).toBeInstanceOf(Point);
        expect(feature?.geometry.coordinates).toEqual([50, 75]);
        expect(feature?.properties).toMatchObject({ id: 7, kind: "park" });
    });

    it("classifies polygon outer rings and holes into a MultiPolygon", () => {
        const outerA = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
        const holeA = [[200, 200], [200, 800], [800, 800], [800, 200]];
        const outerB = [[2000, 2000], [3000, 2000], [3000, 3000], [2000, 3000]];
        const buffer = encodeTile("land", [{
            id: 1,
            type: 3,
            geometry: encodePaths([outerA, holeA, outerB], true)
        }]);

        const decoded = new MvtAdapter().adapt({
            buffer,
            tileExtent: grid.tileExtent(tileCoordinate)
        });
        const geometry = decoded.get("land")?.[0]?.geometry;

        expect(geometry).toBeInstanceOf(MultiPolygon);
        expect((geometry as MultiPolygon).coordinates).toHaveLength(2);
        expect((geometry as MultiPolygon).coordinates[0]).toHaveLength(2);
        expect((geometry as MultiPolygon).coordinates[1]).toHaveLength(1);
    });

    it("stops decoding when the request signal is aborted", () => {
        const controller = new AbortController();
        controller.abort();

        expect(() => new MvtAdapter().adapt({
            buffer: new Uint8Array(),
            tileExtent: grid.tileExtent(tileCoordinate),
            signal: controller.signal
        })).toThrowError(DOMException);
    });
});

describe("VectorTileLoader", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("keeps HTTP transport in the loader and delegates decoding to the adapter", async () => {
        const decoded: DecodedVectorTile = new Map([["poi", []]]);
        const adapter: FeatureAdapter<MvtAdapterInput, DecodedVectorTile> = {
            adapt: vi.fn(() => decoded)
        };
        const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
        vi.stubGlobal("fetch", fetchMock);
        const loader = new VectorTileLoader({
            urlTemplate: "/tiles/{z}/{x}/{y}.mvt",
            grid,
            adapter
        });

        await expect(loader.load({ z: 2, x: 1, y: 3 })).resolves.toBe(decoded);
        expect(fetchMock).toHaveBeenCalledWith("/tiles/2/1/3.mvt", { signal: undefined });
        expect(adapter.adapt).toHaveBeenCalledWith(expect.objectContaining({
            tileExtent: grid.tileExtent({ z: 2, x: 1, y: 3 })
        }));
    });
});

function encodeTile(layerName: string, features: EncodedFeature[]): Uint8Array {
    const writer = new PbfWriter();
    writer.writeMessage(3, writeLayer, { name: layerName, features });
    return writer.finish();
}

function writeLayer(layer: { name: string; features: EncodedFeature[] }, writer: PbfWriter): void {
    writer.writeStringField(1, layer.name);
    layer.features.forEach((feature) => writer.writeMessage(2, writeFeature, feature));
    const property = layer.features.find((feature) => feature.property)?.property;
    if (property) {
        writer.writeStringField(3, property.key);
        writer.writeMessage(4, (value: string, valueWriter: PbfWriter) => {
            valueWriter.writeStringField(1, value);
        }, property.value);
    }
    writer.writeVarintField(5, 4096);
    writer.writeVarintField(15, 2);
}

function writeFeature(feature: EncodedFeature, writer: PbfWriter): void {
    writer.writeVarintField(1, feature.id);
    if (feature.property) writer.writePackedVarint(2, [0, 0]);
    writer.writeVarintField(3, feature.type);
    writer.writePackedVarint(4, feature.geometry);
}

function encodePaths(paths: number[][][], close = false): number[] {
    const geometry: number[] = [];
    let cursorX = 0;
    let cursorY = 0;
    for (const path of paths) {
        if (path.length === 0) continue;
        geometry.push(command(1, 1));
        geometry.push(zigZag(path[0][0] - cursorX), zigZag(path[0][1] - cursorY));
        [cursorX, cursorY] = path[0];

        if (path.length > 1) {
            geometry.push(command(2, path.length - 1));
            for (const [x, y] of path.slice(1)) {
                geometry.push(zigZag(x - cursorX), zigZag(y - cursorY));
                cursorX = x;
                cursorY = y;
            }
        }
        if (close) geometry.push(command(7, 1));
    }
    return geometry;
}

function command(id: number, count: number): number {
    return (count << 3) | id;
}

function zigZag(value: number): number {
    return value < 0 ? -value * 2 - 1 : value * 2;
}
