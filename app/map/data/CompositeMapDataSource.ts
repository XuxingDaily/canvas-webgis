import type { Layer } from "../../../src/index";
import type { MapDataSource } from "./MapDataSource";

/** 合并多个数据源，并按给定图层名称恢复统一绘制顺序。 */
export class CompositeMapDataSource implements MapDataSource {
  readonly kind = "vector-tile" as const;

  constructor(
    private readonly sources: MapDataSource[],
    private readonly layerOrder: readonly string[] = []
  ) {}

  async loadLayers(): Promise<Layer[]> {
    const groups = await Promise.all(this.sources.map((source) => source.loadLayers()));
    const layers = groups.flat();
    if (this.layerOrder.length === 0) return layers;

    const order = new Map(this.layerOrder.map((name, index) => [name, index]));
    return layers.sort(
      (left, right) => (order.get(left.name) ?? Number.MAX_SAFE_INTEGER)
        - (order.get(right.name) ?? Number.MAX_SAFE_INTEGER)
    );
  }
}
