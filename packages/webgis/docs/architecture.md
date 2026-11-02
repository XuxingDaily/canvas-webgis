# WebGIS 渲染库架构与模块

## 1. 范围与目标

仓库包含两个边界明确的部分：

```text
nav-map-sys-front/
├── packages/webgis/    可独立构建的 Canvas WebGIS 渲染库
└── apps/navigation/    广州导航业务应用
```

渲染库负责空间模型、要素组织、样式选择、图层调度、坐标变换、Canvas 绘制和地图交互；
业务应用负责 HTTP、POI/路线状态、页面 UI 和具体数据源装配。

## 2. 分层和依赖方向

```text
app（业务应用）
  │
  ▼
Map / Layer / Source ───────────────┐
  │                                 │
  ▼                                 ▼
Feature / Geometry / Style     Canvas Renderer
  ▲                                 ▲
  │                                 │
Format Adapter                  Label / Collision
```

依赖规则：

- Geometry 不依赖 Canvas、DOM、图层或外部数据格式；
- Feature 不依赖 Layer 和网络；
- Style 只表达符号参数和 Feature→Symbol 策略；
- Format Adapter 只做外部格式到领域对象的转换；
- Layer 组合数据源、样式和绘制后端；
- Map 作为门面协调 View、Layer、Renderer 和 Interaction；
- 导航应用只依赖 `@zhaolong/canvas-webgis`；渲染库不依赖导航应用。

## 3. 模块职责

### `core/geometry`

二维空间领域模型，包含 Point、Polyline、Polygon、Multi* 和 Extent。负责范围、中心、长度、
面积等纯计算，不知道屏幕尺寸、Canvas 或投影。

### `core/feature`

`Feature` 将 Geometry 与属性结合；`FeatureClass` 定义已物化同步集合的查询契约。
`ArrayFeatureClass` 面向小数据和编辑，`RTreeFeatureClass` 面向大量数据的范围检索。

### `core/style`

Symbol 是纯样式参数；Renderer 决定每个 Feature 使用哪个 Symbol。绘制行为全部在 Canvas painter，
避免数据、表达策略和绘制设备耦合。

### `core/label`

Label 读取字段值并调用 CanvasLabelPainter。Collision 在屏幕空间选择可绘制标注及其候选方位。

### `core/layer`

Layer 是地图绘制调度单元：

- FeatureLayer：本地已物化要素；
- VectorTileLayer：异步 MVT；
- RasterTileLayer：异步图片瓦片。

Layer 通过 invalidate 回调通知 Map 安排下一帧，不反向持有 Map。

### `core/tile`

LocalTileGrid 定义局部平面瓦片金字塔；Source 负责请求、解码、并发去重、失败退避和缓存；Layer
负责根据当前视口决定需要哪些瓦片并进行绘制。

### `core/view`

View 使用 DOMMatrix 保存局部坐标到屏幕坐标的仿射变换，负责 fit、pan、锚点缩放和正反转换。

### `core/interaction` 与 `core/events`

InteractionController 将 DOM 输入转换成 View 操作和地图语义回调；MapEventEmitter 提供类型安全订阅。

### `format`

FeatureAdapter 是可泛化输入和输出的格式扩展接口。GeoJsonAdapter 将 FeatureCollection 转换为
带字段元数据的 `AdaptedFeatureSet`；MvtAdapter 将 Protobuf、瓦片坐标和局部网格转换为按
source layer 分组的 `DecodedVectorTile`，并负责区分 Polygon 外环、洞和 MultiPolygon。

### `render/canvas`

CanvasMapRenderer 负责一帧合成；CanvasVectorPainter 负责几何绘制与拾取；
CanvasLabelPainter 负责文字量算和绘制。

## 4. 一帧地图的流程

```text
鼠标/滚轮/窗口变化
        │
        ▼
InteractionController 修改 View
        │ onViewChange
        ▼
Map.redraw 合并到 requestAnimationFrame
        │
        ├── 更新 viewExtent / center
        ├── 发送 extent 事件
        ▼
CanvasMapRenderer.render
        │
        ├── 清屏并设置 View.transform
        ├── Layer.draw（按集合顺序）
        └── FeatureLayer.drawLabel（标注最后合成）
```

同一浏览器帧中的多次交互只安排一次绘制，绘制时始终读取最新 View。

## 5. 本地要素渲染流程

```text
GeoJSON
  → GeoJsonAdapter
  → ArrayFeatureClass / RTreeFeatureClass
  → FeatureLayer
  → Renderer.getSymbol(feature)
  → CanvasVectorPainter
```

FeatureClass.query 先执行视口筛选；Painter 再检查 Geometry 与视口相交并绘制。R-tree 只改变候选
检索方式，不改变 FeatureLayer 和 Renderer API。

## 6. MVT 流程

```text
viewExtent + Canvas scale
  → LocalTileGrid 选择 z/x/y
  → VectorTileSource 查 LRU / 合并并发请求
  → VectorTileLoader fetch / HTTP 状态 / AbortSignal
  → MvtAdapter protobuf 解码 + MVT tile coordinate 转局部坐标
  → Map<sourceLayer, Feature[]>
  → VectorTileLayer 选择命名图层并绘制
```

多个 VectorTileLayer 共享 Source，避免同一组合瓦片被重复下载和解码。视口离开的请求会被取消；
新层级未就绪时，多边形图层可以临时绘制已缓存祖先瓦片。

## 7. 坐标与缩放约定

- 渲染库只处理二维平面坐标，不包含 CRS 或投影转换；
- 同一 Map 中所有 Layer 必须处于同一坐标空间；
- Canvas transform 表示“局部坐标 → 屏幕像素”；
- Extent 对外始终用 `ymax, ymin, xmin, xmax` 构造；
- LocalTileGrid 原点位于完整正方形范围左上角，x 向右，y 向下编号瓦片；
- 逻辑 zoom 每增加 1，屏幕比例扩大 2 倍。

## 8. 扩展点

| 需求 | 扩展接口 |
| --- | --- |
| 新数据格式 | 实现 `FeatureAdapter<T>` |
| 新的要素存储/索引 | 继承 `FeatureClass`，按需实现 `MutableFeatureClass` |
| 新的专题表达 | 继承 `Renderer` |
| 新标注避让算法 | 继承 `Collision` |
| 新图层类型或异步数据源 | 继承 `Layer` |
| 新绘制设备 | 新建 render 后端，并保持 Geometry/Feature/Style 不感知设备 |

## 9. 公共与内部边界

公共类型只从 `src/index.ts` 导出。内部实现可以重构，只要公共构造器、属性、方法和行为契约不变。
新增公共能力时应同时完成：

1. 在所属模块 `index.ts` 导出；
2. 在根 `src/index.ts` 导出；
3. 更新 API Reference 和至少一个使用案例；
4. 添加覆盖公共行为的测试；
5. 若有不兼容变化，记录迁移说明。

## 10. 当前限制

- 仅 Canvas 2D，无 WebGL/SVG 后端；
- 无内置投影转换和 CRS 元数据；
- GeoJSON 一次性物化到内存，不负责流式解析；
- Polygon 中心为当前实现的代表点，不保证位于复杂凹多边形内部；
- 标注避让是单帧贪心策略，不保证全局最优；
- 当前包尚未配置独立 npm library build 和声明文件发布流程。

