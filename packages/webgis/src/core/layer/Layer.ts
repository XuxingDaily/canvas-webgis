import { Extent } from "../geometry/Extent";

/**
 * 图层基类
 */
export abstract class Layer {
    public constructor(name: string = "", des: string = "") {
        this.name = name;
        this.description = des;
        this.visible = true;
    }
    
    /**
     * 图层名称
     */
    public name: string;
    /**
     * 图层描述
     */
    public description: string;
    /**
     * 图层是否可见
     * @remarks 控制图层是否渲染
     */
    public visible: boolean;

    
    public minZoom: number = 0;
    public maxZoom: number = 10;

    /** 动态图层加载完成后，通过该回调请求 Map 安排下一帧。 */
    private invalidateHandler?: () => void;

    /** 图层范围。没有固定范围的图层可以返回 null。 */
    public abstract get extent(): Extent | null;

    public setInvalidateHandler(handler?: () => void): void {
        this.invalidateHandler = handler;
    }

    protected requestRender(): void {
        this.invalidateHandler?.();
    }

    /**
     * 对图层进行绘制
     * @param ctx Canvas画笔
     * @param extent 可视区范围
     */
    public abstract draw(ctx: CanvasRenderingContext2D, extent: Extent, zoom: number): void;
}
