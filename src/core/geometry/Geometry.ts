import { Extent } from "./Extent";

export enum GeometryType {
    Point,
    Polyline,
    Polygon,
    MultiPoint,
    MultiPolyline,
    MultiPolygon
}

/** 与渲染后端无关的纯空间对象。 */
export abstract class Geometry<TCoordinates = unknown> {
    protected constructor(public readonly type: GeometryType) {}

    protected _extent: Extent;

    public get extent(): Extent { return this._extent; }
    public abstract get coordinates(): TCoordinates;

    public intersect(extent: Extent): boolean {
        return extent.intersect(this._extent);
    }

    public abstract toGeoJson(): unknown;
    public abstract getCenter(): number[];
    public abstract getExtent(): Extent;
}
