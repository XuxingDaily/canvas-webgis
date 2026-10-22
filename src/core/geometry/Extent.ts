/**
 * 包络矩形
 * 用于空间分析，以及可视范围内渲染的判断等等
 * 用于参数的往往是可视区矩形
 * */
export class Extent {
    public constructor(ymax: number, ymin: number, xmin: number, xmax: number) {
        this._ymax = ymax;
        this._ymin = ymin;
        this._xmin = xmin;
        this._xmax = xmax;
        this._xscale = xmin <= xmax ? 1 : -1;
        this._yscale = ymin <= ymax ? -1 : 1;
    }

    /**
     * 四至
     */
    public get ymax(): number { return this._ymax; }
    public get ymin(): number { return this._ymin; }
    public get xmin(): number { return this._xmin; }
    public get xmax(): number { return this._xmax; }
    public get xscale(): number { return this._xscale; }
    public get yscale(): number { return this._yscale; }

    /**
     * 判断两个几何图像是否相交
     * @param {Extent} extent 
     * @returns {boolean} 是否相交
     */
    public intersect(extent: Extent): boolean {
        if (
            (extent.xmax >= this.xmin) &&
            (extent.xmin <= this.xmax) &&
            (extent.ymax >= this.ymin) &&
            (extent.ymin <= this.ymax)
        ) return true;
        else return false;
    }

    /**
     * 四至
     * xscale和yscale主要用作方向的转换
     *  - xscale：正一表示 X方向为自西向东，负一反之
     *  - yscale：正一表示 Y方向为自北向南，负一反之
     */
    private _ymax: number;
    private _ymin: number;
    private _xmin: number;
    private _xmax: number;
    private _xscale: number;
    private _yscale: number;

    /**
    * 缓冲整个边界，类似拓宽
    * @param {number} size - 拓宽相应尺寸
    */
    public buffer(size: number) {
        this._xmin -= size;
        this._ymin -= size;
        this._xmax += size;
        this._ymax += size;
    }
}