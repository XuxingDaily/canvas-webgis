import { Symbol } from "./Symbol";

export type TextPlacement = "BOTTOM" | "RIGHT" | "TOP" | "LEFT";

export interface TextSymbolOptions {
    lineWidth?: number;
    strokeStyle?: string;
    fillStyle?: string;
    offsetX?: number;
    offsetY?: number;
    padding?: number;
    fontColor?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    placement?: TextPlacement;
    auto?: boolean;
    pointSymbolWidth?: number;
    pointSymbolHeight?: number;
}

/** 标注样式参数；候选方位计算由碰撞模块负责。 */
export class TextSymbol extends Symbol {
    public constructor(options: TextSymbolOptions = {}) {
        super(
            options.lineWidth ?? 3,
            options.strokeStyle ?? "#ff0000",
            options.fillStyle ?? "#ffffff"
        );
        this.offsetX = options.offsetX ?? 0;
        this.offsetY = options.offsetY ?? 1;
        this.padding = options.padding ?? 5;
        this.fontColor = options.fontColor ?? "#ff0000";
        this.fontSize = options.fontSize ?? 12;
        this.fontFamily = options.fontFamily ?? "sans-serif";
        this.fontWeight = options.fontWeight ?? "bold";
        this.placement = options.placement ?? "BOTTOM";
        this.auto = options.auto ?? false;
        this.pointSymbolWidth = options.pointSymbolWidth ?? 0;
        this.pointSymbolHeight = options.pointSymbolHeight ?? 0;
    }

    public offsetX: number;
    public offsetY: number;
    public padding: number;
    public fontColor: string;
    public fontSize: number;
    public fontFamily: string;
    public fontWeight: string;
    public placement: TextPlacement;
    public auto: boolean;
    public pointSymbolWidth: number;
    public pointSymbolHeight: number;
}
