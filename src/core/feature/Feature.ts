import { Geometry } from "../geometry/Geometry";
import { Extent } from "../geometry/Extent";

export type FeatureProperties = Record<string, unknown>;

/** Geometry 与业务属性的组合，不承担绘制和数据加载职责。 */
export class Feature {
    public constructor(
        public readonly geometry: Geometry,
        public readonly properties: FeatureProperties = {}
    ) {}

    public visible = true;
    public highlighted = false;

    /** @deprecated 使用 highlighted。 */
    public get isHeightLighted(): boolean { return this.highlighted; }
    public set isHeightLighted(value: boolean) { this.highlighted = value; }

    public get extent(): Extent { return this.geometry.extent; }

    public intersect(extent: Extent): boolean {
        return this.visible && this.geometry.intersect(extent);
    }
}
