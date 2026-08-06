import { TABLE_H, TABLE_W } from '@/config/table.js';

/**
 * El lienzo mide siempre 3840x2160. Stage lo encaja en el viewport por transform.
 * Ningun componente sabe que el escalado existe: todos trabajan en px de mesa.
 */
export class Stage {
  #scale = 1;
  #offsetX = 0;
  #offsetY = 0;

  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.el.style.width = `${TABLE_W}px`;
    this.el.style.height = `${TABLE_H}px`;
    this.#fit();
    window.addEventListener('resize', this.#fit);
  }

  #fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.#scale = Math.min(vw / TABLE_W, vh / TABLE_H);
    this.#offsetX = (vw - TABLE_W * this.#scale) / 2;
    this.#offsetY = (vh - TABLE_H * this.#scale) / 2;
    this.el.style.transform = `translate(${this.#offsetX}px, ${this.#offsetY}px) scale(${this.#scale})`;
    document.documentElement.style.setProperty('--stage-scale', String(this.#scale));
  };

  /**
   * Coordenadas de pantalla -> coordenadas de mesa.
   * Necesario para el drag del simulador.
   * @param {number} clientX @param {number} clientY
   */
  toTable(clientX, clientY) {
    return {
      x: (clientX - this.#offsetX) / this.#scale,
      y: (clientY - this.#offsetY) / this.#scale,
    };
  }

  get scale() {
    return this.#scale;
  }

  destroy() {
    window.removeEventListener('resize', this.#fit);
  }
}
