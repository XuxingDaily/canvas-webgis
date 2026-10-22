import { Extent } from "./Extent";
import { Geometry, GeometryType } from "./Geometry";

export class Polyline extends Geometry<number[][]> {
    public constructor(private readonly coordinateItems: number[][]) {
        super(GeometryType.Polyline);
        this._extent = this.getExtent();
    }

    public get coordinates(): number[][] { return this.coordinateItems; }

    public toGeoJson(): unknown {
        return { type: "LineString", coordinates: this.coordinateItems };
    }

    /** 返回沿线长度中点，而非包络盒中心。 */
    public getCenter(): number[] {
        if (this.coordinateItems.length === 0) return [];
        const half = this.getLength() / 2;
        let travelled = 0;
        for (let index = 1; index < this.coordinateItems.length; index += 1) {
            const start = this.coordinateItems[index - 1];
            const end = this.coordinateItems[index];
            const segment = Math.hypot(end[0] - start[0], end[1] - start[1]);
            if (travelled + segment >= half) {
                const ratio = segment === 0 ? 0 : (half - travelled) / segment;
                return [
                    start[0] + ratio * (end[0] - start[0]),
                    start[1] + ratio * (end[1] - start[1])
                ];
            }
            travelled += segment;
        }
        return [...this.coordinateItems[this.coordinateItems.length - 1]];
    }

    public getExtent(): Extent {
        if (this.coordinateItems.length === 0) return new Extent(0, 0, 0, 0);
        const xs = this.coordinateItems.map(point => point[0]);
        const ys = this.coordinateItems.map(point => point[1]);
        return new Extent(Math.max(...ys), Math.min(...ys), Math.min(...xs), Math.max(...xs));
    }

    public getLength(): number {
        return this.coordinateItems.slice(1).reduce((sum, point, index) => {
            const previous = this.coordinateItems[index];
            return sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        }, 0);
    }
}
