import { Geometry } from "../../core/geometry/Geometry";
import { Extent } from "../../core/geometry/Extent";
import { TextSymbol } from "../../core/style/symbol/TextSymbol";
import { CanvasVectorPainter } from "./CanvasVectorPainter";

/** Canvas 文本量算与绘制。 */
export class CanvasLabelPainter {
    public constructor(private readonly vectorPainter = new CanvasVectorPainter()) {}

    public draw(ctx: CanvasRenderingContext2D, geometry: Geometry, text: unknown, symbol: TextSymbol): void {
        const value = text?.toString();
        if (!value) return;
        const extent = this.measure(ctx, geometry, value, symbol);
        const lines = value.split(/\r?\n/);
        const width = extent.xmax - extent.xmin;
        ctx.save();
        ctx.resetTransform();
        ctx.font = this.font(symbol);
        const widths = this.measureWidths(ctx, lines, symbol);
        ctx.strokeStyle = symbol.strokeStyle;
        ctx.fillStyle = symbol.fillStyle;
        ctx.lineWidth = symbol.lineWidth;
        ctx.lineJoin = "round";
        ctx.strokeRect(extent.xmin, extent.ymin, width, extent.ymax - extent.ymin);
        ctx.fillRect(extent.xmin, extent.ymin, width, extent.ymax - extent.ymin);
        ctx.textBaseline = "top";
        ctx.fillStyle = symbol.fontColor;
        lines.forEach((line, index) => ctx.fillText(
            line,
            extent.xmin + symbol.padding + (width - widths[index]) / 2,
            extent.ymin + symbol.padding + index * (symbol.fontSize + symbol.padding)
        ));
        ctx.restore();
    }

    public measure(ctx: CanvasRenderingContext2D, geometry: Geometry, text: unknown, symbol: TextSymbol): Extent {
        const lines = text?.toString().split(/\r?\n/) ?? [];
        ctx.save();
        ctx.resetTransform();
        ctx.font = this.font(symbol);
        const widths = this.measureWidths(ctx, lines, symbol);
        ctx.restore();
        const width = Math.max(0, ...widths);
        const height = symbol.fontSize * lines.length + symbol.padding * 2
            + symbol.padding * Math.max(0, lines.length - 1);
        const center = this.vectorPainter.toScreen(ctx, geometry.getCenter());
        const offset = this.placementOffset(symbol, width, height);
        const xmin = center[0] + offset[0];
        const ymin = center[1] + offset[1];
        return new Extent(ymin + height, ymin, xmin, xmin + width);
    }

    public distance(ctx: CanvasRenderingContext2D, first: Geometry, second: Geometry): number {
        const a = this.vectorPainter.toScreen(ctx, first.getCenter());
        const b = this.vectorPainter.toScreen(ctx, second.getCenter());
        return Math.hypot(b[0] - a[0], b[1] - a[1]);
    }

    private measureWidths(ctx: CanvasRenderingContext2D, lines: string[], symbol: TextSymbol): number[] {
        return lines.map(line => ctx.measureText(line).width + symbol.padding * 2);
    }

    private placementOffset(symbol: TextSymbol, width: number, height: number): number[] {
        switch (symbol.placement) {
            case "TOP": return [-width / 2, -symbol.pointSymbolHeight / 2 - height];
            case "RIGHT": return [symbol.pointSymbolWidth / 2, -height / 2];
            case "LEFT": return [-symbol.pointSymbolWidth / 2 - width, -height / 2];
            default: return [-width / 2, symbol.pointSymbolHeight / 2];
        }
    }

    private font(symbol: TextSymbol): string {
        return `${symbol.fontWeight} ${symbol.fontSize}px ${symbol.fontFamily}`;
    }
}
