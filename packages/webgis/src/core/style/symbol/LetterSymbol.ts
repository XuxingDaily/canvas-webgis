import { PointSymbol } from "./PointSymbol";

export interface LetterSymbolOptions {
    lineWidth?: number;
    strokeStyle?: string;
    fillStyle?: string;
    letter?: string;
    radius?: number;
    fontColor?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
}

/** 带居中文字的点符号参数。 */
export class LetterSymbol extends PointSymbol {
    public constructor(options: LetterSymbolOptions = {}) {
        super(
            options.lineWidth ?? 1,
            options.strokeStyle ?? "#ff0000",
            options.fillStyle ?? "#ff000088",
            options.radius ?? 10
        );
        this.letter = options.letter ?? "";
        this.fontColor = options.fontColor ?? "#ff0000";
        this.fontFamily = options.fontFamily ?? "sans-serif";
        this.fontSize = options.fontSize ?? 12;
        this.fontWeight = options.fontWeight ?? "bold";
    }

    public letter: string;
    public fontColor: string;
    public fontFamily: string;
    public fontSize: number;
    public fontWeight: string;
}
