/** 导航业务 DTO。 */
export type TravelMode = "WALKING" | "DRIVING";
export type RouteStrategy = "FASTEST" | "SHORTEST";

export interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

export interface LocalPoint {
  x: number;
  y: number;
}

export interface Poi {
  id: number;
  name: string;
  context?: string;
  location: LocalPoint;
  dataVersion?: number;
}

export interface PoiList {
  keyword?: string;
  x?: number;
  y?: number;
  radius?: number;
  bbox?: number[];
  items: Poi[];
  count: number;
}

export type Waypoint = { poiId: number; point?: never } | { point: LocalPoint; poiId?: never };

export interface SnappedPoint {
  edgeId: number;
  fraction: number;
  snappedPoint: LocalPoint;
  distanceLocal: number;
  networkVersion: number;
}

export interface RouteRequest {
  origin: Waypoint;
  destination: Waypoint;
  travelMode: TravelMode;
  strategy: RouteStrategy;
  maxSnapDistanceLocal?: number;
}

export interface RoutePlan {
  travelMode: TravelMode;
  strategy: RouteStrategy;
  distanceLocal: number;
  durationSeconds: number;
  geometryWkt: string;
  originSnap: SnappedPoint;
  destinationSnap: SnappedPoint;
  networkVersion: number;
}

export interface RouteLeg {
  fromStopIndex: number;
  toStopIndex: number;
  distanceLocal: number;
  durationSeconds: number;
  geometryWkt: string;
}

export interface TourRequest {
  stops: Waypoint[];
  travelMode: TravelMode;
  strategy: RouteStrategy;
  roundTrip: boolean;
  fixedStartIndex: number;
  fixedEndIndex?: number;
  maxSnapDistanceLocal?: number;
}

export interface TourPlan {
  visitOrder: number[];
  travelMode: TravelMode;
  strategy: RouteStrategy;
  roundTrip: boolean;
  optimizedCost: number;
  optimizedCostUnit: "SECONDS" | "LOCAL_DISTANCE";
  totalDistanceLocal: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  snappedStops: SnappedPoint[];
  networkVersion: number;
}
