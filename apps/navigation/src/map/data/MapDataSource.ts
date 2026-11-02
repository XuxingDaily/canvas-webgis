import type { Layer } from "@zhaolong/canvas-webgis";

export interface MapDataSource {
  readonly kind: "static-geojson" | "vector-tile";
  loadLayers(): Promise<Layer[]>;
}
