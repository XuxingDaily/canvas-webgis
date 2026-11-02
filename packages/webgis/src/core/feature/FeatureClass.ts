import { GeometryType } from "../geometry/Geometry";
import { Extent } from "../geometry/Extent";
import { Feature } from "./Feature";
import { Field } from "./Field";

export interface FeatureClassMetadata {
    name?: string;
    alias?: string;
    description?: string;
}

/** 已物化要素集合的只读查询契约。 */
export abstract class FeatureClass {
    protected constructor(
        public readonly geometryType: GeometryType,
        public readonly fields: readonly Field[] = [],
        metadata: FeatureClassMetadata = {}
    ) {
        this.name = metadata.name ?? "";
        this.alias = metadata.alias ?? "";
        this.description = metadata.description ?? "";
    }

    public name: string;
    public alias: string;
    public description: string;

    /** @deprecated 使用 geometryType。 */
    public get type(): GeometryType { return this.geometryType; }
    public abstract get size(): number;
    public get length(): number { return this.size; }
    public abstract get extent(): Extent | null;
    public abstract getAll(): readonly Feature[];
    public get features(): readonly Feature[] { return this.getAll(); }
    public abstract query(extent: Extent): Feature[];
}

/** 可变集合的独立能力，避免强迫只读实现提供无意义的写操作。 */
export interface MutableFeatureClass {
    add(feature: Feature): void;
    remove(feature: Feature): boolean;
    clear(): void;
}
