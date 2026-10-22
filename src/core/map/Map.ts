import { CanvasMapRenderer } from "../../render/canvas/CanvasMapRenderer";
import { MapEventEmitter, MapEvents } from "../events/MapEventEmitter";
import { Extent } from "../geometry/Extent";
import { InteractionController } from "../interaction/InteractionController";
import { Layer } from "../layer/Layer";
import { View } from "../view/View";
import { LayerCollection } from "./LayerCollection";

export interface MapOptions {
    target: string;
    layers?: Layer[];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
}

/** 地图门面：对外提供统一 API，对内协调视图、图层、渲染与交互模块。 */
export class Map {
    public constructor(config: MapOptions) {
        this._container = document.getElementById(config.target) as HTMLDivElement;
        if (!this._container) throw new Error(`地图容器不存在：${config.target}`);

        this._canvas = document.createElement("canvas");
        this._canvas.style.cssText = "position: absolute; height: 100vh; width: 100vw;";
        this.resizeCanvas();
        this._container.appendChild(this._canvas);
        this._ctx = this._canvas.getContext("2d") as CanvasRenderingContext2D;

        this._layers = new LayerCollection(config.layers ?? []);
        this._layers.getAll().forEach(layer => this.bindLayer(layer));
        this._view = new View({
            zoom: config.zoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom
        });
        this._renderer = new CanvasMapRenderer(this._ctx);
        this._layerExtent = this.getLayerExtent();

        this._view.fit(this._layerExtent, this.getSize(), this._view.zoom);
        this._viewExtent = this.getViewExtent();
        this._center = View.getCenter(this._viewExtent);

        this._interaction = new InteractionController(this._canvas, this._view, {
            onViewChange: () => this.redraw(),
            onClick: coordinate => this._events.emit("click", coordinate),
            onResize: () => this.handleResize()
        });
        this.renderLayers();
    }

    /** 地图容器。 */
    public _container: HTMLDivElement;
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private readonly _layers: LayerCollection;
    private readonly _view: View;
    private readonly _renderer: CanvasMapRenderer;
    private readonly _interaction: InteractionController;
    private readonly _events = new MapEventEmitter();
    private _center: number[];
    private _viewExtent: Extent;
    private _layerExtent: Extent;
    private _renderPending = false;

    public get container(): HTMLDivElement { return this._container; }
    public get ctx(): CanvasRenderingContext2D { return this._ctx; }
    public set ctx(ctx: CanvasRenderingContext2D) {
        this._ctx = ctx;
        this._renderer.setContext(ctx);
    }
    public get center(): number[] { return this._center; }
    public get zoom(): number { return this._view.zoom; }
    public get minZoom(): number { return this._view.minZoom; }
    public set minZoom(zoom: number) { this._view.minZoom = zoom; }
    public get maxZoom(): number { return this._view.maxZoom; }
    public set maxZoom(zoom: number) { this._view.maxZoom = zoom; }

    public getLayerExtent(): Extent { return this._layers.getExtent(); }
    public getCenter(extent: Extent): number[] { return View.getCenter(extent); }

    public setView(zoom: number = this.zoom, extent?: Extent): void {
        this._view.fit(extent ?? this.getLayerExtent(), this.getSize(), zoom);
        this.redraw();
    }

    public getViewExtent(): Extent { return this._view.getExtent(this.getSize()); }

    public on<K extends keyof MapEvents>(
        event: K,
        handler: (payload: MapEvents[K]) => void
    ): () => void {
        return this._events.on(event, handler);
    }

    public clear(): void {
        this._renderer.clear();
        this._ctx.setTransform(this._view.transform);
    }

    public redraw(): void {
        this.updateViewState();
        this.renderLayers();
    }

    /** 动态图层使用的轻量重绘入口，不发送 extent 事件。 */
    public requestRender(): void {
        if (this._renderPending) return;
        this._renderPending = true;
        requestAnimationFrame(() => {
            this._renderPending = false;
            this.renderLayers();
        });
    }

    public getLayer(k: number): Layer { return this._layers.getAt(k - 1); }
    public getLayerByName(name: string): Layer { return this._layers.findByName(name); }

    public removeLayerByName(name: string, fitView: boolean = true): void {
        const removed = this._layers.removeByName(name);
        removed.forEach(layer => layer.setInvalidateHandler(undefined));
        if (removed.length > 0) this.afterLayerChange(fitView);
    }

    public pushLayer(layer: Layer, fitView: boolean = true): void {
        this.bindLayer(layer);
        this._layers.add(layer);
        this.afterLayerChange(fitView);
    }

    public insertLayer(k: number, layer: Layer): void {
        this.bindLayer(layer);
        this._layers.insert(k - 1, layer);
        this.afterLayerChange(true);
    }

    public removeKthLayer(k: number): Layer {
        const layer = this._layers.removeAt(k - 1);
        if (layer) {
            layer.setInvalidateHandler(undefined);
            this.afterLayerChange(true);
        }
        return layer;
    }

    public removeLayer(layer: Layer): Layer {
        const removed = this._layers.remove(layer);
        if (removed) {
            removed.setInvalidateHandler(undefined);
            this.afterLayerChange(true);
        }
        return removed;
    }

    public upLayer(k: number): void {
        this._layers.moveToTop(k - 1);
        this.redraw();
    }

    public clearLayer(): void {
        this._layers.getAll().forEach(layer => layer.setInvalidateHandler(undefined));
        this._layers.clear();
        this.afterLayerChange(false);
    }

    public hiddenLayer(k: number): void {
        const layer = this._layers.getAt(k - 1);
        if (!layer) return;
        layer.visible = false;
        this.redraw();
    }

    public showLayer(k: number): void {
        const layer = this._layers.getAt(k - 1);
        if (!layer) return;
        layer.visible = true;
        this.redraw();
    }

    public destroy(): void {
        this._interaction.destroy();
        this._layers.getAll().forEach(layer => layer.setInvalidateHandler(undefined));
        this._canvas.remove();
    }

    private updateViewState(): void {
        this._layerExtent = this.getLayerExtent();
        this._viewExtent = this.getViewExtent();
        this._center = View.getCenter(this._viewExtent);
        this._events.emit("extent", undefined);
    }

    private renderLayers(): void {
        this._viewExtent = this.getViewExtent();
        this._renderer.render(
            this._layers.getAll(),
            this._view.transform,
            this._viewExtent,
            this.zoom
        );
    }

    private bindLayer(layer: Layer): void {
        layer.setInvalidateHandler(() => this.requestRender());
    }

    private afterLayerChange(fitView: boolean): void {
        this._layerExtent = this.getLayerExtent();
        if (fitView) this.setView(this.zoom, this._layerExtent);
        else this.redraw();
    }

    private handleResize(): void {
        this.resizeCanvas();
        this._view.fit(this._layerExtent, this.getSize(), this.zoom);
        this.redraw();
    }

    private resizeCanvas(): void {
        this._canvas.width = this._container.clientWidth;
        this._canvas.height = this._container.clientHeight;
    }

    private getSize(): { width: number; height: number } {
        return { width: this._canvas.width, height: this._canvas.height };
    }
}
