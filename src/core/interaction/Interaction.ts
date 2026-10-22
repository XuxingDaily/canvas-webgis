import { FeatureLayer } from "../layer/FeatureLayer";
import { CanvasVectorPainter } from "../../render/canvas/CanvasVectorPainter";
import { Extent } from "../geometry/Extent";

/** @deprecated 视图缩放已由 View.zoomAt 负责。 */
export const scaleGeometry = (
    ctx: CanvasRenderingContext2D,
    target: { x: number; y: number },
    scale: number
): CanvasRenderingContext2D => {
    const matrix = ctx.getTransform();
    ctx.setTransform(
        matrix.a * scale,
        matrix.b,
        matrix.c,
        matrix.d * scale,
        target.x - scale * (target.x - matrix.e),
        target.y - scale * (target.y - matrix.f)
    );
    return ctx;
};

/** @deprecated 坐标换算已由 View.toCoordinate 负责。 */
export const screenToGeo = (
    ctx: CanvasRenderingContext2D,
    coordinate: number[]
): number[] => {
    const matrix = ctx.getTransform();
    return [
        (coordinate[0] - matrix.e) / matrix.a,
        (coordinate[1] - matrix.f) / matrix.d
    ];
};

export const ClickHighlighted = (
    screenCoordinate: number[],
    extent: Extent,
    featureLayer: FeatureLayer,
    ctx: CanvasRenderingContext2D
): void => {
    const painter = new CanvasVectorPainter();
    featureLayer.featureClass.query(extent).forEach(feature => {
        feature.highlighted = painter.hitTestFeature(
            ctx,
            feature,
            screenCoordinate,
            featureLayer.renderer.getSymbol(feature)
        );
    });
};

export const ClearHighlighted = (featureLayer: FeatureLayer): void => {
    featureLayer.featureClass.features.forEach(feature => {
        feature.highlighted = false;
    });
};
