/** POI 搜索输入组件。 */
import { searchPois } from "../api/poi";
import type { Poi } from "../api/types";

export class PoiAutocomplete {
  private selected: Poi | null = null;
  private timer?: number;
  private requestController?: AbortController;
  private readonly suggestions: HTMLElement;

  constructor(readonly input: HTMLInputElement, container: HTMLElement) {
    this.suggestions = container.querySelector(".suggestions") as HTMLElement;
    input.addEventListener("input", () => {
      this.selected = null;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout((): void => {
        void this.load();
      }, 260);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
    input.addEventListener("blur", () => window.setTimeout(() => this.close(), 140));
  }

  get value(): Poi | null {
    return this.selected;
  }

  setValue(poi: Poi | null): void {
    this.selected = poi;
    this.input.value = poi?.name ?? "";
    this.close();
  }

  clear(): void {
    this.setValue(null);
  }

  private async load(): Promise<void> {
    const keyword = this.input.value.trim();
    if (!keyword) return this.close();
    this.requestController?.abort();
    this.requestController = new AbortController();
    try {
      const result = await searchPois(keyword, 8, this.requestController.signal);
      this.render(result.items);
    } catch (error) {
      if ((error as Error).name !== "AbortError") this.close();
    }
  }

  private render(items: Poi[]): void {
    this.suggestions.replaceChildren();
    items.forEach((poi) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-item";
      const name = document.createElement("strong");
      name.textContent = poi.name;
      const context = document.createElement("span");
      context.textContent = poi.context || `ID ${poi.id}`;
      button.append(name, context);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        this.setValue(poi);
      });
      this.suggestions.appendChild(button);
    });
    this.suggestions.classList.toggle("open", items.length > 0);
  }

  private close(): void {
    this.suggestions.classList.remove("open");
  }
}
