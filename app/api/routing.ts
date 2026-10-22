/** 路径规划业务接口。 */
import { request } from "./http";
import type { LocalPoint, RoutePlan, RouteRequest, SnappedPoint, TourPlan, TourRequest, TravelMode } from "./types";

const BASE_URL = "/api/v1/routing";

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`${BASE_URL}${path}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function snapToRoad(point: LocalPoint, travelMode: TravelMode = "WALKING", maxSnapDistanceLocal = 100): Promise<SnappedPoint> {
  return post<SnappedPoint>("/snap", { point, travelMode, maxSnapDistanceLocal });
}

export function planRoute(payload: RouteRequest): Promise<RoutePlan> {
  return post<RoutePlan>("/routes", payload);
}

export function planTour(payload: TourRequest): Promise<TourPlan> {
  return post<TourPlan>("/tours", payload);
}
