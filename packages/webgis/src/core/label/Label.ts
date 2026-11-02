import { Feature } from "../feature/Feature";
import { CanvasLabelPainter } from "../../render/canvas/CanvasLabelPainter";
import { Field } from "../feature/Field";
import { TextSymbol } from "../style/symbol/TextSymbol";
import { Collision, SimpleCollision } from "./collision";

export interface LabelOptions {
    field: Field;
    symbol?: TextSymbol;
    collision?: Collision;
}

/** 标注配置，具体文字绘制由 CanvasLabelPainter 承担。 */
export class Label {
    public constructor(options: LabelOptions) {
        this.field = options.field;
        this.symbol = options.symbol ?? new TextSymbol();
        this.collision = options.collision ?? new SimpleCollision();
    }

    public field: Field;
    public symbol: TextSymbol;
    public collision: Collision;
    private readonly painter = new CanvasLabelPainter();

    public draw(features: Feature[], ctx: CanvasRenderingContext2D): void {
        const placements = this.collision.test(features, this.field, this.symbol, ctx);
        placements.forEach(({ feature, symbol }) => {
            this.painter.draw(ctx, feature.geometry, feature.properties[this.field.name], symbol);
        });
    }
}
