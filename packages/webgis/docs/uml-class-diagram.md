# uml-class-diagram

本文展示 <code>@zhaolong/canvas-webgis</code> 的主要类关系。图中只保留理解架构所需的
公开类和关键依赖，构造参数、全部属性与方法签名请查看
[TypeDoc API](api-reference.md)。

关系说明：

- <code>&lt;|--</code>：继承；
- <code>&lt;|..</code>：实现接口；
- <code>*--</code>：组合，由拥有者管理生命周期；
- <code>o--</code>：聚合，可由外部创建并注入；
- <code>--&gt;</code> / <code>..&gt;</code>：调用或依赖。

## 1. 地图门面、图层与 Canvas 渲染

```mermaid
classDiagram
    class Map {
        +pushLayer(layer)
        +removeLayer(layer)
        +setView(zoom, extent)
        +redraw()
        +destroy()
    }
    class LayerCollection {
        +add(layer)
        +remove(layer)
        +moveToTop(index)
        +getExtent()
    }
    class View {
        +zoom
        +transform
        +fit(extent, size, zoom)
        +getExtent(size)
    }
    class InteractionController {
        +destroy()
    }
    class MapEventEmitter {
        +on(event, handler)
        +emit(event, payload)
    }
    class CanvasMapRenderer {
        +render(layers, transform, extent, zoom)
        +clear()
    }
    class Layer {
        <<abstract>>
        +name
        +visible
        +minZoom
        +maxZoom
        +extent
        +draw(ctx, extent, zoom)*
    }
    class FeatureLayer {
        +featureClass
        +renderer
        +label
        +drawLabel()
    }
    class VectorTileLayer {
        +clearCache()
    }
    class RasterTileLayer {
        +opacity
        +clearCache()
    }
    class CanvasVectorPainter {
        +drawFeature()
    }
    class Label {
        +field
        +symbol
        +collision
        +draw()
    }
    class VectorTileSource
    class RasterTileSource
    class FeatureClass
    class Renderer

    Map *-- LayerCollection
    Map *-- View
    Map *-- InteractionController
    Map *-- MapEventEmitter
    Map *-- CanvasMapRenderer
    LayerCollection o-- "0..*" Layer
    CanvasMapRenderer ..> Layer : 调度绘制
    InteractionController --> View : 更新变换

    Layer <|-- FeatureLayer
    Layer <|-- VectorTileLayer
    Layer <|-- RasterTileLayer
    FeatureLayer o-- FeatureClass
    FeatureLayer o-- Renderer
    FeatureLayer o-- Label
    FeatureLayer *-- CanvasVectorPainter
    VectorTileLayer o-- VectorTileSource
    VectorTileLayer o-- Renderer
    VectorTileLayer *-- CanvasVectorPainter
    RasterTileLayer o-- RasterTileSource
```

<code>Map</code> 是对外门面，负责协调视图、图层集合、Canvas 合成器、事件和交互。
具体图层只实现自己的绘制策略；地图在同一动画帧内合并多次重绘请求。

## 2. Geometry、Feature、Renderer 与 Label

```mermaid
classDiagram
    class Geometry {
        <<abstract>>
        +type
        +extent
        +intersect(extent)*
    }
    class Point
    class Polyline
    class Polygon
    class MultiPoint
    class MultiPolyline
    class MultiPolygon
    class Feature {
        +geometry
        +properties
        +visible
        +highlighted
        +intersect(extent)
    }
    class Field
    class FeatureClass {
        <<abstract>>
        +geometryType
        +fields
        +size
        +extent
        +getAll()*
        +query(extent)*
    }
    class MutableFeatureClass {
        <<interface>>
        +add(feature)
        +remove(feature)
        +clear()
    }
    class ArrayFeatureClass
    class RTreeFeatureClass
    class PackedRTree {
        +search(extent)
    }

    Geometry <|-- Point
    Geometry <|-- Polyline
    Geometry <|-- Polygon
    Geometry <|-- MultiPoint
    Geometry <|-- MultiPolyline
    Geometry <|-- MultiPolygon
    Feature *-- Geometry
    FeatureClass o-- "0..*" Feature
    FeatureClass o-- "0..*" Field
    FeatureClass <|-- ArrayFeatureClass
    FeatureClass <|-- RTreeFeatureClass
    MutableFeatureClass <|.. ArrayFeatureClass
    MutableFeatureClass <|.. RTreeFeatureClass
    RTreeFeatureClass *-- PackedRTree
```

```mermaid
classDiagram
    class Renderer {
        <<abstract>>
        +getSymbol(feature)*
    }
    class SimpleRenderer
    class CategoryRenderer
    class ClassRenderer
    class CategoryRendererItem
    class ClassRendererItem
    class Symbol
    class PointSymbol
    class LetterSymbol
    class LineSymbol
    class FillSymbol
    class TextSymbol
    class Label
    class Collision {
        <<abstract>>
        +test(features, field, symbol, ctx)*
    }
    class NullCollision
    class SimpleCollision
    class CoverCollision
    class CanvasLabelPainter

    Renderer <|-- SimpleRenderer
    Renderer <|-- CategoryRenderer
    Renderer <|-- ClassRenderer
    SimpleRenderer o-- Symbol
    CategoryRenderer o-- "1..*" CategoryRendererItem
    ClassRenderer o-- "1..*" ClassRendererItem
    CategoryRendererItem o-- Symbol
    ClassRendererItem o-- Symbol

    Symbol <|-- PointSymbol
    PointSymbol <|-- LetterSymbol
    Symbol <|-- LineSymbol
    Symbol <|-- FillSymbol
    Symbol <|-- TextSymbol

    Label o-- TextSymbol
    Label o-- Collision
    Label *-- CanvasLabelPainter
    Collision <|-- NullCollision
    Collision <|-- SimpleCollision
    Collision <|-- CoverCollision
```

<code>FeatureClass</code> 只规定查询契约。<code>ArrayFeatureClass</code> 使用线性扫描，
<code>RTreeFeatureClass</code> 使用 Packed R-tree；写操作后索引会在下一次查询时延迟重建。
Renderer 负责选择 Symbol，Canvas Painter 负责真正绘制，两者相互解耦。

## 3. Adapter、Loader、Source 与瓦片调度

```mermaid
classDiagram
    class FeatureAdapter {
        <<interface>>
        +adapt(input)
    }
    class GeoJsonAdapter
    class MvtAdapter
    class GeoJsonFeatureClassReader {
        +read(input, options)
    }
    class ArrayFeatureClass
    class RTreeFeatureClass
    class Feature
    class Geometry

    FeatureAdapter <|.. GeoJsonAdapter
    FeatureAdapter <|.. MvtAdapter
    GeoJsonFeatureClassReader *-- GeoJsonAdapter
    GeoJsonFeatureClassReader ..> ArrayFeatureClass : 创建
    GeoJsonFeatureClassReader ..> RTreeFeatureClass : 创建
    GeoJsonAdapter ..> Feature : 输出
    MvtAdapter ..> Feature : 按 source layer 输出
    Feature *-- Geometry
```

```mermaid
classDiagram
    class LocalTileGrid {
        +tilesForExtent(extent, z)
        +tileExtent(tile)
        +zoomForScale(scale)
        +key(tile)
    }
    class TileCache {
        +get(key)
        +set(key, value)
        +clear()
    }
    class VectorTileLoader {
        +load(tile, signal)
    }
    class FeatureAdapter {
        <<interface>>
        +adapt(input)
    }
    class MvtAdapter
    class VectorTileSource {
        +load(tile)
        +getCached(tile)
        +getCachedAncestor(tile)
        +retainLoading(tiles)
        +clearCache()
    }
    class RasterTileSource {
        +load(tile)
        +getCached(tile)
        +clearCache()
    }
    class VectorTileLayer
    class RasterTileLayer

    VectorTileSource *-- VectorTileLoader
    VectorTileSource *-- TileCache
    VectorTileSource o-- LocalTileGrid
    VectorTileLoader o-- FeatureAdapter
    FeatureAdapter <|.. MvtAdapter
    VectorTileLayer o-- VectorTileSource

    RasterTileSource *-- TileCache
    RasterTileSource o-- LocalTileGrid
    RasterTileLayer o-- RasterTileSource
```

瓦片链路有意拆成四层：

1. <code>LocalTileGrid</code> 只负责坐标、层级和瓦片范围计算；
2. <code>Loader</code> 负责 HTTP 获取，<code>Adapter</code> 负责格式转换；
3. <code>Source</code> 负责请求去重、LRU、失败退避、取消与父级回退；
4. <code>Layer</code> 根据当前视口向 Source 请求数据并完成绘制。

这种拆分使网络策略、数据格式与渲染策略可以分别替换，也解释了为什么加入
<code>MvtAdapter</code> 后仍然保留 <code>VectorTileLoader</code>。

## 一帧绘制的调用顺序

```mermaid
sequenceDiagram
    participant User as 用户交互
    participant IC as InteractionController
    participant Map
    participant MR as CanvasMapRenderer
    participant Layer
    participant Source
    participant Canvas

    User->>IC: 缩放 / 平移
    IC->>Map: onViewChange()
    Map->>Map: requestAnimationFrame 合并重绘
    Map->>MR: render(layers, transform, extent, zoom)
    loop 可见图层
        MR->>Layer: draw(ctx, extent, zoom)
        opt 异步瓦片未缓存
            Layer->>Source: load(tile)
            Source-->>Layer: Promise
            Layer-->>Map: requestRender()
        end
        Layer->>Canvas: 绘制要素或瓦片
    end
```
