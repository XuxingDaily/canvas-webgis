/** POI 业务接口。 */
import { request, toQuery } from "./http";
import type { Poi, PoiList } from "./types";

const BASE_URL = "/api/v1/pois";

export function searchPois(keyword: string, limit = 20, signal?: AbortSignal): Promise<PoiList> {
  return request<PoiList>(`${BASE_URL}?${toQuery({ keyword, limit })}`, { signal });
}

export function searchNearbyPois(x: number, y: number, radius = 500, limit = 30): Promise<PoiList> {
  return request<PoiList>(`${BASE_URL}/nearby?${toQuery({ x, y, radius, limit })}`);
}

export function searchViewportPois(
  viewport: [number, number, number, number],
  limit = 10000,
  signal?: AbortSignal
): Promise<PoiList> {
  const query = new URLSearchParams();
  viewport.forEach((coordinate) => query.append("viewport", String(coordinate)));
  query.set("limit", String(limit));
  return request<PoiList>(`${BASE_URL}/viewport?${query.toString()}`, { signal });
}

export function getPoi(id: number): Promise<Poi> {
  return request<Poi>(`${BASE_URL}/${id}`);
}
