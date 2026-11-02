import { beforeEach, describe, expect, it } from "vitest";
import { Extent } from "../src/core/geometry/Extent";
import { View } from "../src/core/view/View";

class TestDOMMatrix {
    public a: number;
    public b: number;
    public c: number;
    public d: number;
    public e: number;
    public f: number;

    public constructor(values: number[] = [1, 0, 0, 1, 0, 0]) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = values;
    }
}

beforeEach(() => {
    globalThis.DOMMatrix = TestDOMMatrix as unknown as typeof DOMMatrix;
});

describe("View", () => {
    it("round-trips map and screen coordinates after fitting an extent", () => {
        const view = new View({ zoom: 5 });
        view.fit(new Extent(100, 0, 0, 200), { width: 800, height: 400 });

        const screen = view.toScreen([75, 60]);
        expect(view.toCoordinate(screen)).toEqual([75, 60]);
        expect(view.toScreen([0, 100])).toEqual([0, 0]);
        expect(view.toScreen([200, 0])).toEqual([800, 400]);
    });

    it("keeps the coordinate under the pointer fixed while zooming", () => {
        const view = new View({ zoom: 5, minZoom: 3, maxZoom: 10 });
        view.fit(new Extent(100, 0, 0, 200), { width: 800, height: 400 });
        const anchor = { x: 320, y: 180 };
        const before = view.toCoordinate([anchor.x, anchor.y]);

        expect(view.zoomAt(anchor, 2)).toBe(2);
        expect(view.toCoordinate([anchor.x, anchor.y])).toEqual(before);
        expect(view.zoom).toBe(7);
    });

    it("clamps zoom and updates the visible extent after panning", () => {
        const view = new View({ zoom: 4, minZoom: 3, maxZoom: 5 });
        view.fit(new Extent(100, 0, 0, 100), { width: 400, height: 400 });
        const before = view.getExtent({ width: 400, height: 400 });

        expect(view.zoomAt({ x: 200, y: 200 }, 10)).toBe(1);
        view.panBy(40, -20);
        const after = view.getExtent({ width: 400, height: 400 });

        expect(view.zoom).toBe(5);
        expect(after.xmin).not.toBe(before.xmin);
        expect(after.ymin).not.toBe(before.ymin);
    });
});
