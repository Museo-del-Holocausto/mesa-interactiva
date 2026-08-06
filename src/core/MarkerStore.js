import { EventBus } from '@/core/EventBus.js';
import { MARKER_TIMEOUT_MS } from '@/config/table.js';

/**
 * Unica fuente de verdad de los marcadores.
 * El simulador y Tangible Engine escriben aca con la misma forma de dato.
 * La UI solo lee. El dia que se enchufe TE no se toca nada rio abajo.
 *
 * Eventos: 'marker:add' | 'marker:update' | 'marker:remove' | 'change'
 */
export class MarkerStore {
  bus = new EventBus();

  /** @type {Map<number, import('@/core/types.js').Marker>} */
  #markers = new Map();
  #sweepTimer = null;

  /**
   * Alta o actualizacion. Idempotente: es el metodo que llama el loop de entrada.
   * @param {import('@/core/types.js').MarkerFrame} frame
   * @param {'simulated'|'tangible'} source
   */
  upsert(frame, source) {
    const existing = this.#markers.get(frame.id);
    const now = performance.now();

    if (!existing) {
      const marker = { ...frame, source, lastSeen: now };
      this.#markers.set(frame.id, marker);
      this.bus.emit('marker:add', marker);
      this.#emitChange();
      return;
    }

    const moved = existing.x !== frame.x || existing.y !== frame.y;
    const rotated = existing.rotation !== frame.rotation;
    existing.x = frame.x;
    existing.y = frame.y;
    existing.rotation = frame.rotation;
    existing.lastSeen = now;

    if (moved || rotated) {
      this.bus.emit('marker:update', existing);
      this.#emitChange();
    }
  }

  /** @param {number} id */
  remove(id) {
    if (!this.#markers.delete(id)) return;
    this.bus.emit('marker:remove', id);
    this.#emitChange();
  }

  clear() {
    const ids = [...this.#markers.keys()];
    this.#markers.clear();
    for (const id of ids) this.bus.emit('marker:remove', id);
    this.#emitChange();
  }

  /** @param {number} id */
  get(id) {
    return this.#markers.get(id);
  }

  list() {
    return [...this.#markers.values()];
  }

  /** @param {number} id */
  has(id) {
    return this.#markers.has(id);
  }

  get size() {
    return this.#markers.size;
  }

  /**
   * Da de baja marcadores que dejaron de reportarse.
   * Tangible Engine pierde el marcador de a ratos; sin esto la UI parpadea.
   * El simulador no lo necesita pero comparte el camino para que se comporten igual.
   */
  startSweep() {
    if (this.#sweepTimer !== null) return;
    this.#sweepTimer = window.setInterval(() => {
      const now = performance.now();
      for (const marker of [...this.#markers.values()]) {
        if (marker.source === 'simulated') continue;
        if (now - marker.lastSeen > MARKER_TIMEOUT_MS) this.remove(marker.id);
      }
    }, 120);
  }

  stopSweep() {
    if (this.#sweepTimer === null) return;
    window.clearInterval(this.#sweepTimer);
    this.#sweepTimer = null;
  }

  #emitChange() {
    this.bus.emit('change', this.list());
  }
}
