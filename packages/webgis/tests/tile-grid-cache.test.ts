import { describe, expect, it } from "vitest";
import { LocalTileGrid } from "../src/core/tile/LocalTileGrid";
import { TileCache } from "../src/core/tile/TileCache";
import { Extent } from "../src/core/geometry/Extent";

describe("TileCache", () => {
    it("evicts the least recently used entry", () => {
        const cache = new TileCache<number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        expect(cache.get("a")).toBe(1);
        cache.set("c", 3);

        expect(cache.get("b")).toBeUndefined();
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
    });
});

describe("LocalTileGrid", () => {
    const grid = new LocalTileGrid({
        originX: 0,
        originY: 100,
        worldSpanLocal: 100,
        minZoom: 0,
        maxZoom: 4
    });

    it("converts tile coordinates to local extents", () => {
        expect(grid.tileExtent({ z: 2, x: 1, y: 2 })).toEqual(
            new Extent(50, 25, 25, 50)
        );
        expect(grid.tilePointToLocal({ z: 2, x: 1, y: 2 }, 2048, 2048))
            .toEqual([37.5, 37.5]);
    });

    it("returns only tiles intersecting the viewport", () => {
        expect(grid.tilesForExtent(new Extent(90, 76, 1, 24), 2)).toEqual([
            { z: 2, x: 0, y: 0 }
        ]);
        expect(grid.tilesForExtent(new Extent(200, 150, 150, 200), 2)).toEqual([]);
    });

    it("selects a zoom level from the current map scale", () => {
        expect(grid.zoomForScale(2.56)).toBe(0);
        expect(grid.zoomForScale(10.24)).toBe(2);
    });
});
