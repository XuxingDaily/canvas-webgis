import { Feature } from "../../feature/Feature";
import { FeatureClass } from "../../feature/FeatureClass";
import { Field } from "../../feature/Field";
import { GeometryType } from "../../geometry/Geometry";
import { Symbol } from "../symbol/Symbol";
import { Renderer } from "./Renderer";

export class ClassRendererItem {
    public constructor(
        public readonly low: number,
        public readonly high: number,
        public readonly symbol: Symbol,
        public readonly label: string = `${low} - ${high}`
    ) {}
}

/** 根据数值区间选择 Symbol。 */
export class ClassRenderer extends Renderer {
    public constructor(public readonly field: Field, public readonly items: ClassRendererItem[]) {
        super();
    }

    private readonly fallbackSymbols = new Map<GeometryType, Symbol>();

    public static generate(featureClass: FeatureClass, field: Field, breaks: number): ClassRenderer {
        if (!Number.isInteger(breaks) || breaks <= 0) throw new Error("分级数量必须为正整数");
        const values = featureClass.getAll()
            .map(feature => Number(feature.properties[field.name]))
            .filter(Number.isFinite);
        if (values.length === 0) return new ClassRenderer(field, []);

        const min = Math.min(...values);
        const max = Math.max(...values);
        const classCount = min === max ? 1 : breaks;
        const interval = classCount === 1 ? 0 : (max - min) / classCount;
        const items = Array.from({ length: classCount }, (_, index) => {
            const low = min + index * interval;
            const high = index === classCount - 1 ? max : min + (index + 1) * interval;
            return new ClassRendererItem(
                low,
                high,
                Renderer.createSymbol(featureClass.geometryType, index)
            );
        });
        return new ClassRenderer(field, items);
    }

    public getSymbol(feature: Feature): Symbol {
        const value = Number(feature.properties[this.field.name]);
        const item = this.items.find((candidate, index) => value >= candidate.low
            && (value < candidate.high || (index === this.items.length - 1 && value <= candidate.high)));
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
