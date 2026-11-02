# 上手与使用案例

本文示例均只从 `@zhaolong/canvas-webgis` 包入口导入公共 API，不依赖内部文件路径。

## 1. 创建第一张地图

页面需要一个具有明确尺寸和定位上下文的容器：

```html
<div id="map"></div>
<style>
  #map {
    position: relative;
    width: 100%;
    height: 600px;
    overflow: hidden;
  }
</style>
```

读取 GeoJSON，创建要素集合、图层和地图：

```ts
import {
  FillSymbol,
  FeatureLayer,
  GeoJsonFeatureClassReader,
  GeometryType,
  Map,
  SimpleRenderer
} from "@zhaolong/canvas-webgis";

const data: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { name: "示例区域" },
    geometry: {
      type: "Polygon",
      coordinates: [[[0, 0], [100, 0], [100, 80], [0, 80], [0, 0]]]
    }
  }]
};

const featureClass = new GeoJsonFeatureClassReader().read(data, {
  name: "区域",
  geometryType: GeometryType.Polygon,
  storage: "array"
});

const layer = new FeatureLayer(
  featureClass,
  new SimpleRenderer(
    GeometryType.Polygon,
    new FillSymbol(1.5, "#287271", "#9fc9c488")
  )
);
layer.name = "示例区域";

const map = new Map({
  target: "map",
  layers: [layer],
  zoom: 3,
  minZoom: 1,
  maxZoom: 18
});
```

`Map` 会创建并管理内部 Canvas，按全部图层范围适配初始视图，并自动绑定拖拽、滚轮缩放、
双击缩放和窗口尺寸变化。

## 2. GeoJSON 与存储策略

`GeoJsonFeatureClassReader` 支持 Point、LineString、Polygon、MultiPoint、
MultiLineString 和 MultiPolygon。`geometryType` 会过滤不同类型的要素。

少量数据或需要频繁编辑时使用数组存储：

```ts
const roads = reader.read(roadGeoJson, {
  geometryType: GeometryType.Polyline,
  storage: "array"
});
```

大量静态要素、频繁按视口查询时使用 packed R-tree：

```ts
const pois = reader.read(poiGeoJson, {
  name: "POI",
  geometryType: GeometryType.Point,
  storage: "rtree",
  maxEntries: 16
});
```

两种实现都提供 `getAll()`、`query(extent)`、`add()`、`remove()` 和 `clear()`。
R-tree 在写入后不会立即重建，而是在下一次读取范围或查询时延迟重建。

也可以直接创建领域对象：

```ts
import {
  ArrayFeatureClass,
  Feature,
  GeometryType,
  Point
} from "@zhaolong/canvas-webgis";

const featureClass = new ArrayFeatureClass(GeometryType.Point, {
  name: "采样点",
  features: [
    new Feature(new Point([10, 20]), { id: 1, level: "A" }),
    new Feature(new Point([30, 50]), { id: 2, level: "B" })
  ]
});
```

## 3. 点、线、面符号

```ts
import {
  FillSymbol,
  LetterSymbol,
  LineSymbol,
  PointSymbol
} from "@zhaolong/canvas-webgis";

const point = new PointSymbol(2, "#ffffff", "#3e8178", 8);
const labeledPoint = new LetterSymbol({
  lineWidth: 2,
  strokeStyle: "#ffffff",
  fillStyle: "#d95d39",
  letter: "起",
  radius: 12,
  fontColor: "#ffffff",
  fontSize: 11
});
const line = new LineSymbol(4, "#d95d39", [8, 4]);
const polygon = new FillSymbol(1, "#287271", "#9fc9c488");
```

所有线宽、点半径和文字大小以屏幕 CSS 像素表达，不随地图缩放而改变。

## 4. 单一、分类和分级渲染

### 4.1 单一符号

```ts
const renderer = new SimpleRenderer(
  GeometryType.Polyline,
  new LineSymbol(3, "#d95d39")
);
```

### 4.2 分类渲染

```ts
import {
  CategoryRenderer,
  CategoryRendererItem,
  Field,
  FieldDataType
} from "@zhaolong/canvas-webgis";

const roadType = new Field("road_type", FieldDataType.Text, "道路类型");
const renderer = new CategoryRenderer(roadType, [
  new CategoryRendererItem("motorway", new LineSymbol(5, "#d85b43")),
  new CategoryRendererItem("primary", new LineSymbol(3.5, "#e8b84f")),
  new CategoryRendererItem("residential", new LineSymbol(1.5, "#ffffff"))
]);
```

若分类很多，可从数据自动生成符号：

```ts
const renderer = CategoryRenderer.generate(featureClass, roadType);
```

未匹配值会按几何类型获得一个稳定的默认符号。

### 4.3 数值分级

```ts
import { ClassRenderer, Field, FieldDataType } from "@zhaolong/canvas-webgis";

const population = new Field("population", FieldDataType.Number, "人口");
const renderer = ClassRenderer.generate(featureClass, population, 5);
```

自动分级采用等间距分级。需要固定业务阈值时，应显式构造 `ClassRendererItem[]`。

## 5. 标注与避让

```ts
import {
  CoverCollision,
  Field,
  Label,
  TextSymbol
} from "@zhaolong/canvas-webgis";

const nameField = new Field("name");
const collision = new CoverCollision();
collision.buffer = 8;

layer.label = new Label({
  field: nameField,
  symbol: new TextSymbol({
    fontColor: "#173f3a",
    fillStyle: "#ffffffdd",
    strokeStyle: "#ffffff",
    fontSize: 12,
    placement: "BOTTOM",
    auto: true,
    pointSymbolWidth: 16,
    pointSymbolHeight: 16
  }),
  collision
});
layer.labeled = true;
map.redraw();
```

碰撞策略：

- `NullCollision`：绘制全部标注；
- `SimpleCollision`：按几何中心的屏幕距离快速去重，适合大量点；
- `CoverCollision`：按文字包围盒检测，并在 `auto=true` 时尝试下、右、上、左四个方位。

## 6. 地图事件和图层管理

```ts
const stopClick = map.on("click", ([x, y]) => {
  console.log("局部坐标", x, y);
});

const stopExtent = map.on("extent", () => {
  const view = map.getViewExtent();
  console.log([view.xmin, view.ymin, view.xmax, view.ymax]);
});

map.pushLayer(layer, false);          // false：保持当前视图
map.getLayerByName("示例区域");
map.removeLayerByName("示例区域", false);
map.redraw();

// 不再使用时解除订阅。
stopClick();
stopExtent();
```

动态图层的数据加载完成后，可调用 `map.requestRender()` 请求重绘而不触发 `extent` 事件。

## 7. MVT 矢量瓦片

多个 `VectorTileLayer` 应共享同一个 `VectorTileSource`。这样同一 z/x/y 中包含多个命名图层时，
只下载并解码一次。

内部链路由 `VectorTileLoader` 与 `MvtAdapter` 组成：Loader 负责 HTTP 请求和取消，Adapter
负责 Protobuf 解码、坐标转换和 Feature 创建。普通业务只需使用 Source；需要处理已有
ArrayBuffer 或替换解码策略时，可单独调用或注入 Adapter。

```ts
import {
  CategoryRenderer,
  CategoryRendererItem,
  Field,
  FillSymbol,
  GeometryType,
  LineSymbol,
  LocalTileGrid,
  SimpleRenderer,
  VectorTileLayer,
  VectorTileSource
} from "@zhaolong/canvas-webgis";

const grid = new LocalTileGrid({
  originX: 12550000,
  originY: 2800000,
  worldSpanLocal: 262144,
  tilePixels: 256,
  minZoom: 0,
  maxZoom: 18
});

const source = new VectorTileSource({
  urlTemplate: "/api/v1/map/tiles/base/{z}/{x}/{y}.mvt",
  grid,
  cacheSize: 128
});

const surface = new Field("surface_class");
const landcover = new VectorTileLayer({
  name: "土地覆盖",
  sourceLayer: "landcover",
  source,
  minZoom: 3,
  renderer: new CategoryRenderer(surface, [
    new CategoryRendererItem(
      "forest",
      new FillSymbol(0, "#a8c9a1", "#bdd7b5")
    )
  ])
});

const roads = new VectorTileLayer({
  name: "道路",
  sourceLayer: "road",
  source,
  minZoom: 2,
  renderer: new SimpleRenderer(
    GeometryType.Polyline,
    new LineSymbol(2, "#ffffff")
  )
});

const map = new Map({ target: "map", layers: [landcover, roads] });
```

`urlTemplate` 必须包含 `{z}`、`{x}`、`{y}`。MVT 内部坐标会通过同一个 `LocalTileGrid`
转换到本项目的局部平面坐标。

## 8. XYZ 栅格瓦片

```ts
import {
  LocalTileGrid,
  Map,
  RasterTileLayer,
  RasterTileSource
} from "@zhaolong/canvas-webgis";

const source = new RasterTileSource({
  urlTemplate: "https://example.com/tiles/{z}/{x}/{y}.png",
  grid,
  cacheSize: 128,
  crossOrigin: "anonymous"
});

const raster = new RasterTileLayer({
  name: "影像",
  source,
  opacity: 0.8,
  minZoom: 2,
  maxZoom: 18
});

const map = new Map({ target: "map", layers: [raster] });
```

远程服务必须允许相应的 CORS 请求。清理已缓存瓦片可调用 `raster.clearCache()`。

## 9. 高亮和要素可见性

```ts
const selected = featureClass.getAll()[0];
selected.highlighted = true;
map.redraw();

selected.visible = false;
map.redraw();
```

高亮由 Canvas painter 根据几何类型使用内置高亮样式绘制。若需要业务特定的选中样式，
建议将选中要素放入单独图层并配置独立 Renderer。

## 10. 自定义 Renderer

Renderer 只负责从 Feature 选择 Symbol：

```ts
import {
  Feature,
  PointSymbol,
  Renderer,
  Symbol
} from "@zhaolong/canvas-webgis";

class ConfidenceRenderer extends Renderer {
  getSymbol(feature: Feature): Symbol {
    const confidence = Number(feature.properties.confidence ?? 0);
    return confidence >= 0.8
      ? new PointSymbol(2, "#ffffff", "#287271", 8)
      : new PointSymbol(2, "#ffffff", "#d95d39", 6);
  }
}
```

Renderer 不应执行 Canvas 绘制、网络请求或修改 Feature。

## 11. 自定义格式适配器

```ts
import {
  AdaptedFeatureSet,
  Feature,
  FeatureAdapter,
  Field,
  FieldDataType,
  Point
} from "@zhaolong/canvas-webgis";

interface CsvPointRow {
  id: string;
  x: number;
  y: number;
  name: string;
}

class CsvPointAdapter implements FeatureAdapter<CsvPointRow[]> {
  adapt(rows: CsvPointRow[]): AdaptedFeatureSet {
    return {
      fields: [
        new Field("id", FieldDataType.Text),
        new Field("name", FieldDataType.Text)
      ],
      features: rows.map(row => new Feature(
        new Point([row.x, row.y]),
        { id: row.id, name: row.name }
      ))
    };
  }
}
```

Adapter 只负责格式转换，不负责请求数据或创建图层。

## 12. 自定义动态图层

继承 `Layer` 时需要实现范围和绘制逻辑；异步数据就绪后调用受保护的 `requestRender()`：

```ts
import { Extent, Layer } from "@zhaolong/canvas-webgis";

class GridLayer extends Layer {
  constructor(private readonly bounds: Extent) {
    super("调试网格", "显示固定间距的局部坐标网格");
  }

  get extent(): Extent {
    return this.bounds;
  }

  draw(ctx: CanvasRenderingContext2D, view: Extent, zoom: number): void {
    if (!this.visible || zoom < this.minZoom || zoom > this.maxZoom) return;
    ctx.save();
    ctx.strokeStyle = "#718096";
    ctx.lineWidth = 1 / Math.abs(ctx.getTransform().a);
    // 根据 view 计算并绘制网格；坐标仍使用地图局部坐标。
    ctx.restore();
  }

  notifyDataChanged(): void {
    this.requestRender();
  }
}
```

若自定义图层需要固定像素宽度，应像内置 Painter 一样切换到屏幕坐标后绘制。

## 13. 生命周期与清理

```ts
const unsubscribe = map.on("click", handleClick);

// 页面卸载时：
unsubscribe();
map.destroy();
```

`destroy()` 会取消待执行的渲染帧、解除 DOM/Window 监听器、解绑图层失效回调并移除 Canvas。
业务层自行创建的网络请求和定时器仍需由业务层取消。

