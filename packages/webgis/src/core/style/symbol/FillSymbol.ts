import { Symbol } from "./Symbol";

/** 面填充符号参数。 */
export class FillSymbol extends Symbol {
    public constructor(lineWidth = 1, strokeStyle = "#ff0000", fillStyle = "#ff000088") {
        super(lineWidth, strokeStyle, fillStyle);
    }
}
