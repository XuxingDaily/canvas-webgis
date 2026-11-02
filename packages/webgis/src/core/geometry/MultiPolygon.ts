import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";
import { Polygon } from "./Polygon";

export class MultiPolygon extends Geometry<number[][][][]> {
    public constructor(private readonly polygons: number[][][][]) {
        super(GeometryType.MultiPolygon);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[][][][] { return this.polygons; }

    public toGeoJson(): unknown {
        return { type: "MultiPolygon", coordinates: this.polygons };
    }

    public getCenter(): number[] {
        if (this.polygons.length === 0) return [];
        const largest = this.polygons
            .map(polygon => new Polygon(polygon))
            .sort((a, b) => b.getArea() - a.getArea())[0];
        return largest.getCenter();
    }

    public getExtent(): Extent {
        const points = this.polygons.flat(2);
        if (points.length === 0) return new Extent(0, 0, 0, 0);
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        return new Extent(Math.max(...ys), Math.min(...ys), Math.min(...xs), Math.max(...xs));
    }

    public getArea(): number {
        return this.polygons.reduce((sum, polygon) => sum + new Polygon(polygon).getArea(), 0);
    }

    public getPerimeter(): number {
        return this.polygons.reduce((sum, polygon) => sum + new Polygon(polygon).getPerimeter(), 0);
    }
}
