/** 导航接口 WKT 到 GeoJSON 的应用层转换。 */
type Position = [number, number];

function parsePosition(value: string): Position {
  const numbers = value.trim().split(/\s+/).map(Number);
  if (numbers.length < 2 || numbers.some((item) => !Number.isFinite(item))) {
    throw new Error(`无法解析路线坐标：${value}`);
  }
  return [numbers[0], numbers[1]];
}

function splitGroups(value: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") {
      if (depth === 0) start = index + 1;
      depth += 1;
    } else if (value[index] === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) groups.push(value.slice(start, index));
    }
  }
  return groups;
}

function parseLine(value: string): Position[] {
  return value.split(",").map(parsePosition);
}

export function lineWktToGeoJson(wkt: string): GeoJSON.FeatureCollection {
  const normalized = wkt.trim().replace(/^SRID=\d+;/i, "");
  if (/EMPTY$/i.test(normalized)) return { type: "FeatureCollection", features: [] };

  const type = normalized.slice(0, normalized.indexOf("(")).trim().toUpperCase();
  const body = normalized.slice(normalized.indexOf("("));
  let lines: Position[][];
  if (type === "LINESTRING") {
    lines = [parseLine(body.slice(1, -1))];
  } else if (type === "MULTILINESTRING") {
    lines = splitGroups(body.slice(1, -1)).map(parseLine);
  } else {
    throw new Error(`暂不支持的路线 WKT：${type}`);
  }

  return {
    type: "FeatureCollection",
    features: lines.filter((line) => line.length > 1).map((coordinates) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates }
    }))
  };
}
