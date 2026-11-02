import { Feature } from "../../feature/Feature";
import { FeatureClass } from "../../feature/FeatureClass";
import { Field } from "../../feature/Field";
import { GeometryType } from "../../geometry/Geometry";
import { Symbol } from "../symbol/Symbol";
import { Renderer } from "./Renderer";

export class CategoryRendererItem {
    public constructor(
        public readonly value: unknown,
        public readonly symbol: Symbol,
        public count = 1,
        public readonly label: string = String(value)
    ) {}
}

/** 根据离散属性值选择 Symbol。 */
export class CategoryRenderer extends Renderer {
    public constructor(
        public readonly field: Field,
        public readonly items: CategoryRendererItem[]
    ) {
        super();
    }

    private readonly fallbackSymbols = new Map<GeometryType, Symbol>();

    public static generate(featureClass: FeatureClass, field: Field): CategoryRenderer {
        const items: CategoryRendererItem[] = [];
        featureClass.getAll().forEach(feature => {
            const value = feature.properties[field.name];
            const item = items.find(candidate => candidate.value === value);
            if (item) item.count += 1;
            else items.push(new CategoryRendererItem(
                value,
                Renderer.createSymbol(featureClass.geometryType, items.length)
            ));
        });
        return new CategoryRenderer(field, items);
    }

    public getSymbol(feature: Feature): Symbol {
        const value = feature.properties[this.field.name];
        const item = this.items.find(candidate => candidate.value === value);
        if (item) return item.symbol;
        const type = feature.geometry.type;
        let fallback = this.fallbackSymbols.get(type);
        if (!fallback) {
            fallback = Renderer.createSymbol(type);
            this.fallbackSymbols.set(type, fallback);
        }
        return fallback;
    }
}
