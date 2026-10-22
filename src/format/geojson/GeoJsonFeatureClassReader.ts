import { ArrayFeatureClass } from "../../core/feature/ArrayFeatureClass";
import { FeatureClass, FeatureClassMetadata } from "../../core/feature/FeatureClass";
import { RTreeFeatureClass } from "../../core/feature/RTreeFeatureClass";
import { GeometryType } from "../../core/geometry/Geometry";
import { GeoJsonAdapter } from "./GeoJsonAdapter";

export type FeatureClassStorage = "array" | "rtree";

export interface GeoJsonFeatureClassOptions extends FeatureClassMetadata {
    geometryType: GeometryType;
    storage?: FeatureClassStorage;
    maxEntries?: number;
}

/** 将 GeoJSON 读取为指定存储策略的 FeatureClass。 */
export class GeoJsonFeatureClassReader {
    public constructor(private readonly adapter = new GeoJsonAdapter()) {}

    public read(input: GeoJSON.FeatureCollection, options: GeoJsonFeatureClassOptions): FeatureClass {
        const adapted = this.adapter.adapt(input);
        const common = {
            name: options.name,
            alias: options.alias,
            description: options.description,
            fields: adapted.fields,
            features: adapted.features.filter(feature => feature.geometry.type === options.geometryType)
        };
        return options.storage === "rtree"
            ? new RTreeFeatureClass(options.geometryType, { ...common, maxEntries: options.maxEntries })
            : new ArrayFeatureClass(options.geometryType, common);
    }
}
