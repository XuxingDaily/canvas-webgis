import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";
import { Polyline } from "./Polyline";

export class MultiPolyline extends Geometry<number[][][]> {
    public constructor(private readonly lines: number[][][]) {
        super(GeometryType.MultiPolyline);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[][][] { return this.lines; }

    public toGeoJson(): unknown {
        return { type: "MultiLineString", coordinates: this.lines };
    }

    public getCenter(): number[] {
        if (this.lines.length === 0) return [];
        const longest = this.lines
            .map(line => new Polyline(line))
            .sort((a, b) => b.getLength() - a.getLength())[0];
        return longest.getCenter();
    }

    public getExtent(): Extent {
        const points = this.lines.flat();
        if (points.length === 0) return new Extent(0, 0, 0, 0);
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        return new Extent(Math.max(...ys), Math.min(...ys), Math.min(...xs), Math.max(...xs));
    }

    public getLength(): number {
        return this.lines.reduce((sum, line) => sum + new Polyline(line).getLength(), 0);
    }
}
