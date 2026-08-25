import gsap from 'gsap';
import {
  MARKER_COLUMN_W,
  MARKER_RADIUS,
  MODULE_CANVAS_H,
  MODULE_CANVAS_W,
} from '@/config/table.js';

/** Banda muerta para que el lado no cambie con un temblor. */
const SIDE_HYSTERESIS = 140;

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
  #side = 'left';
  /** El marcador esta pisando la zona util del lienzo. */
  overlaps = false;
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
      <header class="modulo__head">
        <p class="modulo__eyebrow">${node.eyebrow ?? node.title}</p>
        <button class="modulo__back" type="button">Volver</button>
      </header>
      <div class="modulo__canvas">
        <div class="modulo__body"></div>
      </div>`;

    this.canvas = this.el.querySelector('.modulo__canvas');
    this.canvas.style.width = `${MODULE_CANVAS_W}px`;
    this.canvas.style.height = `${MODULE_CANVAS_H}px`;
    this.canvas.dataset.side = 'left';

    this.el.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
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
   * Traduce la posicion del marcador a coordenadas de lienzo y decide, con ese
   * dato, tres cosas: de que lado va el contenido, si hace falta reservarle
   * columna al objeto, y si el objeto esta realmente encima del contenido.
   *
   * Todo se calcula contra el lienzo y no contra la region. Medirlo contra la
   * region era el error: en modo guia el lienzo esta centrado y sobra banda
   * muerta a los costados, asi que un marcador lejisimos del bloque se leia
   * como "encima del contenido" y lo apagaba.
   *
   * @param {number} localX @param {number} localY
   */
  applyPosition(localX, localY) {
    const cx = (localX - this.#originX) / this.#scale;
    const cy = (localY - this.#originY) / this.#scale;
    const r = MARKER_RADIUS / this.#scale;

    // Lado: contra el centro del lienzo, con banda muerta.
    const mid = MODULE_CANVAS_W / 2;
    if (cx < mid - SIDE_HYSTERESIS) this.#side = 'left';
    else if (cx > mid + SIDE_HYSTERESIS) this.#side = 'right';
    this.canvas.dataset.side = this.#side;

    // Columna: solo si el objeto pisa el lienzo. Si quedo afuera —cosa habitual
    // en modo guia— el contenido usa todo el ancho en vez de dejar un hueco.
    // Las piezas que reciben el marcador encima tampoco reservan columna: si el
    // contenido se corriera al costado, los circulos se moverian justo cuando
    // el objeto se acerca a ellos.
    const dentro = cx + r > 0 && cx - r < MODULE_CANVAS_W;
    const col =
      dentro && !this.#piece?.aceptaMarcadorEncima ? MARKER_COLUMN_W / this.#scale : 0;
    this.canvas.style.setProperty('--col', `${Math.round(col)}px`);

    // Estorbo: el objeto pisa la zona util, no la columna que le reservamos.
    const util = this.#side === 'left' ? [col, MODULE_CANVAS_W] : [0, MODULE_CANVAS_W - col];
    // Hay piezas donde apoyar el marcador sobre el contenido ES la
    // interaccion. Esas lo declaran y no se les avisa que estorban.
    this.overlaps =
      !this.#piece?.aceptaMarcadorEncima &&
      dentro &&
      cy + r > 0 &&
      cy - r < MODULE_CANVAS_H &&
      cx + r > util[0] &&
      cx - r < util[1];

    this.canvas.style.setProperty('--marker-x', `${Math.round(localX / this.#scale)}px`);
    this.canvas.style.setProperty('--marker-y', `${Math.round(localY / this.#scale)}px`);
    // Se le pasa el alto real que recorre el marcador, no el del lienzo: en
    // modo guia el objeto puede subir y bajar por toda la mesa.
    this.#piece?.applyPosition?.(
      localX / this.#scale,
      localY / this.#scale,
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
