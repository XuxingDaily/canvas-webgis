import { Symbol } from "./Symbol";

/** 点符号参数；不包含任何 Canvas 绘制行为。 */
export class PointSymbol extends Symbol {
    public constructor(
        lineWidth = 1,
        strokeStyle = "#ff0000",
        fillStyle = "#ff000088",
        public radius = 10
    ) {
        super(lineWidth, strokeStyle, fillStyle);
    }
}
