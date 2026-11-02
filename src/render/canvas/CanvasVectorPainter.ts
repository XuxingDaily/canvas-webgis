import { Feature } from "../../core/feature/Feature";
import { Geometry, GeometryType } from "../../core/geometry/Geometry";
import { MultiPoint } from "../../core/geometry/MultiPoint";
import { MultiPolygon } from "../../core/geometry/MultiPolygon";
import { MultiPolyline } from "../../core/geometry/MultiPolyline";
import { Point } from "../../core/geometry/Point";
import { Polygon } from "../../core/geometry/Polygon";
import { Polyline } from "../../core/geometry/Polyline";
import { Extent } from "../../core/geometry/Extent";
import { FillSymbol } from "../../core/style/symbol/FillSymbol";
import { LetterSymbol } from "../../core/style/symbol/LetterSymbol";
import { LineSymbol } from "../../core/style/symbol/LineSymbol";
import { PointSymbol } from "../../core/style/symbol/PointSymbol";
import { Symbol } from "../../core/style/symbol/Symbol";

export type Coordinate = number[];

/** Canvas 矢量绘制后端：统一处理要素状态、几何绘制和拾取。 */
export class CanvasVectorPainter {
    public drawFeature(ctx: CanvasRenderingContext2D, feature: Feature, symbol: Symbol, viewExtent: Extent): void {
        if (!feature.visible) return;
        this.drawGeometry(
            ctx,
            feature.geometry,
            feature.highlighted ? this.highlightSymbol(feature.geometry.type, symbol) : symbol,
            viewExtent
        );
    }

    public drawGeometry(ctx: CanvasRenderingContext2D, geometry: Geometry, symbol: Symbol, viewExtent: Extent): void {
        if (!geometry.intersect(viewExtent)) return;
        switch (geometry.type) {
            case GeometryType.Point:
                this.drawPoint(ctx, (geometry as Point).coordinates, symbol as PointSymbol);
                break;
            case GeometryType.MultiPoint:
                (geometry as MultiPoint).coordinates.forEach(
                    coordinate => this.drawPoint(ctx, coordinate, symbol as PointSymbol)
                );
                break;
            case GeometryType.Polyline:
                this.drawLines(ctx, [(geometry as Polyline).coordinates], symbol as LineSymbol);
                break;
            case GeometryType.MultiPolyline:
                this.drawLines(ctx, (geometry as MultiPolyline).coordinates, symbol as LineSymbol);
                break;
            case GeometryType.Polygon:
                this.drawPolygon(ctx, (geometry as Polygon).coordinates, symbol as FillSymbol);
                break;
            case GeometryType.MultiPolygon:
                (geometry as MultiPolygon).coordinates.forEach(
                    coordinates => this.drawPolygon(ctx, coordinates, symbol as FillSymbol)
                );
                break;
        }
    }

    public hitTestFeature(
        ctx: CanvasRenderingContext2D,
        feature: Feature,
        screenCoordinate: Coordinate,
        symbol?: Symbol
    ): boolean {
        return feature.visible && this.hitTestGeometry(ctx, feature.geometry, screenCoordinate, symbol);
    }

    public hitTestGeometry(
        ctx: CanvasRenderingContext2D,
        geometry: Geometry,
        screenCoordinate: Coordinate,
        symbol?: Symbol
    ): boolean {
        switch (geometry.type) {
            case GeometryType.Point:
                return this.hitPoint(ctx, (geometry as Point).coordinates, screenCoordinate, symbol as PointSymbol);
            case GeometryType.MultiPoint:
                return (geometry as MultiPoint).coordinates.some(
                    coordinate => this.hitPoint(ctx, coordinate, screenCoordinate, symbol as PointSymbol)
                );
            case GeometryType.Polyline:
                return this.hitLine(ctx, (geometry as Polyline).coordinates, screenCoordinate, symbol as LineSymbol);
            case GeometryType.MultiPolyline:
                return (geometry as MultiPolyline).coordinates.some(
                    coordinates => this.hitLine(ctx, coordinates, screenCoordinate, symbol as LineSymbol)
                );
            case GeometryType.Polygon:
                return this.hitPolygon(ctx, (geometry as Polygon).coordinates, screenCoordinate);
            case GeometryType.MultiPolygon:
                return (geometry as MultiPolygon).coordinates.some(
                    coordinates => this.hitPolygon(ctx, coordinates, screenCoordinate)
                );
            default:
                return false;
        }
    }

    public toScreen(ctx: CanvasRenderingContext2D, coordinate: Coordinate): Coordinate {
        const matrix = ctx.getTransform();
        return [
            matrix.a * coordinate[0] + matrix.c * coordinate[1] + matrix.e,
            matrix.b * coordinate[0] + matrix.d * coordinate[1] + matrix.f
        ];
    }

    private drawPoint(ctx: CanvasRenderingContext2D, coordinate: Coordinate, symbol: PointSymbol): void {
        const style = symbol ?? new PointSymbol();
        const [x, y] = this.toScreen(ctx, coordinate);
        ctx.save();
        ctx.resetTransform();
        ctx.beginPath();
        ctx.arc(x, y, style.radius, 0, Math.PI * 2);
        ctx.fillStyle = style.fillStyle;
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        ctx.fill();
        ctx.stroke();
        if (style instanceof LetterSymbol) {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = style.fontColor;
            ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
            ctx.fillText(style.letter, x, y);
        }
        ctx.restore();
    }

    private drawLines(ctx: CanvasRenderingContext2D, lines: Coordinate[][], symbol: LineSymbol): void {
        const style = symbol ?? new LineSymbol();
        const matrix = ctx.getTransform();
        if (lines.length === 0) return;
        ctx.save();
        ctx.resetTransform();
        ctx.beginPath();
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        ctx.lineCap = style.lineCap;
        ctx.lineJoin = style.lineJoin;
        ctx.setLineDash([...style.dash]);
        lines.forEach(coordinates => {
            coordinates.forEach(([localX, localY], index) => {
                const x = matrix.a * localX + matrix.c * localY + matrix.e;
                const y = matrix.b * localX + matrix.d * localY + matrix.f;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
        });
        ctx.stroke();
        ctx.restore();
    }

    private drawPolygon(ctx: CanvasRenderingContext2D, coordinates: Coordinate[][], symbol: FillSymbol): void {
        const style = symbol ?? new FillSymbol();
        const rings = coordinates.map(ring => ring.map(point => this.toScreen(ctx, point)));
        ctx.save();
        ctx.resetTransform();
        ctx.beginPath();
        rings.forEach(ring => {
            ring.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
            ctx.closePath();
        });
        ctx.fillStyle = style.fillStyle;
        ctx.fill("evenodd");
        // Adjacent MVT polygons are rasterized independently, so their shared
        // tile edge can expose a one-device-pixel anti-aliasing crack. A thin
        // same-colour cover stroke closes that crack without drawing a visible
        // boundary; explicit polygon outlines still use their configured style.
        if (style.lineWidth > 0) {
            ctx.strokeStyle = style.strokeStyle;
            ctx.lineWidth = style.lineWidth;
            ctx.stroke();
        } else {
            ctx.strokeStyle = style.fillStyle;
            ctx.lineWidth = 1.25;
            ctx.lineJoin = "round";
            ctx.stroke();
        }
        ctx.restore();
    }

    private hitPoint(ctx: CanvasRenderingContext2D, coordinate: Coordinate, target: Coordinate, symbol?: PointSymbol): boolean {
        const point = this.toScreen(ctx, coordinate);
        return Math.hypot(target[0] - point[0], target[1] - point[1]) <= (symbol?.radius ?? 6);
    }

    private hitLine(ctx: CanvasRenderingContext2D, coordinates: Coordinate[], target: Coordinate, symbol?: LineSymbol): boolean {
        const points = coordinates.map(point => this.toScreen(ctx, point));
        const tolerance = Math.max(4, (symbol?.lineWidth ?? 1) + 2);
        for (let index = 1; index < points.length; index += 1) {
            if (this.distanceToSegment(target, points[index - 1], points[index]) <= tolerance) return true;
        }
        return false;
    }

    private hitPolygon(ctx: CanvasRenderingContext2D, coordinates: Coordinate[][], target: Coordinate): boolean {
        if (coordinates.length === 0) return false;
        const rings = coordinates.map(ring => ring.map(point => this.toScreen(ctx, point)));
        return this.pointInRing(target, rings[0]) && !rings.slice(1).some(ring => this.pointInRing(target, ring));
    }

    private pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            if ((yi > point[1]) !== (yj > point[1])
                && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    private distanceToSegment(point: Coordinate, start: Coordinate, end: Coordinate): number {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
            ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
        return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
    }

    private highlightSymbol(type: GeometryType, source: Symbol): Symbol {
        switch (type) {
            case GeometryType.Point:
            case GeometryType.MultiPoint:
                return new PointSymbol(2, "#1286d3", "#88deff", (source as PointSymbol)?.radius ?? 8);
            case GeometryType.Polyline:
            case GeometryType.MultiPolyline:
                return new LineSymbol(Math.max(2, source?.lineWidth ?? 1), "#1286d3");
            case GeometryType.Polygon:
            case GeometryType.MultiPolygon:
                return new FillSymbol(2, "#1286d3", "#88deff88");
        }
    }
}
