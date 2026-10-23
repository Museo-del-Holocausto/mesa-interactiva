/**
 * Onda de toque: un aro que se abre donde cae el dedo. En un panel de 65" no
 * siempre es evidente que el toque se registró; esto lo confirma al instante.
 *
 * Escucha en fase de captura sobre el stage, antes de que la corona o las
 * piezas corten la propagación, y dibuja en una capa propia por encima de todo.
 */
export class Toque {
  /**
   * @param {HTMLElement} stageEl
   * @param {{ toTable: (x: number, y: number) => { x: number, y: number } }} stage
   */
  constructor(stageEl, stage) {
    this.stage = stage;
    this.el = document.createElement('div');
    this.el.className = 'toques';
    stageEl.append(this.el);
    stageEl.addEventListener('pointerdown', this.#onDown, { capture: true });
  }

  /** @param {PointerEvent} event */
  #onDown = (event) => {
    // El objeto simulado del modo de desarrollo no es un dedo.
    if (event.target instanceof Element && event.target.closest('.ghost')) return;
    const p = this.stage.toTable(event.clientX, event.clientY);
    const onda = document.createElement('span');
    onda.className = 'toque';
    onda.style.left = `${p.x}px`;
    onda.style.top = `${p.y}px`;
    onda.addEventListener('animationend', () => onda.remove(), { once: true });
    this.el.append(onda);
    // Por si animationend no llega (pestaña oculta): nunca se acumulan.
    window.setTimeout(() => onda.remove(), 3000);
  };
}
