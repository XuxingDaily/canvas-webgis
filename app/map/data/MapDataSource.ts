import type { Layer } from "../../../src/index";

export interface MapDataSource {
  readonly kind: "static-geojson" | "vector-tile";
  loadLayers(): Promise<Layer[]>;
}
