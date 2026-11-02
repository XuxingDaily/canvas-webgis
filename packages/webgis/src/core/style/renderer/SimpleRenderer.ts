import { Feature } from "../../feature/Feature";
import { GeometryType } from "../../geometry/Geometry";
import { Symbol } from "../symbol/Symbol";
import { Renderer } from "./Renderer";

/** 所有要素共用同一 Symbol。 */
export class SimpleRenderer extends Renderer {
    public constructor(type: GeometryType, public symbol: Symbol = Renderer.createSymbol(type)) {
        super();
    }

    public getSymbol(_feature: Feature): Symbol { return this.symbol; }
}
