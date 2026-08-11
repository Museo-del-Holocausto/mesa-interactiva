import gsap from 'gsap';
import { MARKER_COLUMN_W, MODULE_CANVAS_H, MODULE_CANVAS_W } from '@/config/table.js';

/**
 * Cascara comun de una pieza de eje.
 *
 * Adentro vive un lienzo de medida fija (1920x1080) que se escala por
 * transform. En un cuadrante entra 1:1. En modo guia se escala pero no llena
 * la mesa: el sobrante es margen de movimiento, y el lienzo se corre para que
 * su columna reservada caiga donde esta el marcador.
 *
 * Es la misma regla que en un cuadrante —el contenido al lado del objeto—,
 * solo que aca el bloque entero puede deslizarse en vez de estar clavado.
 */
export class Modulo {
  #piece;
  #onExit;
  #scale = 1;
  #regionW = MODULE_CANVAS_W;
  #regionH = MODULE_CANVAS_H;
  #originX = 0;
  #originY = 0;

  /**
   * @param {any} node nodo del menu que declara el modulo
   * @param {(onExit: () => void) => { el: HTMLElement, destroy: () => void }} make
   * @param {() => void} onExit
   */
  constructor(node, make, onExit) {
    this.#onExit = onExit;
    this.el = document.createElement('div');
    this.el.className = 'modulo';
    this.el.innerHTML = `
      <div class="modulo__canvas">
        <p class="modulo__eyebrow">${node.eyebrow ?? node.title}</p>
        <div class="modulo__body"></div>
        <button class="modulo__back" type="button">Volver</button>
      </div>`;

    this.canvas = this.el.querySelector('.modulo__canvas');
    this.canvas.style.width = `${MODULE_CANVAS_W}px`;
    this.canvas.style.height = `${MODULE_CANVAS_H}px`;

    this.el.addEventListener('pointerdown', (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.modulo__back')) {
        event.stopPropagation();
        this.#onExit();
      }
    });

    this.#piece = make(onExit);
    this.el.querySelector('.modulo__body').append(this.#piece.el);
  }

  /**
   * @param {number} regionW @param {number} regionH
   * @param {number} scale factor del lienzo dentro de la region
   */
  fit(regionW, regionH, scale) {
    this.#regionW = regionW;
    this.#regionH = regionH;
    this.#scale = Math.min(scale, regionW / MODULE_CANVAS_W, regionH / MODULE_CANVAS_H);
    const w = MODULE_CANVAS_W * this.#scale;
    const h = MODULE_CANVAS_H * this.#scale;

    // Clavado al centro de la region. Un bloque que se mueve con el marcador
    // se lleva mal con las piezas donde el marcador ya es el cursor: en Aportes
    // judios deslizar hacia abajo elegia una persona y ademas corria la ficha.
    this.#originX = (regionW - w) / 2;
    this.#originY = (regionH - h) / 2;
    gsap.set(this.canvas, {
      x: this.#originX,
      y: this.#originY,
      scale: this.#scale,
      transformOrigin: 'top left',
    });

    // El marcador mide lo mismo siempre, asi que en coordenadas de lienzo
    // ocupa menos cuanto mas grande sea el lienzo.
    this.canvas.style.setProperty('--col', `${Math.round(MARKER_COLUMN_W / this.#scale)}px`);
    // Banda muerta alrededor del lienzo, en coordenadas de lienzo. Las piezas
    // que usan el marcador como cursor la necesitan para estirar su riel.
    this.canvas.style.setProperty('--bleed-x', `${Math.round(this.#originX / this.#scale)}px`);
    this.canvas.style.setProperty('--bleed-y', `${Math.round(this.#originY / this.#scale)}px`);
  }

  get scale() {
    return this.#scale;
  }

  /** El lienzo no llena la region: hay banda muerta alrededor. */
  get hasMargin() {
    return this.#regionW - MODULE_CANVAS_W * this.#scale > 1;
  }

  /** Reenvia el giro del marcador a la pieza, si la pieza lo usa. */
  applyRotation(rotation) {
    this.#piece?.applyRotation?.(rotation);
  }

  /**
   * Reacomoda el lienzo contra el marcador y le pasa a la pieza la posicion
   * **en coordenadas de lienzo**, para que no tenga que saber en que modo esta.
   * @param {number} localX @param {number} localY
   */
  /**
   * Traduce la posicion del marcador a coordenadas de lienzo y se la pasa a la
   * pieza. El lienzo no se mueve: el marcador sigue siendo cursor y perilla,
   * igual que en un cuadrante.
   * @param {number} localX @param {number} localY
   */
  applyPosition(localX, localY) {
    const cx = (localX - this.#originX) / this.#scale;
    const cy = (localY - this.#originY) / this.#scale;
    // Coordenadas medidas desde el borde de la region, para las piezas que
    // usan el marcador como cursor a lo largo de toda la mesa.
    const rx = localX / this.#scale;
    const ry = localY / this.#scale;
    this.canvas.style.setProperty('--marker-x', `${Math.round(rx)}px`);
    this.canvas.style.setProperty('--marker-y', `${Math.round(ry)}px`);
    // Se le pasa el alto real que recorre el marcador, no el del lienzo: en
    // modo guia el objeto puede subir y bajar por toda la mesa.
    this.#piece?.applyPosition?.(
      rx,
      ry,
      this.#regionW / this.#scale,
      this.#regionH / this.#scale,
    );
  }

  destroy() {
    gsap.killTweensOf(this.canvas);
    this.#piece?.destroy();
    this.el.remove();
  }
}
