import { describe, expect, it } from "vitest";
import { ArrayFeatureClass } from "../src/core/feature/ArrayFeatureClass";
import { Feature } from "../src/core/feature/Feature";
import { RTreeFeatureClass } from "../src/core/feature/RTreeFeatureClass";
import { Extent } from "../src/core/geometry/Extent";
import { GeometryType } from "../src/core/geometry/Geometry";
import { Point } from "../src/core/geometry/Point";

const FEATURE_COUNT = 100_000;
const WORLD_SIZE = 100_000;
const VIEW_SIZE = 2_000;
const VIEWPORT_COUNT = 100;
const ITERATIONS = 25;

function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

function percentile(sorted: readonly number[], fraction: number): number {
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function statistics(values: number[]) {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
        p50Ms: percentile(sorted, 0.50),
        p95Ms: percentile(sorted, 0.95),
        minMs: sorted[0],
        maxMs: sorted.at(-1) ?? 0
    };
}

function time(operation: () => number): { elapsedMs: number; result: number } {
    const started = performance.now();
    const result = operation();
    return { elapsedMs: performance.now() - started, result };
}

describe("spatial index performance", () => {
    it("compares repeated fixed viewport queries", () => {
        const next = random(20261030);
        const features = Array.from({ length: FEATURE_COUNT }, (_, id) => new Feature(
            new Point([next() * WORLD_SIZE, next() * WORLD_SIZE]),
            { id }
        ));
        const viewports = Array.from({ length: VIEWPORT_COUNT }, () => {
            const xmin = next() * (WORLD_SIZE - VIEW_SIZE);
            const ymin = next() * (WORLD_SIZE - VIEW_SIZE);
            return new Extent(ymin + VIEW_SIZE, ymin, xmin, xmin + VIEW_SIZE);
        });
        const linear = new ArrayFeatureClass(GeometryType.Point, { features });
        const indexed = new RTreeFeatureClass(GeometryType.Point, { features, maxEntries: 16 });
        const linearQuery = () => viewports.reduce(
            (sum, extent) => sum + linear.query(extent).length, 0
        );
        const indexedQuery = () => viewports.reduce(
            (sum, extent) => sum + indexed.query(extent).length, 0
        );

        // Build the index and warm both code paths outside the measurement.
        const expected = linearQuery();
        expect(indexedQuery()).toBe(expected);
        for (let index = 0; index < 5; index += 1) {
            linearQuery();
            indexedQuery();
        }

        const linearTimings: number[] = [];
        const indexedTimings: number[] = [];
        for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
            const measureLinear = () => {
                const measurement = time(linearQuery);
                expect(measurement.result).toBe(expected);
                linearTimings.push(measurement.elapsedMs);
            };
            const measureIndexed = () => {
                const measurement = time(indexedQuery);
                expect(measurement.result).toBe(expected);
                indexedTimings.push(measurement.elapsedMs);
            };
            if (iteration % 2 === 0) {
                measureLinear();
                measureIndexed();
            } else {
                measureIndexed();
                measureLinear();
            }
        }

        const linearStats = statistics(linearTimings);
        const indexedStats = statistics(indexedTimings);
        const result = {
            featureCount: FEATURE_COUNT,
            viewportCount: VIEWPORT_COUNT,
            iterations: ITERATIONS,
            matchCount: expected,
            linear: linearStats,
            rtree: indexedStats,
            meanSpeedup: linearStats.meanMs / indexedStats.meanMs,
            p50Speedup: linearStats.p50Ms / indexedStats.p50Ms,
            p95Speedup: linearStats.p95Ms / indexedStats.p95Ms
        };
        console.log("SPATIAL_INDEX_BENCHMARK", JSON.stringify(result));
        expect(result.meanSpeedup).toBeGreaterThan(1);
    });
});
