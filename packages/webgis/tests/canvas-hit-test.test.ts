import { describe, expect, it } from "vitest";
import { CanvasVectorPainter } from "../src/render/canvas/CanvasVectorPainter";
import { Point } from "../src/core/geometry/Point";
import { Polyline } from "../src/core/geometry/Polyline";
import { Polygon } from "../src/core/geometry/Polygon";
import { PointSymbol } from "../src/core/style/symbol/PointSymbol";
import { LineSymbol } from "../src/core/style/symbol/LineSymbol";

const context = {
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 })
} as unknown as CanvasRenderingContext2D;

describe("CanvasVectorPainter hit testing", () => {
    const painter = new CanvasVectorPainter();

    it("picks points using screen-space symbol radius", () => {
        const point = new Point([5, 5]);
        expect(painter.hitTestGeometry(context, point, [23, 30], new PointSymbol(1, "#000", "#fff", 4)))
            .toBe(true);
        expect(painter.hitTestGeometry(context, point, [30, 30], new PointSymbol(1, "#000", "#fff", 4)))
            .toBe(false);
    });

    it("picks polylines using distance to transformed segments", () => {
        const line = new Polyline([[0, 0], [10, 0]]);
        expect(painter.hitTestGeometry(context, line, [20, 23], new LineSymbol(2, "#000")))
            .toBe(true);
        expect(painter.hitTestGeometry(context, line, [20, 30], new LineSymbol(2, "#000")))
            .toBe(false);
    });

    it("respects polygon holes", () => {
        const polygon = new Polygon([
            [[0, 0], [10, 0], [10, 10], [0, 10]],
            [[4, 4], [6, 4], [6, 6], [4, 6]]
        ]);
        expect(painter.hitTestGeometry(context, polygon, [14, 24])).toBe(true);
        expect(painter.hitTestGeometry(context, polygon, [20, 30])).toBe(false);
    });
});
