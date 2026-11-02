import { Feature } from "../../feature/Feature";
import { GeometryType } from "../../geometry/Geometry";
import { FillSymbol } from "../symbol/FillSymbol";
import { LineSymbol } from "../symbol/LineSymbol";
import { PointSymbol } from "../symbol/PointSymbol";
import { Symbol } from "../symbol/Symbol";

const DEFAULT_PALETTE = [
    "#3e8178", "#d95d39", "#287271", "#6c5ce7",
    "#d18b20", "#1f78b4", "#b23a8a", "#5b8c2a"
] as const;

/** Feature 到 Symbol 的选择策略。 */
export abstract class Renderer {
    public static createSymbol(type: GeometryType, paletteIndex = 0): Symbol {
        const color = DEFAULT_PALETTE[Math.abs(paletteIndex) % DEFAULT_PALETTE.length];
        switch (type) {
            case GeometryType.Point:
            case GeometryType.MultiPoint:
                return new PointSymbol(1, color, color, 8);
            case GeometryType.Polyline:
            case GeometryType.MultiPolyline:
                return new LineSymbol(2, color);
            case GeometryType.Polygon:
            case GeometryType.MultiPolygon:
                return new FillSymbol(1, color, `${color}88`);
            default:
                throw new Error(`不支持的几何类型：${type}`);
        }
    }

    public abstract getSymbol(feature: Feature): Symbol;
}
