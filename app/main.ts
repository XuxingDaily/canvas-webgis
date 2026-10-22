/** 导航业务应用入口；渲染库位于 ../src。 */
import "./styles.css";
import { searchNearbyPois, searchPois, searchViewportPois } from "./api/poi";
import { planRoute, planTour, snapToRoad } from "./api/routing";
import type { LocalPoint, Poi, RouteStrategy, TravelMode, Waypoint } from "./api/types";
import { StaticGeoJsonDataSource } from "./map/data/StaticGeoJsonDataSource";
import { VectorTileDataSource } from "./map/data/VectorTileDataSource";
import { CompositeMapDataSource } from "./map/data/CompositeMapDataSource";
import { STATIC_LAYER_CATALOG } from "./map/data/staticLayerCatalog";
import { FillSymbol, GeometryType, LineSymbol, SimpleRenderer } from "../src/index";
import { MAP_LAYER_CONTROLS, MapScene, ROUTE_COLOR, tourLegColor, type PoiMapTarget } from "./map/MapScene";
import { PoiAutocomplete } from "./ui/Autocomplete";
import { formatDistance, formatDuration, requiredNumber } from "./ui/format";

const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const selectValue = <T extends string>(id: string): T => (element<HTMLSelectElement>(id).value as T);

type PickMode = "route-origin" | "route-destination" | "tour-stop" | "poi-nearby" | null;

interface TourStop {
  label: string;
  detail: string;
  waypoint: Waypoint;
  location: LocalPoint;
  poiId?: number;
}

function coordinateLabel(point: LocalPoint): string {
  return `地图点 (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
}

function setLoading(button: HTMLButtonElement, loading: boolean, label: string): void {
  button.disabled = loading;
  button.dataset.defaultLabel ??= button.textContent ?? label;
  button.textContent = loading ? label : button.dataset.defaultLabel;
}

function resultCard(id: string, html: string, isError = false): void {
  const card = element(id);
  card.classList.remove("empty");
  card.classList.toggle("error", isError);
  card.innerHTML = html;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] as string);
}

function showToast(message: string, isError = false): void {
  const toast = element("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function renderRouteLegend(items: Array<{ color: string; label: string }> = []): void {
  const container = element("route-legend-items");
  container.replaceChildren();
  items.forEach((item) => {
    const row = document.createElement("span");
    row.className = "route-legend-item";
    const line = document.createElement("i");
    line.className = "legend-line";
    line.style.backgroundColor = item.color;
    const label = document.createElement("em");
    label.textContent = item.label;
    row.append(line, label);
    container.appendChild(row);
  });
}

function setupLayerManager(scene: MapScene): void {
  const container = element("layer-controls");

  (["基础地图", "业务图层"] as const).forEach((groupName) => {
    const group = document.createElement("section");
    group.className = "layer-control-group";
    const heading = document.createElement("strong");
    heading.textContent = groupName;
    group.appendChild(heading);

    MAP_LAYER_CONTROLS.filter((control) => control.group === groupName).forEach((control) => {
      const label = document.createElement("label");
      label.className = "layer-control";
      const text = document.createElement("span");
      text.textContent = control.label;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.addEventListener("change", () => scene.setLayerVisible(control.id, input.checked));
      label.append(text, input);
      group.appendChild(label);
    });
    container.appendChild(group);
  });
}

function hideFeatureDetail(): void {
  element<HTMLElement>("feature-detail").hidden = true;
}

function showFeatureDetail(
  type: string,
  title: string,
  rows: Array<[string, string]>,
  pois: Poi[] = []
): void {
  element("feature-detail-type").textContent = type;
  element("feature-detail-title").textContent = title;
  const body = element("feature-detail-body");
  body.replaceChildren();

  rows.forEach(([label, value]) => {
    const row = document.createElement("dl");
    row.className = "detail-row";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    row.append(term, description);
    body.appendChild(row);
  });

  if (pois.length) {
    const list = document.createElement("ol");
    list.className = "detail-poi-list";
    pois.forEach((poi) => {
      const item = document.createElement("li");
      item.textContent = poi.name;
      list.appendChild(item);
    });
    body.appendChild(list);
  }
  element<HTMLElement>("feature-detail").hidden = false;
}

function showPoiDetail(poi: Poi): void {
  showFeatureDetail("SELECTED POI", poi.name, [
    ["POI ID", String(poi.id)],
    ["坐标", `${poi.location.x.toFixed(3)}, ${poi.location.y.toFixed(3)}`],
    ["说明", poi.context || "暂无说明"],
    ["数据版本", String(poi.dataVersion ?? "-")]
  ]);
  const action = document.createElement("button");
  action.type = "button";
  action.className = "detail-action";
  action.textContent = "查询此 POI 附近";
  action.addEventListener("click", () => {
    element<HTMLInputElement>("local-x").value = String(poi.location.x);
    element<HTMLInputElement>("local-y").value = String(poi.location.y);
    document.querySelector<HTMLButtonElement>('.tab[data-panel="poi-panel"]')?.click();
    element<HTMLButtonElement>("nearby-search").click();
  });
  element("feature-detail-body").appendChild(action);
}

function showPoiTargetDetail(target: PoiMapTarget): void {
  if (target.kind === "poi") return showPoiDetail(target.pois[0]);
  showFeatureDetail("SELECTED CLUSTER", `${target.pois.length} 个聚合 POI`, [
    ["中心", `${target.center.x.toFixed(3)}, ${target.center.y.toFixed(3)}`],
    ["状态", "缩放地图可拆分聚类，列表展示当前聚合成员"]
  ], target.pois);
}

async function bootstrap(): Promise<void> {
  const vectorLayerNames = new Set([
    "公园绿地",
    "行政边界",
    "外围水面",
    "内部水面",
    "生活区",
    "教学区",
    "快速道路",
    "道路"
  ]);
  const mapDataSource = new CompositeMapDataSource([
    // 高校名称暂留 GeoJSON，以继续使用原有的碰撞检测文字标注。
    new StaticGeoJsonDataSource(vectorLayerNames),
    new VectorTileDataSource({
      urlTemplate: "/api/v1/map/tiles/base/{z}/{x}/{y}.mvt",
      layers: [
        { name: "公园绿地", sourceLayer: "park", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(0.5, "#dce8d2", "#dce8d2")) },
        { name: "行政边界", sourceLayer: "boundary", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(1, "#ccd5c1", "#eef1e7")) },
        { name: "外围水面", sourceLayer: "water", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(0.5, "#dceff3", "#dceff3")) },
        { name: "内部水面", sourceLayer: "water_detail", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(1, "#9ed4de", "#9ed4de")) },
        { name: "生活区", sourceLayer: "residential", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(0.6, "#eadcc3", "#f3ead8")), minZoom: 3 },
        { name: "教学区", sourceLayer: "study_area", renderer: new SimpleRenderer(GeometryType.Polygon, new FillSymbol(0.6, "#cbd1da", "#dde1e7")), minZoom: 2 },
        { name: "快速道路", sourceLayer: "highway", renderer: new SimpleRenderer(GeometryType.Polyline, new LineSymbol(4, "#d48772")), minZoom: 2 },
        { name: "道路", sourceLayer: "road", renderer: new SimpleRenderer(GeometryType.Polyline, new LineSymbol(2.5, "#ffffff")), minZoom: 2 }
      ],
      cacheSize: 128
    })
  ], STATIC_LAYER_CATALOG.map((layer) => layer.name));

  const scene = await MapScene.create("map", mapDataSource);
  setupLayerManager(scene);
  element("system-status").textContent = "组合矢量瓦片已启用";

  let pickMode: PickMode = null;
  let originPoint: LocalPoint | null = null;
  let destinationPoint: LocalPoint | null = null;
  const tourStops: TourStop[] = [];
  let viewportTimer: number | undefined;
  let lastViewportKey = "";
  let viewportRequestToken = 0;

  const loadViewportPois = async (viewport = scene.getViewport()): Promise<void> => {
    const key = viewport.map((value) => value.toFixed(2)).join(",");
    if (key === lastViewportKey) return;
    lastViewportKey = key;
    const token = ++viewportRequestToken;
    element("viewport-poi-status").textContent = "POI 加载中";
    try {
      const result = await searchViewportPois(viewport, 10000);
      if (token !== viewportRequestToken) return;
      await scene.showPois(result.items);
      element("viewport-poi-status").textContent = `${result.count} POI · 视口聚类`;
    } catch (error) {
      if (token !== viewportRequestToken) return;
      element("viewport-poi-status").textContent = "POI 加载失败";
      console.error(error);
    }
  };

  const scheduleViewportPois = (viewport: [number, number, number, number]): void => {
    window.clearTimeout(viewportTimer);
    viewportTimer = window.setTimeout((): void => {
      void loadViewportPois(viewport);
    }, 280);
  };

  const useQueryPoiLayer = (): void => {
    viewportRequestToken += 1;
  };

  const setPickMode = (mode: PickMode): void => {
    pickMode = pickMode === mode ? null : mode;
    document.querySelector(".map-stage")?.classList.toggle("picking", pickMode !== null);
    document.querySelectorAll(".pick-button").forEach((button) => button.classList.remove("active"));
    const activeButton = pickMode && element<HTMLElement>({
      "route-origin": "pick-route-origin",
      "route-destination": "pick-route-destination",
      "tour-stop": "pick-tour-stop",
      "poi-nearby": "pick-nearby-center"
    }[pickMode]);
    activeButton?.classList.add("active");
  };

  scene.onViewportChange(scheduleViewportPois);
  element("feature-detail-close").addEventListener("click", () => {
    scene.clearPoiSelection();
    hideFeatureDetail();
  });

  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      element(tab.dataset.panel as string).classList.add("active");
      setPickMode(null);
    });
  });

  const origin = new PoiAutocomplete(
    element<HTMLInputElement>("route-origin"),
    document.querySelector('[data-autocomplete="route-origin"]') as HTMLElement
  );
  const destination = new PoiAutocomplete(
    element<HTMLInputElement>("route-destination"),
    document.querySelector('[data-autocomplete="route-destination"]') as HTMLElement
  );
  const tourSearch = new PoiAutocomplete(
    element<HTMLInputElement>("tour-stop"),
    document.querySelector('[data-autocomplete="tour-stop"]') as HTMLElement
  );

  const showRouteDraft = (): Promise<void> => {
    const points: LocalPoint[] = [];
    const labels: string[] = [];
    const originLocation = originPoint ?? origin.value?.location;
    const destinationLocation = destinationPoint ?? destination.value?.location;
    if (originLocation) {
      points.push(originLocation);
      labels.push("起");
    }
    if (destinationLocation) {
      points.push(destinationLocation);
      labels.push("终");
    }
    return scene.showDraftPoints(points, labels);
  };

  const showTourDraft = (): Promise<void> => scene.showDraftPoints(
    tourStops.map((stop) => stop.location),
    tourStops.map((_, index) => String(index + 1))
  );

  origin.input.addEventListener("input", () => {
    if (originPoint) originPoint = null;
  });
  destination.input.addEventListener("input", () => {
    if (destinationPoint) destinationPoint = null;
  });

  element("swap-route").addEventListener("click", () => {
    const previousPoi = origin.value;
    const previousPoint = originPoint;
    origin.setValue(destination.value);
    destination.setValue(previousPoi);
    originPoint = destinationPoint;
    destinationPoint = previousPoint;
    if (originPoint) origin.input.value = coordinateLabel(originPoint);
    if (destinationPoint) destination.input.value = coordinateLabel(destinationPoint);
    void showRouteDraft();
  });

  element("route-submit").addEventListener("click", async () => {
    const button = element<HTMLButtonElement>("route-submit");
    const originWaypoint: Waypoint | null = originPoint
      ? { point: originPoint }
      : origin.value ? { poiId: origin.value.id } : null;
    const destinationWaypoint: Waypoint | null = destinationPoint
      ? { point: destinationPoint }
      : destination.value ? { poiId: destination.value.id } : null;
    if (!originWaypoint || !destinationWaypoint) return showToast("请搜索或在地图上点选起点和终点", true);
    setLoading(button, true, "正在计算…");
    try {
      const route = await planRoute({
        origin: originWaypoint,
        destination: destinationWaypoint,
        travelMode: selectValue<TravelMode>("route-mode"),
        strategy: selectValue<RouteStrategy>("route-strategy"),
        maxSnapDistanceLocal: 100
      });
      await scene.showRoute(route);
      renderRouteLegend([{ color: ROUTE_COLOR, label: "起点 → 终点" }]);
      resultCard("route-result", `
        <div class="result-metrics">
          <span><strong>${formatDistance(route.distanceLocal)}</strong><small>路线长度</small></span>
          <span><strong>${formatDuration(route.durationSeconds)}</strong><small>预计耗时</small></span>
        </div>
        <p>路网版本 ${route.networkVersion} · 起终点均已吸附到道路</p>
      `);
    } catch (error) {
      resultCard("route-result", `<strong>规划失败</strong><p>${escapeHtml((error as Error).message)}</p>`, true);
    } finally {
      setLoading(button, false, "开始规划");
    }
  });

  const renderTourStops = (): void => {
    const list = element<HTMLOListElement>("tour-stops");
    list.replaceChildren();
    tourStops.forEach((stop, index) => {
      const item = document.createElement("li");
      const order = document.createElement("span");
      order.className = "stop-order";
      order.textContent = String(index + 1).padStart(2, "0");
      const text = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = stop.label;
      const context = document.createElement("small");
      context.textContent = stop.detail;
      text.append(name, context);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "移除";
      remove.addEventListener("click", () => {
        tourStops.splice(index, 1);
        renderTourStops();
        void showTourDraft();
      });
      item.append(order, text, remove);
      list.appendChild(item);
    });
  };

  element("tour-add").addEventListener("click", () => {
    const poi = tourSearch.value;
    if (!poi) return showToast("请先从搜索结果中选择一个 POI", true);
    if (tourStops.some((item) => item.poiId === poi.id)) return showToast("该地点已经在游览列表中", true);
    if (tourStops.length >= 12) return showToast("最多添加 12 个游览点", true);
    tourStops.push({
      label: poi.name,
      detail: poi.context || `POI ${poi.id}`,
      waypoint: { poiId: poi.id },
      location: poi.location,
      poiId: poi.id
    });
    tourSearch.clear();
    renderTourStops();
    void showTourDraft();
  });

  element("pick-route-origin").addEventListener("click", () => setPickMode("route-origin"));
  element("pick-route-destination").addEventListener("click", () => setPickMode("route-destination"));
  element("pick-tour-stop").addEventListener("click", () => setPickMode("tour-stop"));
  element("pick-nearby-center").addEventListener("click", () => setPickMode("poi-nearby"));

  scene.onMapClick((point) => {
    if (!pickMode) {
      const target = scene.pickPoi(point);
      if (target) {
        void scene.selectPois(target.pois);
        showPoiTargetDetail(target);
      } else {
        scene.clearPoiSelection();
        hideFeatureDetail();
      }
      return;
    }
    if (pickMode === "route-origin") {
      origin.clear();
      originPoint = point;
      origin.input.value = coordinateLabel(point);
      void showRouteDraft();
      void scene.selectPoint(point, "起");
      showFeatureDetail("SELECTED POINT", "路线起点", [
        ["坐标", `${point.x.toFixed(3)}, ${point.y.toFixed(3)}`],
        ["用途", "规划时将先吸附到可通行道路"]
      ]);
    } else if (pickMode === "route-destination") {
      destination.clear();
      destinationPoint = point;
      destination.input.value = coordinateLabel(point);
      void showRouteDraft();
      void scene.selectPoint(point, "终");
      showFeatureDetail("SELECTED POINT", "路线终点", [
        ["坐标", `${point.x.toFixed(3)}, ${point.y.toFixed(3)}`],
        ["用途", "规划时将先吸附到可通行道路"]
      ]);
    } else if (pickMode === "tour-stop") {
      if (tourStops.length >= 12) {
        showToast("最多添加 12 个游览点", true);
      } else {
        const number = tourStops.filter((stop) => !stop.poiId).length + 1;
        tourStops.push({
          label: `地图点 ${number}`,
          detail: `${point.x.toFixed(2)}, ${point.y.toFixed(2)}`,
          waypoint: { point },
          location: point
        });
        renderTourStops();
        void showTourDraft();
        void scene.selectPoint(point, String(tourStops.length));
        showFeatureDetail("SELECTED POINT", `游览点 ${tourStops.length}`, [
          ["坐标", `${point.x.toFixed(3)}, ${point.y.toFixed(3)}`],
          ["用途", "参与多点访问顺序优化"]
        ]);
      }
    } else {
      element<HTMLInputElement>("local-x").value = point.x.toFixed(6);
      element<HTMLInputElement>("local-y").value = point.y.toFixed(6);
      void scene.selectPoint(point, "查");
      showFeatureDetail("SELECTED QUERY POINT", "附近查询中心", [
        ["坐标", `${point.x.toFixed(3)}, ${point.y.toFixed(3)}`],
        ["状态", "调整半径和最大数量后点击“查询附近 POI”"]
      ]);
      showToast("已设置附近 POI 查询中心");
    }
    setPickMode(null);
  });

  element("tour-submit").addEventListener("click", async () => {
    const button = element<HTMLButtonElement>("tour-submit");
    if (tourStops.length < 2) return showToast("至少添加两个游览点", true);
    setLoading(button, true, "正在优化…");
    try {
      const tour = await planTour({
        stops: tourStops.map((stop) => stop.waypoint),
        travelMode: selectValue<TravelMode>("tour-mode"),
        strategy: selectValue<RouteStrategy>("tour-strategy"),
        roundTrip: element<HTMLInputElement>("tour-round-trip").checked,
        fixedStartIndex: 0,
        maxSnapDistanceLocal: 100
      });
      await scene.showTour(tour);
      renderRouteLegend(tour.legs.map((leg, index) => ({
        color: tourLegColor(index),
        label: `${tourStops[leg.fromStopIndex]?.label ?? `#${leg.fromStopIndex}`} → ${tourStops[leg.toStopIndex]?.label ?? `#${leg.toStopIndex}`}`
      })));
      const routeNames = escapeHtml(tour.visitOrder.map((index) => tourStops[index]?.label ?? `#${index}`).join(" → "));
      resultCard("tour-result", `
        <strong class="route-order">${routeNames}</strong>
        <div class="result-metrics">
          <span><strong>${formatDistance(tour.totalDistanceLocal)}</strong><small>总长度</small></span>
          <span><strong>${formatDuration(tour.totalDurationSeconds)}</strong><small>总耗时</small></span>
        </div>
        <p>${tour.legs.length} 段路线 · 路网版本 ${tour.networkVersion}</p>
      `);
    } catch (error) {
      resultCard("tour-result", `<strong>优化失败</strong><p>${escapeHtml((error as Error).message)}</p>`, true);
    } finally {
      setLoading(button, false, "优化游览顺序");
    }
  });

  const renderPoiList = (pois: Poi[]): void => {
    const container = element("poi-results");
    container.replaceChildren();
    pois.forEach((poi) => {
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("strong");
      name.textContent = poi.name;
      const description = document.createElement("span");
      description.textContent = poi.context || `${poi.location.x.toFixed(1)}, ${poi.location.y.toFixed(1)}`;
      button.append(name, description);
      button.addEventListener("click", () => {
        void scene.selectPois([poi]);
        showPoiDetail(poi);
      });
      container.appendChild(button);
    });
  };

  element("poi-search").addEventListener("click", async () => {
    try {
      const result = await searchPois(element<HTMLInputElement>("poi-keyword").value.trim(), 30);
      useQueryPoiLayer();
      renderPoiList(result.items);
      await scene.showPois(result.items);
      if (result.items.length === 1) {
        await scene.selectPois(result.items);
        showPoiDetail(result.items[0]);
      }
      if (!result.items.length) showToast("没有匹配的 POI");
    } catch (error) {
      showToast((error as Error).message, true);
    }
  });

  element("nearby-search").addEventListener("click", async () => {
    try {
      const x = requiredNumber("local-x");
      const y = requiredNumber("local-y");
      const radius = requiredNumber("nearby-radius");
      const limit = requiredNumber("nearby-limit");
      if (radius <= 0) throw new Error("查询半径必须大于 0");
      if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("最大返回数量必须是 1～10000 的整数");
      const result = await searchNearbyPois(x, y, radius, limit);
      useQueryPoiLayer();
      renderPoiList(result.items);
      await scene.showPois(result.items);
      await scene.selectPois(result.items);
      await scene.selectPoint({ x, y }, "查", true);
      showFeatureDetail("SELECTED QUERY POINT", "附近查询中心", [
        ["坐标", `${x.toFixed(3)}, ${y.toFixed(3)}`],
        ["查询半径", `${radius} 局部单位`],
        ["返回结果", `${result.count} / ${limit} 个`]
      ]);
      resultCard("poi-tool-result", `<strong>找到 ${result.count} 个附近 POI</strong><p>查询中心：${x.toFixed(2)}, ${y.toFixed(2)} · 半径：${radius} 局部单位 · 最大 ${limit} 个</p>`);
    } catch (error) {
      resultCard("poi-tool-result", `<strong>查询失败</strong><p>${escapeHtml((error as Error).message)}</p>`, true);
    }
  });

  element("snap-search").addEventListener("click", async () => {
    try {
      const original = { x: requiredNumber("local-x"), y: requiredNumber("local-y") };
      const snapped = await snapToRoad(original, "WALKING", 100);
      await scene.showSnap(original, snapped.snappedPoint);
      await scene.selectPoint(snapped.snappedPoint, "吸");
      showFeatureDetail("SELECTED SNAP POINT", `道路 ${snapped.edgeId}`, [
        ["吸附坐标", `${snapped.snappedPoint.x.toFixed(3)}, ${snapped.snappedPoint.y.toFixed(3)}`],
        ["原点距离", snapped.distanceLocal.toFixed(3)],
        ["道路位置", snapped.fraction.toFixed(6)],
        ["路网版本", String(snapped.networkVersion)]
      ]);
      resultCard("poi-tool-result", `
        <strong>已吸附到道路 ${snapped.edgeId}</strong>
        <p>距离 ${snapped.distanceLocal.toFixed(2)} · fraction ${snapped.fraction.toFixed(5)}</p>
      `);
    } catch (error) {
      resultCard("poi-tool-result", `<strong>吸附失败</strong><p>${escapeHtml((error as Error).message)}</p>`, true);
    }
  });

  element("clear-map").addEventListener("click", () => {
    scene.clearResults();
    renderRouteLegend();
    hideFeatureDetail();
  });

  await loadViewportPois();
}

bootstrap().catch((error) => {
  element("system-status").textContent = "地图加载失败";
  showToast((error as Error).message, true);
  console.error(error);
});
