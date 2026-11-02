import { GeometryType } from "@zhaolong/canvas-webgis";

export interface StaticLayerDefinition {
  name: string;
  url: string;
  type: GeometryType;
  style: {
    kind: "fill" | "line";
    color: string;
    width: number;
    outline?: string;
  };
  minZoom?: number;
  labelField?: string;
}

export const STATIC_LAYER_CATALOG: StaticLayerDefinition[] = [
  { name: "公园绿地", url: "/map/PARK2.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#dce8d2", outline: "#dce8d2", width: 0.5 } },
  { name: "行政边界", url: "/map/bound.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#eef1e7", outline: "#ccd5c1", width: 1 } },
  { name: "外围水面", url: "/map/water.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#dceff3", outline: "#dceff3", width: 0.5 } },
  { name: "内部水面", url: "/map/water1.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#9ed4de", outline: "#9ed4de", width: 1 } },
  { name: "生活区", url: "/map/shq.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#f3ead8", outline: "#eadcc3", width: 0.6 }, minZoom: 3 },
  { name: "教学区", url: "/map/studyArea.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "#dde1e7", outline: "#cbd1da", width: 0.6 }, minZoom: 2 },
  { name: "高校名称", url: "/map/school_name.geojson", type: GeometryType.MultiPolygon, style: { kind: "fill", color: "rgba(255,255,255,0)", outline: "rgba(255,255,255,0)", width: 0.1 }, labelField: "name" },
  { name: "快速道路", url: "/map/highway.geojson", type: GeometryType.MultiPolyline, style: { kind: "line", color: "#d48772", width: 4 }, minZoom: 2 },
  { name: "道路", url: "/map/line.geojson", type: GeometryType.Polyline, style: { kind: "line", color: "#ffffff", width: 2.5 }, minZoom: 2 }
];
