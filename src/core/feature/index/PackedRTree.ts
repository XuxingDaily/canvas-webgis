import { Extent } from "../../geometry/Extent";

interface Entry<T> {
    readonly extent: Extent;
    readonly value: T;
}

interface Node<T> {
    readonly extent: Extent;
    readonly leaf: boolean;
    readonly children: Array<Node<T> | Entry<T>>;
}

/**
 * 面向批量只读查询的 packed R-tree。
 * 数据变更由上层延迟重建，查询时无需线性扫描全部要素。
 */
export class PackedRTree<T> {
    public constructor(
        values: Iterable<T>,
        private readonly extentOf: (value: T) => Extent,
        private readonly maxEntries = 16
    ) {
        if (maxEntries < 4) throw new Error("R-tree 节点容量不能小于 4");
        const entries = Array.from(values, value => ({ value, extent: extentOf(value) }));
        this.root = entries.length > 0 ? this.build(entries, 0) : null;
    }

    private readonly root: Node<T> | null;

    public get extent(): Extent | null { return this.root?.extent ?? null; }

    public search(extent: Extent): T[] {
        if (!this.root || !this.root.extent.intersect(extent)) return [];
        const matches: T[] = [];
        const stack: Node<T>[] = [this.root];
        while (stack.length > 0) {
            const node = stack.pop()!;
            for (const child of node.children) {
                if (!child.extent.intersect(extent)) continue;
                if (node.leaf) matches.push((child as Entry<T>).value);
                else stack.push(child as Node<T>);
            }
        }
        return matches;
    }

    private build(entries: Entry<T>[], depth: number): Node<T> {
        if (entries.length <= this.maxEntries) {
            return { leaf: true, children: entries, extent: this.union(entries.map(item => item.extent)) };
        }

        const axis = depth % 2 === 0 ? "x" : "y";
        entries.sort((left, right) => this.center(left.extent, axis) - this.center(right.extent, axis));
        const childCount = Math.min(this.maxEntries, Math.ceil(entries.length / this.maxEntries));
        const groupSize = Math.ceil(entries.length / childCount);
        const children: Node<T>[] = [];
        for (let index = 0; index < entries.length; index += groupSize) {
            children.push(this.build(entries.slice(index, index + groupSize), depth + 1));
        }
        return { leaf: false, children, extent: this.union(children.map(item => item.extent)) };
    }

    private center(extent: Extent, axis: "x" | "y"): number {
        return axis === "x"
            ? (extent.xmin + extent.xmax) / 2
            : (extent.ymin + extent.ymax) / 2;
    }

    private union(extents: Extent[]): Extent {
        return new Extent(
            Math.max(...extents.map(extent => extent.ymax)),
            Math.min(...extents.map(extent => extent.ymin)),
            Math.min(...extents.map(extent => extent.xmin)),
            Math.max(...extents.map(extent => extent.xmax))
        );
    }
}
