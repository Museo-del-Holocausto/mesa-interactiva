/**
 * Cascara comun de una pieza de eje. Pone el rotulo de contexto, el Volver y el
 * area util, y adentro monta la pieza.
 *
 * El area util reserva una franja abajo: ahi es donde se apoya el marcador
 * fisico, porque el visitante lo deja cerca de si y no en el medio del panel.
 */
export class Modulo {
  #piece;
  #onExit;

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
      <p class="modulo__eyebrow">${node.eyebrow ?? node.title}</p>
      <div class="modulo__body"></div>
      <button class="modulo__back" type="button">Volver</button>`;

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

  /** Reenvia el giro del marcador a la pieza, si la pieza lo usa. */
  applyRotation(rotation) {
    this.#piece?.applyRotation?.(rotation);
  }

  /**
   * Reenvia la posicion local del marcador. Solo la usan las piezas donde el
   * objeto es el cursor y no solo el ancla.
   */
  applyPosition(x, y, w, h) {
    this.#piece?.applyPosition?.(x, y, w, h);
  }

  destroy() {
    this.#piece?.destroy();
    this.el.remove();
  }
}
