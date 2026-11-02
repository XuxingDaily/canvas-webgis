import { describe, expect, it } from "vitest";
import { ArrayFeatureClass } from "../src/core/feature/ArrayFeatureClass";
import { Feature } from "../src/core/feature/Feature";
import { RTreeFeatureClass } from "../src/core/feature/RTreeFeatureClass";
import { Extent } from "../src/core/geometry/Extent";
import { GeometryType } from "../src/core/geometry/Geometry";
import { Point } from "../src/core/geometry/Point";

function gridFeatures(width: number, height: number): Feature[] {
    const features: Feature[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            features.push(new Feature(new Point([x, y]), { id: y * width + x }));
        }
    }
    return features;
}

function ids(features: readonly Feature[]): number[] {
    return features.map(feature => feature.properties.id as number).sort((a, b) => a - b);
}

describe("RTreeFeatureClass", () => {
    it("returns exactly the same visible features as linear scanning", () => {
        const features = gridFeatures(100, 100);
        features[4_242].visible = false;
        const linear = new ArrayFeatureClass(GeometryType.Point, { features });
        const indexed = new RTreeFeatureClass(GeometryType.Point, { features });
        const extents = [
            new Extent(45, 40, 40, 45),
            new Extent(99, 90, 0, 10),
            new Extent(150, 120, 120, 150),
            new Extent(0, 0, 0, 0)
        ];

        extents.forEach(extent => {
            expect(ids(indexed.query(extent))).toEqual(ids(linear.query(extent)));
        });
    });

    it("rebuilds the packed index lazily after mutations", () => {
        const original = new Feature(new Point([1, 1]), { id: 1 });
        const added = new Feature(new Point([10, 10]), { id: 2 });
        const indexed = new RTreeFeatureClass(GeometryType.Point, { features: [original] });

        expect(ids(indexed.query(new Extent(2, 0, 0, 2)))).toEqual([1]);
        indexed.add(added);
        expect(ids(indexed.query(new Extent(11, 9, 9, 11)))).toEqual([2]);
        expect(indexed.remove(original)).toBe(true);
        expect(indexed.query(new Extent(2, 0, 0, 2))).toEqual([]);
    });

    it("reports the same overall extent as the array implementation", () => {
        const features = gridFeatures(25, 40);
        const linear = new ArrayFeatureClass(GeometryType.Point, { features });
        const indexed = new RTreeFeatureClass(GeometryType.Point, { features });

        expect(indexed.extent).toEqual(linear.extent);
    });
});
