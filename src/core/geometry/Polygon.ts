import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";

export class Polygon extends Geometry<number[][][]> {
    public constructor(private readonly rings: number[][][]) {
        super(GeometryType.Polygon);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[][][] { return this.rings; }

    public toGeoJson(): unknown {
        return { type: "Polygon", coordinates: this.rings };
    }

    public getCenter(): number[] {
        const ring = this.rings[0] ?? [];
        if (ring.length === 0) return [];
        let twiceArea = 0;
        let x = 0;
        let y = 0;
        for (let index = 0; index < ring.length; index += 1) {
            const current = ring[index];
            const next = ring[(index + 1) % ring.length];
            const cross = current[0] * next[1] - next[0] * current[1];
            twiceArea += cross;
            x += (current[0] + next[0]) * cross;
            y += (current[1] + next[1]) * cross;
        }
        return twiceArea === 0
            ? [...ring[0]]
            : [x / (3 * twiceArea), y / (3 * twiceArea)];
    }

    public getExtent(): Extent {
        const points = this.rings.flat();
        if (points.length === 0) return new Extent(0, 0, 0, 0);
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        return new Extent(Math.max(...ys), Math.min(...ys), Math.min(...xs), Math.max(...xs));
    }

    public getArea(): number {
        if (this.rings.length === 0) return 0;
        const [outer, ...holes] = this.rings;
        return Math.max(0, Math.abs(this.ringArea(outer)) - holes.reduce(
            (sum, ring) => sum + Math.abs(this.ringArea(ring)),
            0
        ));
    }

    public getPerimeter(): number {
        return this.rings.reduce((sum, ring) => sum + this.ringLength(ring), 0);
    }

    private ringArea(ring: number[][]): number {
        return ring.reduce((sum, point, index) => {
            const next = ring[(index + 1) % ring.length];
            return sum + (point[0] * next[1] - next[0] * point[1]) / 2;
        }, 0);
    }

    private ringLength(ring: number[][]): number {
        return ring.reduce((sum, point, index) => {
            const next = ring[(index + 1) % ring.length];
            return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
        }, 0);
    }
}
