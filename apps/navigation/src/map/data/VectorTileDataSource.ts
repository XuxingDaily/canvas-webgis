import {
  Layer,
  LOCAL_TILE_GRID,
  LocalTileGrid,
  Renderer,
  VectorTileLayer,
  VectorTileSource
} from "@zhaolong/canvas-webgis";
import type { MapDataSource } from "./MapDataSource";

export interface VectorTileLayerDefinition {
  name: string;
  sourceLayer: string;
  renderer: Renderer;
  minZoom?: number;
  maxZoom?: number;
}

export interface VectorTileOptions {
  urlTemplate: string;
  layers: VectorTileLayerDefinition[];
  grid?: LocalTileGrid;
  cacheSize?: number;
}

export class VectorTileDataSource implements MapDataSource {
  readonly kind = "vector-tile" as const;

  constructor(readonly options: VectorTileOptions) {}

  async loadLayers(): Promise<Layer[]> {
    const source = new VectorTileSource({
      urlTemplate: this.options.urlTemplate,
      grid: this.options.grid ?? LOCAL_TILE_GRID,
      cacheSize: this.options.cacheSize
    });
    return this.options.layers.map((definition) => new VectorTileLayer({
      ...definition,
      source
    }));
  }
}
