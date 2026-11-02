export interface MapEvents {
    move: void;
    extent: void;
    click: number[];
}

export type EventHandler<T> = (event: T) => void;

/** 轻量、类型安全的地图事件中心。 */
export class MapEventEmitter {
    private readonly handlers: {
        [K in keyof MapEvents]: EventHandler<MapEvents[K]>[];
    } = { move: [], extent: [], click: [] };

    public on<K extends keyof MapEvents>(type: K, handler: EventHandler<MapEvents[K]>): () => void {
        this.handlers[type].push(handler);
        return () => this.off(type, handler);
    }

    public emit<K extends keyof MapEvents>(type: K, event: MapEvents[K]): void {
        this.handlers[type].forEach(handler => handler(event));
    }

    private off<K extends keyof MapEvents>(type: K, handler: EventHandler<MapEvents[K]>): void {
        const handlers = this.handlers[type];
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
    }
}
