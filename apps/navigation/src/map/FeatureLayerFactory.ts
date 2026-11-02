import {
  FeatureLayer,
  GeoJsonFeatureClassReader,
  GeometryType,
  Renderer,
  SimpleRenderer,
  type FeatureClassStorage
} from "@zhaolong/canvas-webgis";

export interface FeatureLayerConfig {
  data: GeoJSON.FeatureCollection;
  type: GeometryType;
  name?: string;
  description?: string;
  alias?: string;
  renderer?: Renderer;
  storage?: FeatureClassStorage;
}

export interface RemoteFeatureLayerConfig extends Omit<FeatureLayerConfig, "data"> {
  url: URL | string;
}

const reader = new GeoJsonFeatureClassReader();

export function createFeatureLayer(config: FeatureLayerConfig): FeatureLayer {
  const featureClass = reader.read(config.data, {
    geometryType: config.type,
    name: config.name,
    alias: config.alias,
    description: config.description,
    storage: config.storage
  });
  const layer = new FeatureLayer(
    featureClass,
    config.renderer ?? new SimpleRenderer(config.type)
  );
  layer.name = config.name ?? "";
  layer.description = config.description ?? "";
  return layer;
}

export async function loadFeatureLayer(config: RemoteFeatureLayerConfig): Promise<FeatureLayer> {
  const response = await fetch(config.url);
  if (!response.ok) {
    throw new Error(`GeoJSON 请求失败：${response.status} ${response.statusText}`);
  }
  return createFeatureLayer({
    ...config,
    data: await response.json() as GeoJSON.FeatureCollection
  });
}
