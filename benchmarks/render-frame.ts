import { ArrayFeatureClass } from "../src/core/feature/ArrayFeatureClass";
import { Feature } from "../src/core/feature/Feature";
import { RTreeFeatureClass } from "../src/core/feature/RTreeFeatureClass";
import { Extent } from "../src/core/geometry/Extent";
import { GeometryType } from "../src/core/geometry/Geometry";
import { Point } from "../src/core/geometry/Point";
import { FeatureLayer } from "../src/core/layer/FeatureLayer";

const FEATURE_COUNT = 100_000;
const WORLD_SIZE = 100_000;
const VIEW_WIDTH = 4_000;
const VIEW_HEIGHT = VIEW_WIDTH * 2 / 3;
const FRAME_COUNT = 120;
const TRIAL_COUNT = 5;

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
    const sorted = [...values].sort((a, b) => a - b);
    return {
        meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
        p50Ms: percentile(sorted, 0.50),
        p95Ms: percentile(sorted, 0.95),
        maxMs: sorted.at(-1) ?? 0
    };
}

const next = random(20261030);
const features = Array.from({ length: FEATURE_COUNT }, (_, id) => new Feature(
    new Point([next() * WORLD_SIZE, next() * WORLD_SIZE]),
    { id }
));
const viewports = Array.from({ length: FRAME_COUNT }, () => {
    const xmin = next() * (WORLD_SIZE - VIEW_WIDTH);
    const ymin = next() * (WORLD_SIZE - VIEW_HEIGHT);
    return new Extent(ymin + VIEW_HEIGHT, ymin, xmin, xmin + VIEW_WIDTH);
});

const arrayLayer = new FeatureLayer(
    new ArrayFeatureClass(GeometryType.Point, { features })
);
const rtreeClass = new RTreeFeatureClass(GeometryType.Point, { features, maxEntries: 16 });
const rtreeLayer = new FeatureLayer(rtreeClass);
rtreeClass.query(viewports[0]);

const canvas = document.querySelector<HTMLCanvasElement>("#benchmark-canvas")!;
const context = canvas.getContext("2d")!;

function render(layer: FeatureLayer, extent: Extent): number {
    const scale = canvas.width / (extent.xmax - extent.xmin);
    const started = performance.now();
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(
        scale,
        0,
        0,
        -scale,
        -extent.xmin * scale,
        extent.ymax * scale
    );
    layer.draw(context, extent, 10);
    return performance.now() - started;
}

for (let index = 0; index < 20; index += 1) {
    render(arrayLayer, viewports[index]);
    render(rtreeLayer, viewports[index]);
}

const arrayFrames: number[] = [];
const rtreeFrames: number[] = [];
for (let trial = 0; trial < TRIAL_COUNT; trial += 1) {
    const measureArray = () => viewports.forEach(
        extent => arrayFrames.push(render(arrayLayer, extent))
    );
    const measureRtree = () => viewports.forEach(
        extent => rtreeFrames.push(render(rtreeLayer, extent))
    );
    if (trial % 2 === 0) {
        measureArray();
        measureRtree();
    } else {
        measureRtree();
        measureArray();
    }
}
const arrayStats = statistics(arrayFrames);
const rtreeStats = statistics(rtreeFrames);
const result = {
    status: "done",
    userAgent: navigator.userAgent,
    featureCount: FEATURE_COUNT,
    trialCount: TRIAL_COUNT,
    frameCount: FRAME_COUNT * TRIAL_COUNT,
    viewport: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
    array: arrayStats,
    rtree: rtreeStats,
    meanSpeedup: arrayStats.meanMs / rtreeStats.meanMs,
    p95Speedup: arrayStats.p95Ms / rtreeStats.p95Ms
};

document.querySelector("#result")!.textContent = JSON.stringify(result, null, 2);
document.documentElement.dataset.benchmarkStatus = "done";
