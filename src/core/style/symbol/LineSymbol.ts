import { Symbol } from "./Symbol";

/** 线符号参数；dash 为空数组时绘制实线。 */
export class LineSymbol extends Symbol {
    public constructor(
        lineWidth = 1,
        strokeStyle = "#ff0000",
        public readonly dash: readonly number[] = []
    ) {
        super(lineWidth, strokeStyle);
    }
}
