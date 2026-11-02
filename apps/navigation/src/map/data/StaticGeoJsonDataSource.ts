import {
  FeatureLayer,
  Field,
  FillSymbol,
  Label,
  LineSymbol,
  SimpleCollision,
  SimpleRenderer,
  TextSymbol
} from "@zhaolong/canvas-webgis";
import { loadFeatureLayer } from "../FeatureLayerFactory";
import type { MapDataSource } from "./MapDataSource";
import { STATIC_LAYER_CATALOG } from "./staticLayerCatalog";

export class StaticGeoJsonDataSource implements MapDataSource {
  readonly kind = "static-geojson" as const;

  constructor(private readonly excludedLayerNames: ReadonlySet<string> = new Set()) {}

  async loadLayers(): Promise<FeatureLayer[]> {
    const definitions = STATIC_LAYER_CATALOG.filter(
      (definition) => !this.excludedLayerNames.has(definition.name)
    );
    return Promise.all(definitions.map(async (definition) => {
      const symbol = definition.style.kind === "fill"
        ? new FillSymbol(definition.style.width, definition.style.outline ?? definition.style.color, definition.style.color)
        : new LineSymbol(definition.style.width, definition.style.color);
      const layer = await loadFeatureLayer({
        url: new URL(definition.url, window.location.origin),
        type: definition.type,
        name: definition.name,
        renderer: new SimpleRenderer(definition.type, symbol)
      });
      if (definition.minZoom !== undefined) layer.minZoom = definition.minZoom;
      if (definition.labelField) {
        const symbol = new TextSymbol();
        symbol.auto = true;
        symbol.fontColor = "#334c46";
        symbol.fontSize = 13;
        symbol.strokeStyle = "rgba(255,255,255,.92)";
        symbol.fillStyle = "rgba(255,255,255,.92)";
        layer.labeled = true;
        layer.label = new Label({
          field: new Field(definition.labelField),
          collision: new SimpleCollision(),
          symbol
        });
      }
      return layer;
    }));
  }
}
