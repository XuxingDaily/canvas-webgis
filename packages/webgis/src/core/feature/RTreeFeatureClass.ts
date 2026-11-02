import { GeometryType } from "../geometry/Geometry";
import { Extent } from "../geometry/Extent";
import { Feature } from "./Feature";
import { FeatureClass, FeatureClassMetadata, MutableFeatureClass } from "./FeatureClass";
import { Field } from "./Field";
import { PackedRTree } from "./index/PackedRTree";

export interface RTreeFeatureClassOptions extends FeatureClassMetadata {
    features?: Iterable<Feature>;
    fields?: readonly Field[];
    maxEntries?: number;
}

/** 使用 packed R-tree 加速范围查询；写入后在下一次查询时延迟重建索引。 */
export class RTreeFeatureClass extends FeatureClass implements MutableFeatureClass {
    public constructor(geometryType: GeometryType, options: RTreeFeatureClassOptions = {}) {
        super(geometryType, options.fields, options);
        this.items = Array.from(options.features ?? []);
        this.maxEntries = options.maxEntries ?? 16;
        this.items.forEach(feature => this.assertGeometryType(feature));
    }

    private items: Feature[];
    private readonly maxEntries: number;
    private index?: PackedRTree<Feature>;

    public get size(): number { return this.items.length; }
    public get extent(): Extent | null { return this.getIndex().extent; }
    public getAll(): readonly Feature[] { return this.items; }

    public query(extent: Extent): Feature[] {
        return this.getIndex().search(extent).filter(feature => feature.visible);
    }

    public add(feature: Feature): void {
        this.assertGeometryType(feature);
        this.items.push(feature);
        this.index = undefined;
    }

    public remove(feature: Feature): boolean {
        const index = this.items.indexOf(feature);
        if (index < 0) return false;
        this.items.splice(index, 1);
        this.index = undefined;
        return true;
    }

    public clear(): void {
        this.items = [];
        this.index = undefined;
    }

    private getIndex(): PackedRTree<Feature> {
        if (!this.index) {
            this.index = new PackedRTree(this.items, feature => feature.extent, this.maxEntries);
        }
        return this.index;
    }

    private assertGeometryType(feature: Feature): void {
        if (feature.geometry.type !== this.geometryType) {
            throw new Error(`要素几何类型 ${feature.geometry.type} 与集合类型 ${this.geometryType} 不一致`);
        }
    }
}
