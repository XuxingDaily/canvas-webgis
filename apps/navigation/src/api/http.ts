/** 导航业务 HTTP 客户端。 */
import type { ApiResult } from "./types";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  let payload: ApiResult<T> | undefined;
  try {
    payload = (await response.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`服务返回了无法解析的响应（HTTP ${response.status}）`, response.status);
  }

  if (!response.ok || payload.code !== 1) {
    throw new ApiError(payload.msg || `请求失败（HTTP ${response.status}）`, response.status);
  }
  return payload.data;
}

export function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}
