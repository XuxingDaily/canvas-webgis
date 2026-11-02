
/**
 * 几何图形符号
 */
export class Symbol {
    public constructor(lineWidth: number = 1, strokeStyle: string = "#ff0000", fillStyle: string = "#ff000088") {
        this.lineWidth = lineWidth;
        this.strokeStyle = strokeStyle;
        this.fillStyle = fillStyle;
    }

    /**
     * 线宽
     */
    public lineWidth: number;
    /**
     * 线颜色
     */
    public strokeStyle: string;
    /**
     * 填充颜色
     */
    public fillStyle: string;
}
