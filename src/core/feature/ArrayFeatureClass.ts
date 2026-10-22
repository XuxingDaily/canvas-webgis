import { GeometryType } from "../geometry/Geometry";
import { Extent } from "../geometry/Extent";
import { Feature } from "./Feature";
import { FeatureClass, FeatureClassMetadata, MutableFeatureClass } from "./FeatureClass";
import { Field } from "./Field";

export interface ArrayFeatureClassOptions extends FeatureClassMetadata {
    features?: Iterable<Feature>;
    fields?: readonly Field[];
}

/** 数组存储实现，范围查询复杂度为 O(n)。 */
export class ArrayFeatureClass extends FeatureClass implements MutableFeatureClass {
    public constructor(geometryType: GeometryType, options: ArrayFeatureClassOptions = {}) {
        super(geometryType, options.fields, options);
        this.items = Array.from(options.features ?? []);
        this.items.forEach(feature => this.assertGeometryType(feature));
    }

    private items: Feature[];
    private extentCache?: Extent | null;

    public get size(): number { return this.items.length; }

    public get extent(): Extent | null {
        if (this.extentCache === undefined) this.extentCache = this.calculateExtent();
        return this.extentCache;
    }

    public getAll(): readonly Feature[] { return this.items; }

    public query(extent: Extent): Feature[] {
        return this.items.filter(feature => feature.intersect(extent));
    }

    public add(feature: Feature): void {
        this.assertGeometryType(feature);
        this.items.push(feature);
        this.extentCache = undefined;
    }

    public remove(feature: Feature): boolean {
        const index = this.items.indexOf(feature);
        if (index < 0) return false;
        this.items.splice(index, 1);
        this.extentCache = undefined;
        return true;
    }

    public clear(): void {
        this.items = [];
        this.extentCache = null;
    }

    private calculateExtent(): Extent | null {
        if (this.items.length === 0) return null;
        const extents = this.items.map(feature => feature.extent);
        return new Extent(
            Math.max(...extents.map(extent => extent.ymax)),
            Math.min(...extents.map(extent => extent.ymin)),
            Math.min(...extents.map(extent => extent.xmin)),
            Math.max(...extents.map(extent => extent.xmax))
        );
    }

    private assertGeometryType(feature: Feature): void {
        if (feature.geometry.type !== this.geometryType) {
            throw new Error(`要素几何类型 ${feature.geometry.type} 与集合类型 ${this.geometryType} 不一致`);
        }
    }
}
