import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";

export class MultiPoint extends Geometry<number[][]> {
    public constructor(private readonly coordinateItems: number[][]) {
        super(GeometryType.MultiPoint);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[][] { return this.coordinateItems; }

    public toGeoJson(): unknown {
        return { type: "MultiPoint", coordinates: this.coordinateItems };
    }

    public getCenter(): number[] {
        if (this.coordinateItems.length === 0) return [];
        const sum = this.coordinateItems.reduce(
            (value, point) => [value[0] + point[0], value[1] + point[1]],
            [0, 0]
        );
        return [sum[0] / this.coordinateItems.length, sum[1] / this.coordinateItems.length];
    }

    public getExtent(): Extent {
        if (this.coordinateItems.length === 0) return new Extent(0, 0, 0, 0);
        const xs = this.coordinateItems.map(point => point[0]);
        const ys = this.coordinateItems.map(point => point[1]);
        return new Extent(Math.max(...ys), Math.min(...ys), Math.min(...xs), Math.max(...xs));
    }
}
