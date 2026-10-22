/** 矢量与栅格瓦片共享的小型 LRU 缓存。 */
export class TileCache<T> {
    private readonly entries = new Map<string, T>();

    public constructor(private readonly capacity = 128) {}

    public get(key: string): T | undefined {
        const value = this.entries.get(key);
        if (value === undefined) return undefined;
        this.entries.delete(key);
        this.entries.set(key, value);
        return value;
    }

    public set(key: string, value: T): void {
        this.entries.delete(key);
        this.entries.set(key, value);
        while (this.entries.size > this.capacity) {
            const oldest = this.entries.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            this.entries.delete(oldest);
        }
    }

    public clear(): void {
        this.entries.clear();
    }
}
