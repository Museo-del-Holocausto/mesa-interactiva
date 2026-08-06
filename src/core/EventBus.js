/** Pub/sub minimo. */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #handlers = new Map();

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} funcion para desuscribirse
   */
  on(event, handler) {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** @param {string} event @param {Function} handler */
  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  /** @param {string} event @param {*} [payload] */
  emit(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  clear() {
    this.#handlers.clear();
  }
}
