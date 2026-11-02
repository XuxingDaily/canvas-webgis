import { Feature } from "../feature/Feature";
import { CanvasLabelPainter } from "../../render/canvas/CanvasLabelPainter";
import { Extent } from "../geometry/Extent";
import { Field } from "../feature/Field";
import { TextPlacement, TextSymbol } from "../style/symbol/TextSymbol";

export abstract class Collision {
    public abstract test(
        features: Feature[],
        field: Field,
        symbol: TextSymbol,
        ctx: CanvasRenderingContext2D
    ): LabelPlacement[];
}

export interface LabelPlacement {
    feature: Feature;
    symbol: TextSymbol;
}

export class NullCollision extends Collision {
    public test(
        features: Feature[],
        _field: Field,
        symbol: TextSymbol
    ): LabelPlacement[] {
        return features.map(feature => ({ feature, symbol }));
    }
}

/** 使用屏幕空间中心点距离进行快速去重。 */
export class SimpleCollision extends Collision {
    public distance = 50;
    private readonly labelRenderer = new CanvasLabelPainter();

    public test(
        features: Feature[],
        _field: Field,
        _symbol: TextSymbol,
        ctx: CanvasRenderingContext2D
    ): LabelPlacement[] {
        const accepted = features.reduce<Feature[]>((items, current) => {
            const collision = items.some(feature =>
                this.labelRenderer.distance(ctx, current.geometry, feature.geometry) <= this.distance
            );
            if (!collision) items.push(current);
            return items;
        }, []);
        return accepted.map(feature => ({ feature, symbol: _symbol }));
    }
}

/** 通过文本包络盒碰撞检测，并尝试四个候选方位。 */
export class CoverCollision extends Collision {
    public buffer = 10;
    private readonly labelRenderer = new CanvasLabelPainter();

    public test(
        features: Feature[],
        field: Field,
        symbol: TextSymbol,
        ctx: CanvasRenderingContext2D
    ): LabelPlacement[] {
        const acceptedExtents: Extent[] = [];
        return features.reduce<LabelPlacement[]>((accepted, feature) => {
            for (const candidate of this.candidates(symbol)) {
                const extent = this.labelRenderer.measure(
                    ctx,
                    feature.geometry,
                    feature.properties[field.name],
                    candidate
                );
                extent.buffer(this.buffer);
                if (acceptedExtents.some(item => item.intersect(extent))) continue;
                acceptedExtents.push(extent);
                accepted.push({ feature, symbol: candidate });
                break;
            }
            return accepted;
        }, []);
    }

    private candidates(symbol: TextSymbol): TextSymbol[] {
        if (!symbol.auto) return [symbol];
        const placements: TextPlacement[] = ["BOTTOM", "RIGHT", "TOP", "LEFT"];
        const start = Math.max(0, placements.indexOf(symbol.placement));
        return placements.map((_, offset) => new TextSymbol({
            ...symbol,
            placement: placements[(start + offset) % placements.length]
        }));
    }
}
