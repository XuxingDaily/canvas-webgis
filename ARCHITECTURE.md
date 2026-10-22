# WebGIS 前端架构

## 设计目标

- 领域模型不依赖 Canvas、网络请求或外部数据格式。
- 数据格式转换与要素存储是两个独立变化维度。
- 图层只依赖 FeatureClass 和样式策略，不了解具体存储结构。
- Canvas 只是一种绘制后端，后续可以增加 WebGL/SVG 实现。

## 依赖方向

```text
app / application
        ↓
map / layer / source
        ↓
feature / geometry / style

format adapters ─────→ feature / geometry
canvas renderer ─────→ feature / geometry / style
tile infrastructure ─→ format adapters / feature
```

禁止出现以下反向依赖：

- `geometry → canvas`
- `feature → layer`
- `feature → geojson/mvt`
- `style → map`
- `format adapter → layer`

## 目标目录

```text
app/                    # 导航业务应用，不属于渲染库公共 API
├── api/                # HTTP API 客户端与业务 DTO
├── map/                # MapScene、数据源装配与 WKT 转换
└── ui/                 # 页面交互组件

src/
├── core/
│   ├── geometry/       # Point、Polyline、Polygon 等纯空间模型
│   ├── feature/        # Feature、Field、FeatureClass 及存储实现
│   ├── style/          # Symbol 与 Feature→Symbol 策略
│   ├── layer/          # FeatureLayer、VectorTileLayer、RasterTileLayer
│   ├── tile/           # TileGrid、LRU 缓存及矢量/栅格 TileSource
│   ├── view/           # 视图状态与坐标变换
│   ├── interaction/    # 输入事件与拾取
│   └── map/            # Map 门面与 LayerCollection
├── format/
│   ├── geojson/        # GeoJSON Adapter
│   ├── mvt/            # MVT/Protobuf Adapter
│   └── wkt/            # WKT Adapter
├── render/
│   └── canvas/         # 地图合成、矢量绘制、标注绘制
└── index.ts            # 渲染库唯一公共入口
```

目录按职责与依赖方向组织，而不是机械地为每个类创建文件夹。

## Tile 子系统

```text
Layer
├── VectorTileLayer ──→ VectorTileSource ──→ MVT Feature[]
└── RasterTileLayer ──→ RasterTileSource ──→ HTMLImageElement

VectorTileSource ─┐
                  ├──→ LocalTileGrid + TileCache
RasterTileSource ─┘
```

图层负责视口调度与绘制，Source 负责异步加载、并发去重、失败退避和缓存；
Map 只管理统一的 Layer，不再为某一种瓦片类型提供特殊接口。

## Feature 子系统

```text
FeatureClass (abstract)
├── ArrayFeatureClass       # O(n) 线性范围查询
└── RTreeFeatureClass       # packed R-tree 范围查询

FeatureAdapter<TInput>
├── GeoJsonAdapter          # GeoJSON → Feature[] + Field[]
└── GeoJsonFeatureClassReader
    ├── ArrayFeatureClass
    └── RTreeFeatureClass
```

`format` 只负责外部格式到领域对象的转换；网络请求和 FeatureLayer 装配位于
`app/map/FeatureLayerFactory.ts`，不再由 `core/utils` 混合承担。

`FeatureClass` 表示已经物化到本地的同步要素集合。HTTP、MVT 瓦片流等异步能力属于
`Source`，不强行塞进 FeatureClass。

格式与存储可以自由组合：

```text
GeoJSON → GeoJsonAdapter → ArrayFeatureClass
GeoJSON → GeoJsonAdapter → RTreeFeatureClass
MVT     → MvtAdapter     → 按瓦片缓存的 Feature[]
```

## 渲染命名约定

- `Renderer`：选择表达策略，例如 `CategoryRenderer` 决定 Feature 使用哪个 Symbol。
- `Painter`：执行具体后端绘制，例如 Canvas 矢量和标注绘制。
- `MapRenderer`：负责一帧地图的清屏、变换和图层合成。

后续渲染模块收敛为：

```text
CanvasMapRenderer
├── CanvasVectorPainter
└── CanvasLabelPainter
```

`Symbol` 只保存颜色、线宽、半径、虚线和字体等样式参数，不包含 Canvas、
命中检测或资源加载行为；`Extent` 属于 geometry 空间模型，不属于 style。

## 迁移顺序

1. Feature/FeatureClass 与格式 Adapter（已完成）。
2. 合并 CanvasFeatureRenderer 与 CanvasGeometryRenderer，并统一 Painter 命名（已完成）。
3. 通过各模块 `index.ts` 与根入口稳定公共 API（已完成）。
4. 将 Symbol 收敛为纯样式参数，并将绘制行为归入 Painter（已完成）。
5. 将业务前端迁出 `src`，移除 `core/utils` 混合职责（已完成）。
6. 将 MVT 解码从网络 Loader 中提取为 MvtAdapter。
7. 补充自动化测试。
