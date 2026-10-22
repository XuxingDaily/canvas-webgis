import * as gis from "../../src/index";
import type { LocalPoint, Poi, RoutePlan, TourPlan } from "../api/types";
import type { Layer } from "../../src/index";
import { createFeatureLayer } from "./FeatureLayerFactory";
import type { MapDataSource } from "./data/MapDataSource";
import { lineWktToGeoJson } from "./wkt";

const RESULT_LAYERS = ["规划路线", "路径点", "选择点", "吸附连线"];
const POI_LAYER = "视口 POI";
const POI_SELECTION_LAYER = "选中 POI";
const POINT_SELECTION_LAYER = "选中对象";
const POI_CLUSTER_DISTANCE_PX = 46;

export interface MapLayerControl {
  id: string;
  label: string;
  group: "基础地图" | "业务图层";
}

export const MAP_LAYER_CONTROLS: MapLayerControl[] = [
  ...["公园绿地", "行政边界", "外围水面", "内部水面", "生活区", "教学区", "高校名称", "快速道路", "道路"]
    .map((label) => ({ id: label, label, group: "基础地图" as const })),
  { id: "poi", label: "普通 POI", group: "业务图层" },
  { id: "selected-poi", label: "选中 POI", group: "业务图层" },
  { id: "selected-point", label: "选择标记", group: "业务图层" },
  { id: "route", label: "规划路线", group: "业务图层" },
  { id: "route-point", label: "路径点", group: "业务图层" },
  { id: "snap-line", label: "吸附连线", group: "业务图层" }
];

export interface PoiMapTarget {
  kind: "poi" | "cluster";
  center: LocalPoint;
  pois: Poi[];
}

export const ROUTE_COLOR = "#d95d39";
export const TOUR_LEG_COLORS = [
  "#d95d39",
  "#287271",
  "#6c5ce7",
  "#d18b20",
  "#1f78b4",
  "#b23a8a",
  "#5b8c2a",
  "#8c564b",
  "#0096a6",
  "#c44536",
  "#4f6d7a",
  "#7b2cbf"
] as const;

export function tourLegColor(index: number): string {
  return TOUR_LEG_COLORS[index % TOUR_LEG_COLORS.length];
}

function pointCollection(points: LocalPoint[], properties: Record<string, unknown>[] = []): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      properties: properties[index] ?? {},
      geometry: { type: "Point", coordinates: [point.x, point.y] }
    }))
  };
}

function mergeCollections(collections: GeoJSON.FeatureCollection[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: collections.flatMap((item) => item.features) };
}

export class MapScene {
  private readonly resultLayerNames = new Set(RESULT_LAYERS);
  private pois: Poi[] = [];
  private selectedPois: Poi[] = [];
  private poiTargets: PoiMapTarget[] = [];
  private selectedPoiTargets: PoiMapTarget[] = [];
  private poiRenderVersion = 0;
  private readonly layerVisibility = new Map(MAP_LAYER_CONTROLS.map((control) => [control.id, true]));

  private constructor(private readonly map: gis.Map) {}

  static async create(target: string, dataSource: MapDataSource): Promise<MapScene> {
    const layers = await dataSource.loadLayers();
    return new MapScene(new gis.Map({ target, layers, zoom: 3, minZoom: 1, maxZoom: 9 }));
  }

  clearResults(): void {
    this.resultLayerNames.forEach((name) => {
      if (this.map.getLayerByName(name)) this.map.removeLayerByName(name, false);
    });
    this.clearPoiSelection();
  }

  onMapClick(handler: (point: LocalPoint) => void): void {
    this.map.on("click", (coordinate: number[]) => handler({ x: coordinate[0], y: coordinate[1] }));
  }

  onViewportChange(handler: (viewport: [number, number, number, number]) => void): void {
    this.map.on("extent", () => handler(this.getViewport()));
  }

  getViewport(): [number, number, number, number] {
    const extent = this.map.getViewExtent();
    return [extent.xmin, extent.ymin, extent.xmax, extent.ymax];
  }

  setLayerVisible(controlId: string, visible: boolean): void {
    this.layerVisibility.set(controlId, visible);
    this.layerNamesForControl(controlId).forEach((name) => {
      const layer = this.map.getLayerByName(name);
      if (layer) layer.visible = visible;
    });
    this.map.redraw();
  }

  async showDraftPoints(points: LocalPoint[], labels: string[]): Promise<void> {
    if (this.map.getLayerByName("选择点")) this.map.removeLayerByName("选择点", false);
    if (points.length) await this.addPoints(points, labels, "选择点");
  }

  async showRoute(route: RoutePlan): Promise<void> {
    this.clearResults();
    await this.addRouteGeometry([route.geometryWkt], ROUTE_COLOR, "规划路线");
    await this.addPoints([
      route.originSnap.snappedPoint,
      route.destinationSnap.snappedPoint
    ], ["起", "终"]);
  }

  async showTour(tour: TourPlan): Promise<void> {
    this.clearResults();
    for (let index = 0; index < tour.legs.length; index += 1) {
      await this.addRouteGeometry(
        [tour.legs[index].geometryWkt],
        tourLegColor(index),
        `游览路线-${index + 1}`
      );
    }
    await this.addPoints(tour.snappedStops.map((item) => item.snappedPoint), tour.snappedStops.map((_, index) => String(index + 1)));
  }

  async showPois(pois: Poi[]): Promise<void> {
    this.pois = pois;
    await this.renderPoiLayers();
  }

  private async addPoiLayer(targets: PoiMapTarget[], layerName: string, selected: boolean, renderVersion: number): Promise<void> {
    if (!targets.length) return;
    const field = new gis.Field("markerKey");
    const renderer = new gis.CategoryRenderer(field, targets.map((target, index) => {
      const markerKey = `marker-${index}`;
      const symbol = target.kind === "cluster"
        ? new gis.LetterSymbol({
            lineWidth: selected ? 3 : 2,
            strokeStyle: "#ffffff",
            fillStyle: selected ? "#e05d38" : "#315e58",
            letter: String(target.pois.length),
            radius: Math.min(selected ? 22 : 19, (selected ? 14 : 12) + Math.log2(target.pois.length) * 2),
            fontColor: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: selected ? 11 : 10
          })
        : selected
          ? new gis.PointSymbol(3, "#ffffff", "#e05d38", 9)
          : new gis.PointSymbol(2, "#ffffff", "#3e8178", 6);
      return new gis.CategoryRendererItem(markerKey, symbol);
    }));
    const layer = createFeatureLayer({
      name: layerName,
      type: gis.GeometryType.Point,
      data: pointCollection(
        targets.map((target) => target.center),
        targets.map((target, index) => ({ markerKey: `marker-${index}`, count: target.pois.length }))
      ),
      renderer
    });
    if (renderVersion !== this.poiRenderVersion) return;
    this.pushLayer(layer);
  }

  private async renderPoiLayers(): Promise<void> {
    const renderVersion = ++this.poiRenderVersion;
    if (this.map.getLayerByName(POI_LAYER)) this.map.removeLayerByName(POI_LAYER, false);
    if (this.map.getLayerByName(POI_SELECTION_LAYER)) this.map.removeLayerByName(POI_SELECTION_LAYER, false);

    const selectedIds = new Set(this.selectedPois.map((poi) => poi.id));
    this.poiTargets = this.clusterPois(this.pois.filter((poi) => !selectedIds.has(poi.id)));
    this.selectedPoiTargets = this.clusterPois(this.selectedPois);
    await this.addPoiLayer(this.poiTargets, POI_LAYER, false, renderVersion);
    await this.addPoiLayer(this.selectedPoiTargets, POI_SELECTION_LAYER, true, renderVersion);
  }

  pickPoi(point: LocalPoint): PoiMapTarget | null {
    const screenPoint = this.toScreen(point);
    let match: PoiMapTarget | null = null;
    let matchDistance = Number.POSITIVE_INFINITY;
    const visibleTargets = [
      ...(this.layerVisibility.get("selected-poi") === false ? [] : this.selectedPoiTargets),
      ...(this.layerVisibility.get("poi") === false ? [] : this.poiTargets)
    ];
    visibleTargets.forEach((target) => {
      const targetPoint = this.toScreen(target.center);
      const distance = Math.hypot(screenPoint[0] - targetPoint[0], screenPoint[1] - targetPoint[1]);
      const tolerance = target.kind === "cluster" ? 22 : 12;
      if (distance <= tolerance && distance < matchDistance) {
        match = target;
        matchDistance = distance;
      }
    });
    return match;
  }

  async selectPois(pois: Poi[]): Promise<void> {
    if (this.map.getLayerByName(POINT_SELECTION_LAYER)) this.map.removeLayerByName(POINT_SELECTION_LAYER, false);
    this.selectedPois = pois;
    await this.renderPoiLayers();
  }

  async selectPoint(point: LocalPoint, label = "选", preservePoiSelection = false): Promise<void> {
    if (!preservePoiSelection) {
      this.selectedPois = [];
      await this.renderPoiLayers();
    }
    if (this.map.getLayerByName(POINT_SELECTION_LAYER)) this.map.removeLayerByName(POINT_SELECTION_LAYER, false);
    const layer = createFeatureLayer({
      name: POINT_SELECTION_LAYER,
      type: gis.GeometryType.Point,
      data: pointCollection([point], [{ label }]),
      renderer: new gis.SimpleRenderer(gis.GeometryType.Point, new gis.LetterSymbol({
        lineWidth: 3,
        strokeStyle: "#ffffff",
        fillStyle: "#e05d38",
        letter: label,
        radius: 13,
        fontColor: "#ffffff",
        fontFamily: "sans-serif",
        fontSize: 10
      }))
    });
    this.pushLayer(layer);
  }

  clearPoiSelection(): void {
    this.selectedPois = [];
    this.selectedPoiTargets = [];
    if (this.map.getLayerByName(POI_SELECTION_LAYER)) this.map.removeLayerByName(POI_SELECTION_LAYER, false);
    if (this.map.getLayerByName(POINT_SELECTION_LAYER)) this.map.removeLayerByName(POINT_SELECTION_LAYER, false);
    void this.renderPoiLayers();
  }

  async showSnap(original: LocalPoint, snapped: LocalPoint): Promise<void> {
    this.clearResults();
    await this.addPoints([original, snapped], ["原", "吸"]);
    const line = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[original.x, original.y], [snapped.x, snapped.y]] } }]
    } as GeoJSON.FeatureCollection;
    const layer = createFeatureLayer({
      name: "吸附连线",
      type: gis.GeometryType.Polyline,
      data: line,
      renderer: new gis.SimpleRenderer(gis.GeometryType.Polyline, new gis.LineSymbol(2, "#d95d39", [5, 20]))
    });
    this.pushLayer(layer);
  }

  private async addRouteGeometry(wkts: string[], color: string, layerName: string): Promise<void> {
    const data = mergeCollections(wkts.map(lineWktToGeoJson));
    if (!data.features.length) return;
    const layer = createFeatureLayer({
      name: layerName,
      type: gis.GeometryType.Polyline,
      data,
      renderer: new gis.SimpleRenderer(gis.GeometryType.Polyline, new gis.LineSymbol(6, color, [5, 20]))
    });
    this.resultLayerNames.add(layerName);
    this.pushLayer(layer);
  }

  private async addPoints(points: LocalPoint[], labels: string[], layerName = "路径点"): Promise<void> {
    const field = new gis.Field("label");
    const renderer = new gis.CategoryRenderer(field, labels.map((label) => new gis.CategoryRendererItem(
      label,
      new gis.LetterSymbol({
        lineWidth: 2,
        strokeStyle: "#ffffff",
        fillStyle: "#173f3a",
        letter: label,
        radius: 12,
        fontColor: "#ffffff",
        fontFamily: "sans-serif",
        fontSize: 11
      })
    )));
    const layer = createFeatureLayer({
      name: layerName,
      type: gis.GeometryType.Point,
      data: pointCollection(points, labels.map((label) => ({ label }))),
      renderer
    });
    this.pushLayer(layer);
  }

  private pushLayer(layer: Layer): void {
    const control = MAP_LAYER_CONTROLS.find((item) => this.layerNamesForControl(item.id).includes(layer.name));
    if (control) layer.visible = this.layerVisibility.get(control.id) ?? true;
    this.map.pushLayer(layer, false);
  }

  private layerNamesForControl(controlId: string): string[] {
    if (controlId === "poi") return [POI_LAYER];
    if (controlId === "selected-poi") return [POI_SELECTION_LAYER];
    if (controlId === "selected-point") return [POINT_SELECTION_LAYER];
    if (controlId === "route") {
      return Array.from(this.resultLayerNames).filter((name) => name === "规划路线" || name.startsWith("游览路线-"));
    }
    if (controlId === "route-point") return ["路径点", "选择点"];
    if (controlId === "snap-line") return ["吸附连线"];
    return [controlId];
  }

  private clusterPois(pois: Poi[]): PoiMapTarget[] {
    // Cluster by screen-space grid. This remains O(n) for large viewport results,
    // unlike scanning every existing cluster for every POI.
    const clusters = new Map<string, { pois: Poi[]; xSum: number; ySum: number }>();
    pois.forEach((poi) => {
      const screen = this.toScreen(poi.location);
      const column = Math.floor(screen[0] / POI_CLUSTER_DISTANCE_PX);
      const row = Math.floor(screen[1] / POI_CLUSTER_DISTANCE_PX);
      const key = `${column}:${row}`;
      const cluster = clusters.get(key);
      if (!cluster) {
        clusters.set(key, {
          pois: [poi],
          xSum: poi.location.x,
          ySum: poi.location.y
        });
        return;
      }
      cluster.pois.push(poi);
      cluster.xSum += poi.location.x;
      cluster.ySum += poi.location.y;
    });
    return Array.from(clusters.values(), (cluster) => ({
        kind: cluster.pois.length > 1 ? "cluster" : "poi",
        center: {
          x: cluster.xSum / cluster.pois.length,
          y: cluster.ySum / cluster.pois.length
        },
        pois: cluster.pois
      }));
  }

  private toScreen(point: LocalPoint): [number, number] {
    const matrix = this.map.ctx.getTransform();
    return [matrix.a * point.x + matrix.e, matrix.d * point.y + matrix.f];
  }
}
