/**
 * Convierte el giro continuo del marcador en pasos discretos.
 *
 * Nunca se lee el angulo absoluto: un objeto fisico se apoya en cualquier
 * orientacion. Lo que se acumula es la diferencia, y cada `stepDeg` grados
 * acumulados vale un paso.
 */
export class Rotary {
  #last = null;
  #acc = 0;

  /** Se llama cuando el marcador se levanta o cambia el conjunto que recorre. */
  reset() {
    this.#last = null;
    this.#acc = 0;
  }

  /**
   * @param {number} rotation grados continuos reportados por el marcador
   * @param {number} stepDeg grados que equivalen a un paso
   * @param {(direction: 1|-1) => void} onStep
   */
  feed(rotation, stepDeg, onStep) {
    if (this.#last === null) {
      this.#last = rotation;
      return;
    }
    this.#acc += rotation - this.#last;
    this.#last = rotation;

    while (Math.abs(this.#acc) >= stepDeg) {
      const direction = this.#acc > 0 ? 1 : -1;
      this.#acc -= direction * stepDeg;
      onStep(direction);
    }
  }
}
