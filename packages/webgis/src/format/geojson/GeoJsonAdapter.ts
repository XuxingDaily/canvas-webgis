import { Feature } from "../../core/feature/Feature";
import { Field, FieldDataType } from "../../core/feature/Field";
import { Geometry } from "../../core/geometry/Geometry";
import { MultiPoint } from "../../core/geometry/MultiPoint";
import { MultiPolygon } from "../../core/geometry/MultiPolygon";
import { MultiPolyline } from "../../core/geometry/MultiPolyline";
import { Point } from "../../core/geometry/Point";
import { Polygon } from "../../core/geometry/Polygon";
import { Polyline } from "../../core/geometry/Polyline";
import { AdaptedFeatureSet, FeatureAdapter } from "../FeatureAdapter";

/** GeoJSON 外部模型到内部 Feature/Geometry 的适配器。 */
export class GeoJsonAdapter implements FeatureAdapter<GeoJSON.FeatureCollection> {
    public adapt(input: GeoJSON.FeatureCollection): AdaptedFeatureSet {
        const features = (input?.features ?? [])
            .map(item => this.adaptFeature(item))
            .filter((feature): feature is Feature => feature !== null);
        return { features, fields: this.inferFields(features) };
    }

    private adaptFeature(input: GeoJSON.Feature): Feature | null {
        if (!input.geometry) return null;
        const geometry = this.adaptGeometry(input.geometry);
        return geometry ? new Feature(geometry, input.properties ?? {}) : null;
    }

    private adaptGeometry(input: GeoJSON.Geometry): Geometry | null {
        const coordinates = (input as any).coordinates;
        switch (input.type) {
            case "Point": return new Point(coordinates);
            case "LineString": return new Polyline(coordinates);
            case "Polygon": return new Polygon(coordinates);
            case "MultiPoint": return new MultiPoint(coordinates);
            case "MultiLineString": return new MultiPolyline(coordinates);
            case "MultiPolygon": return new MultiPolygon(coordinates);
            default: return null;
        }
    }

    private inferFields(features: Feature[]): Field[] {
        const types = new Map<string, FieldDataType>();
        features.forEach(feature => Object.entries(feature.properties).forEach(([name, value]) => {
            const nextType = this.fieldType(value);
            const current = types.get(name);
            if (current === undefined) types.set(name, nextType);
            else if (current !== nextType) types.set(name, FieldDataType.Unknown);
        }));
        return Array.from(types, ([name, type]) => new Field(name, type));
    }

    private fieldType(value: unknown): FieldDataType {
        if (typeof value === "number") return FieldDataType.Number;
        if (typeof value === "boolean") return FieldDataType.Boolean;
        if (value instanceof Date) return FieldDataType.Date;
        if (typeof value === "string") return FieldDataType.Text;
        return FieldDataType.Unknown;
    }
}
