import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";

/** 点几何，仅保存空间坐标和空间运算。 */
export class Point extends Geometry<number[]> {
    public constructor(private readonly coordinate: number[]) {
        super(GeometryType.Point);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[] { return this.coordinate; }

    public toGeoJson(): unknown {
        return { type: "Point", coordinates: [...this.coordinate] };
    }

    public getCenter(): number[] { return [...this.coordinate]; }

    public getExtent(): Extent {
        return new Extent(this.coordinate[1], this.coordinate[1], this.coordinate[0], this.coordinate[0]);
    }
}
