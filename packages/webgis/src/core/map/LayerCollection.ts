import { Extent } from "../geometry/Extent";
import { Layer } from "../layer/Layer";

/** 负责图层集合的增删、排序、查询与范围计算。 */
export class LayerCollection {
    public constructor(layers: Layer[] = []) {
        this.layers = [...layers];
    }

    private layers: Layer[];

    public getAll(): readonly Layer[] { return this.layers; }
    public getAt(index: number): Layer { return this.layers[index]; }
    public findByName(name: string): Layer {
        return this.layers.find(layer => layer.name === name);
    }
    public add(layer: Layer): void { this.layers.push(layer); }
    public insert(index: number, layer: Layer): void { this.layers.splice(index, 0, layer); }

    public remove(layer: Layer): Layer {
        const index = this.layers.indexOf(layer);
        if (index < 0) return null;
        return this.removeAt(index);
    }

    public removeAt(index: number): Layer {
        return this.layers.splice(index, 1)[0];
    }

    public removeByName(name: string): Layer[] {
        const removed = this.layers.filter(layer => layer.name === name);
        this.layers = this.layers.filter(layer => layer.name !== name);
        return removed;
    }

    public moveToTop(index: number): void {
        const layer = this.removeAt(index);
        if (layer) this.layers.unshift(layer);
    }

    public clear(): void { this.layers = []; }

    public getExtent(): Extent {
        const extents = this.layers
            .map(layer => layer.extent)
            .filter((extent): extent is Extent => extent !== null);
        if (extents.length === 0) return new Extent(1, 0, 0, 1);

        return new Extent(
            Math.max(...extents.map(extent => extent.ymax)),
            Math.min(...extents.map(extent => extent.ymin)),
            Math.min(...extents.map(extent => extent.xmin)),
            Math.max(...extents.map(extent => extent.xmax))
        );
    }
}
