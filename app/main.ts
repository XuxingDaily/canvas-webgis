/** 导航业务应用入口；渲染库位于 ../src。 */
import "./styles.css";
import { searchNearbyPois, searchPois, searchViewportPois } from "./api/poi";
import { planRoute, planTour, snapToRoad } from "./api/routing";
import type { LocalPoint, Poi, RouteStrategy, TravelMode, Waypoint } from "./api/types";
import { VectorTileDataSource } from "./map/data/VectorTileDataSource";
import {
  CategoryRenderer,
  CategoryRendererItem,
  Field,
  FillSymbol,
  GeometryType,
  LineSymbol,
  SimpleRenderer
} from "../src/index";
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
  button.dataset.defaultHtml ??= button.innerHTML;
  if (loading) button.textContent = label;
  else button.innerHTML = button.dataset.defaultHtml;
}

function travelModeLabel(mode: TravelMode): string {
  return mode === "DRIVING" ? "驾车" : "步行";
}

function strategyLabel(strategy: RouteStrategy): string {
  return strategy === "SHORTEST" ? "距离优先" : "时间优先";
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
    ["源数据 ID", poi.sourceId || "-"],
    ["类别", poi.category || poi.basicCategory || "未分类"],
    ["基础类别", poi.basicCategory || "-"],
    ["地址", poi.address || "暂无地址"],
    ["置信度", poi.confidence == null ? "-" : poi.confidence.toFixed(3)],
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
  const surfaceClass = new Field("class");
  const landcoverRenderer = new CategoryRenderer(surfaceClass, [
    new CategoryRendererItem("forest", new FillSymbol(0, "#a8c9a1", "#bdd7b5")),
    new CategoryRendererItem("park", new FillSymbol(0, "#b8d5a5", "#cce2ba")),
    new CategoryRendererItem("residential", new FillSymbol(0, "#d8d5ce", "#e6e3dc")),
    new CategoryRendererItem("industrial", new FillSymbol(0, "#cfbfb4", "#ddd0c7")),
    new CategoryRendererItem("grass", new FillSymbol(0, "#cadcaf", "#dce8c8")),
    new CategoryRendererItem("farmland", new FillSymbol(0, "#d4cea8", "#e4dfbd")),
    new CategoryRendererItem("commercial", new FillSymbol(0, "#dcc7c1", "#ead9d1")),
    new CategoryRendererItem("meadow", new FillSymbol(0, "#c3d8a8", "#d6e5bf")),
    new CategoryRendererItem("retail", new FillSymbol(0, "#ddc0bd", "#ead0cd")),
    new CategoryRendererItem("orchard", new FillSymbol(0, "#c5cf9d", "#d7dfb2")),
    new CategoryRendererItem("military", new FillSymbol(0, "#d1adae", "#e3c4c2")),
    new CategoryRendererItem("scrub", new FillSymbol(0, "#b6c9a0", "#c9d8b5")),
    new CategoryRendererItem("recreation_ground", new FillSymbol(0, "#bad4b0", "#cfe4c6")),
    new CategoryRendererItem("cemetery", new FillSymbol(0, "#b1c8ad", "#c8dac1")),
    new CategoryRendererItem("farmyard", new FillSymbol(0, "#cec4a5", "#ded4b9")),
    new CategoryRendererItem("quarry", new FillSymbol(0, "#c4bdb2", "#d8d1c7")),
    new CategoryRendererItem("landfill", new FillSymbol(0, "#bdb7ad", "#d0c9c0")),
    new CategoryRendererItem("heath", new FillSymbol(0, "#c5bea2", "#d8d0b5"))
  ]);
  const waterRenderer = new CategoryRenderer(surfaceClass, [
    new CategoryRendererItem("water", new FillSymbol(0, "#9fc8dc", "#b8dbea")),
    new CategoryRendererItem("riverbank", new FillSymbol(0, "#92c1d8", "#acd5e6")),
    new CategoryRendererItem("reservoir", new FillSymbol(0, "#8fbdd2", "#a8d1e2")),
    new CategoryRendererItem("dock", new FillSymbol(0, "#86b4cb", "#a1cadc")),
    new CategoryRendererItem("wetland", new FillSymbol(0, "#9fc9c4", "#b8dbd4"))
  ]);
  const buildingRenderer = new SimpleRenderer(
    GeometryType.Polygon,
    new FillSymbol(0, "#b9ada0", "#d8cec2")
  );
  const parkingRenderer = new SimpleRenderer(
    GeometryType.Polygon,
    new FillSymbol(0, "#d2c9bb", "#ebe5da")
  );
  const boundaryRenderer = new SimpleRenderer(
    GeometryType.Polygon,
    new FillSymbol(0, "#7d8c89", "#f4f4ef")
  );
  const roadType = new Field("road_type");
  const roadRenderer = new CategoryRenderer(roadType, [
    new CategoryRendererItem("motorway", new LineSymbol(4.5, "#d85b43")),
    new CategoryRendererItem("motorway_link", new LineSymbol(3.5, "#e37b61")),
    new CategoryRendererItem("trunk", new LineSymbol(4, "#e28b42")),
    new CategoryRendererItem("trunk_link", new LineSymbol(3.2, "#efa65f")),
    new CategoryRendererItem("primary", new LineSymbol(3.5, "#e8b84f")),
    new CategoryRendererItem("primary_link", new LineSymbol(3, "#efc96d")),
    new CategoryRendererItem("secondary", new LineSymbol(3, "#f0d58a")),
    new CategoryRendererItem("secondary_link", new LineSymbol(2.6, "#f3dda0")),
    new CategoryRendererItem("tertiary", new LineSymbol(2.5, "#f4e6bc")),
    new CategoryRendererItem("tertiary_link", new LineSymbol(2.2, "#f6edcf")),
    new CategoryRendererItem("residential", new LineSymbol(1.7, "#ffffff")),
    new CategoryRendererItem("living_street", new LineSymbol(1.5, "#f4f6f3")),
    new CategoryRendererItem("service", new LineSymbol(1.2, "#dfe5df")),
    new CategoryRendererItem("unclassified", new LineSymbol(1.5, "#e9ede8")),
    new CategoryRendererItem("road", new LineSymbol(1.4, "#e7ebe6")),
    new CategoryRendererItem("motorway_junction", new LineSymbol(2.5, "#d85b43"))
  ]);
  const mapDataSource = new VectorTileDataSource({
    urlTemplate: "/api/v1/map/tiles/base/{z}/{x}/{y}.mvt",
    layers: [
      { name: "行政区域", sourceLayer: "boundary", renderer: boundaryRenderer, minZoom: 2 },
      { name: "行政区边界", sourceLayer: "boundary_outline", renderer: new SimpleRenderer(GeometryType.Polyline, new LineSymbol(1.2, "#7d8c89")), minZoom: 2 },
      { name: "土地覆盖", sourceLayer: "landcover", renderer: landcoverRenderer, minZoom: 3 },
      { name: "水面", sourceLayer: "water", renderer: waterRenderer, minZoom: 2 },
      { name: "建筑物", sourceLayer: "building", renderer: buildingRenderer, minZoom: 11 },
      { name: "停车区域", sourceLayer: "parking", renderer: parkingRenderer, minZoom: 13 },
      { name: "道路", sourceLayer: "road", renderer: roadRenderer, minZoom: 2 }
    ],
    cacheSize: 64
  });

  const scene = await MapScene.create("map", mapDataSource);
  setupLayerManager(scene);
  element("system-status").textContent = "广州市域矢量底图已就绪";

  let pickMode: PickMode = null;
  let originPoint: LocalPoint | null = null;
  let destinationPoint: LocalPoint | null = null;
  const tourStops: TourStop[] = [];
  let viewportTimer: number | undefined;
  let lastViewportKey = "";
  let viewportRequestToken = 0;
  let viewportAnalysisEnabled = false;
  let viewportAbortController: AbortController | undefined;
  const viewportToggle = element<HTMLInputElement>("viewport-poi-toggle");
  const viewportStatus = element("viewport-poi-status");

  const loadViewportPois = async (viewport = scene.getViewport()): Promise<void> => {
    if (!viewportAnalysisEnabled) return;
    const key = viewport.map((value) => value.toFixed(2)).join(",");
    if (key === lastViewportKey) return;
    const token = ++viewportRequestToken;
    viewportAbortController?.abort();
    const controller = new AbortController();
    viewportAbortController = controller;
    viewportStatus.textContent = "POI 分析中";
    try {
      const result = await searchViewportPois(viewport, 10000, controller.signal);
      if (!viewportAnalysisEnabled || token !== viewportRequestToken) return;
      lastViewportKey = key;
      await scene.showPois(result.items);
      viewportStatus.textContent = `${result.count} POI · 视口聚类`;
    } catch (error) {
      if (controller.signal.aborted || token !== viewportRequestToken) return;
      viewportStatus.textContent = "POI 分析失败";
      console.error(error);
    } finally {
      if (viewportAbortController === controller) viewportAbortController = undefined;
    }
  };

  const scheduleViewportPois = (viewport: [number, number, number, number]): void => {
    if (!viewportAnalysisEnabled) return;
    window.clearTimeout(viewportTimer);
    viewportAbortController?.abort();
    viewportRequestToken += 1;
    viewportStatus.textContent = "等待视口稳定";
    viewportTimer = window.setTimeout((): void => {
      void loadViewportPois(viewport);
    }, 280);
  };

  const useQueryPoiLayer = (): void => {
    window.clearTimeout(viewportTimer);
    viewportAbortController?.abort();
    viewportRequestToken += 1;
  };

  const setViewportAnalysisEnabled = async (enabled: boolean): Promise<void> => {
    viewportAnalysisEnabled = enabled;
    viewportToggle.checked = enabled;
    window.clearTimeout(viewportTimer);
    viewportAbortController?.abort();
    viewportAbortController = undefined;
    viewportRequestToken += 1;
    lastViewportKey = "";

    if (enabled) {
      viewportStatus.textContent = "POI 分析已开启";
      await loadViewportPois();
      return;
    }

    viewportStatus.textContent = "POI 分析已关闭";
    await scene.clearViewportPois();
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
  viewportToggle.addEventListener("change", () => {
    void setViewportAnalysisEnabled(viewportToggle.checked);
  });
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
        <div class="result-title"><span class="result-status-dot"></span><strong>路线已生成</strong><em>${travelModeLabel(route.travelMode)} · ${strategyLabel(route.strategy)}</em></div>
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
        <div class="result-title"><span class="result-status-dot"></span><strong>游览顺序已优化</strong><em>${travelModeLabel(tour.travelMode)} · ${strategyLabel(tour.strategy)}</em></div>
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

  await setViewportAnalysisEnabled(false);
}

bootstrap().catch((error) => {
  element("system-status").textContent = "地图加载失败";
  showToast((error as Error).message, true);
  console.error(error);
});
