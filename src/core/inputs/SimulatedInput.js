import { EventBus } from '@/core/EventBus.js';
import {
  GUIDE_MARKER_ID,
  QUADRANTS,
  ROTATION_STEP_DEG,
  TABLE_H,
  TABLE_W,
} from '@/config/table.js';

/**
 * Marcadores simulados para desarrollo.
 *
 *   1 2 3 4   cantidad de marcadores en pantalla
 *   0         sacar todos
 *   arrastre  mover el marcador
 *   rueda     girar el marcador
 *   flechas   girar un paso el marcador con foco
 *   G         marcador de guia (pantalla completa)
 *
 * Escribe en el MarkerStore con la misma forma de dato que Tangible Engine.
 *
 * Eventos: 'focus:change' | 'nudge:step'
 */
export class SimulatedInput {
  bus = new EventBus();

  /** Orden de aparicion: primero el frente de la mesa, despues el fondo. */
  static SPAWN_ORDER = [2, 3, 0, 1];

  /** @type {Map<number, HTMLElement>} */
  #ghosts = new Map();
  /** @type {Map<number, number>} */
  #rotations = new Map();
  #focusedId = null;
  #dragging = null;
  #running = false;
  #countBeforeGuide = 1;

  /**
   * @param {import('@/core/MarkerStore.js').MarkerStore} store
   * @param {import('@/core/Stage.js').Stage} stage
   * @param {HTMLElement} layer
   */
  constructor(store, stage, layer) {
    this.store = store;
    this.stage = stage;
    this.layer = layer;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    window.addEventListener('keydown', this.#onKeyDown);
    this.layer.addEventListener('pointerdown', this.#onPointerDown);
    this.layer.addEventListener('pointermove', this.#onPointerMove);
    this.layer.addEventListener('pointerup', this.#onPointerUp);
    this.layer.addEventListener('pointercancel', this.#onPointerUp);
    this.layer.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    window.removeEventListener('keydown', this.#onKeyDown);
    this.layer.removeEventListener('pointerdown', this.#onPointerDown);
    this.layer.removeEventListener('pointermove', this.#onPointerMove);
    this.layer.removeEventListener('pointerup', this.#onPointerUp);
    this.layer.removeEventListener('pointercancel', this.#onPointerUp);
    this.layer.removeEventListener('wheel', this.#onWheel);
    this.setCount(0);
  }

  /**
   * Deja exactamente `n` marcadores de visitante en la mesa. No toca el de guia.
   * @param {number} n
   */
  setCount(n) {
    const target = Math.min(4, Math.max(0, n));

    for (const id of this.#visitorIds()) {
      if (id >= target) this.#removeMarker(id);
    }
    for (let id = 0; id < target; id += 1) {
      if (!this.store.has(id)) this.#spawn(id);
    }

    if (this.#focusedId === null || !this.store.has(this.#focusedId)) {
      this.#setFocus(target > 0 ? 0 : null);
    }
  }

  toggleGuide() {
    if (this.store.has(GUIDE_MARKER_ID)) {
      this.#removeMarker(GUIDE_MARKER_ID);
      this.setCount(this.#countBeforeGuide);
      return;
    }

    // En modo guia la mesa es una sola: los marcadores de visitante salen.
    this.#countBeforeGuide = this.#visitorIds().length;
    this.setCount(0);

    this.#rotations.set(GUIDE_MARKER_ID, 0);
    this.store.upsert(
      { id: GUIDE_MARKER_ID, x: TABLE_W * 0.3, y: TABLE_H / 2, rotation: 0 },
      'simulated',
    );
    this.#mountGhost(GUIDE_MARKER_ID);
    this.#setFocus(GUIDE_MARKER_ID);
  }

  syncAll() {
    for (const id of this.#ghosts.keys()) this.#syncGhost(id);
  }

  // --- internos -------------------------------------------------------------

  #visitorIds() {
    return this.store
      .list()
      .map((m) => m.id)
      .filter((id) => id !== GUIDE_MARKER_ID);
  }

  /**
   * Aparece en la columna del marcador, no en el medio del cuadrante:
   * es donde la interfaz espera que quede apoyado.
   * @param {number} id
   */
  #spawn(id) {
    const region = QUADRANTS[SimulatedInput.SPAWN_ORDER[id] ?? 0];
    if (!region) return;
    const localX = 360;
    const localY = region.h / 2;
    const x = region.orientation === 180 ? region.x + region.w - localX : region.x + localX;
    const y = region.orientation === 180 ? region.y + region.h - localY : region.y + localY;
    this.#rotations.set(id, 0);
    this.store.upsert({ id, x, y, rotation: 0 }, 'simulated');
    this.#mountGhost(id);
  }

  /** @param {number} id */
  #removeMarker(id) {
    this.store.remove(id);
    this.#rotations.delete(id);
    this.#ghosts.get(id)?.remove();
    this.#ghosts.delete(id);
    if (this.#focusedId === id) this.#setFocus(this.#visitorIds()[0] ?? null);
  }

  /** @param {number} id */
  #mountGhost(id) {
    if (this.#ghosts.has(id)) return;
    const el = document.createElement('div');
    el.className = 'ghost';
    el.dataset.markerId = String(id);
    if (id === GUIDE_MARKER_ID) el.dataset.guide = 'true';
    el.innerHTML = `
      <div class="ghost__body">
        <span class="ghost__index"></span>
        <span class="ghost__label">${id === GUIDE_MARKER_ID ? 'G' : id}</span>
      </div>`;
    this.layer.append(el);
    this.#ghosts.set(id, el);
    this.#syncGhost(id);
  }

  /** @param {number} id */
  #syncGhost(id) {
    const el = this.#ghosts.get(id);
    const marker = this.store.get(id);
    if (!el || !marker) return;
    el.style.transform = `translate(${marker.x}px, ${marker.y}px) rotate(${marker.rotation}deg)`;
    el.dataset.focused = String(this.#focusedId === id);
  }

  /** @param {number|null} id */
  #setFocus(id) {
    if (this.#focusedId === id) return;
    this.#focusedId = id;
    this.syncAll();
    this.bus.emit('focus:change', id);
  }

  /** @param {number} id @param {number} x @param {number} y */
  #move(id, x, y) {
    this.store.upsert(
      {
        id,
        x: Math.min(TABLE_W, Math.max(0, x)),
        y: Math.min(TABLE_H, Math.max(0, y)),
        rotation: this.#rotations.get(id) ?? 0,
      },
      'simulated',
    );
    this.#syncGhost(id);
  }

  /** @param {number} id @param {number} deltaDeg */
  #rotate(id, deltaDeg) {
    const marker = this.store.get(id);
    if (!marker) return;
    const rotation = (this.#rotations.get(id) ?? 0) + deltaDeg;
    this.#rotations.set(id, rotation);
    this.store.upsert({ id, x: marker.x, y: marker.y, rotation }, 'simulated');
    this.#syncGhost(id);
  }

  /** @param {Event} event */
  #ghostIdFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const ghost = target.closest('.ghost');
    if (!ghost?.dataset.markerId) return null;
    return Number.parseInt(ghost.dataset.markerId, 10);
  }

  #onPointerDown = (event) => {
    const id = this.#ghostIdFromEvent(event);
    if (id === null) return;
    const marker = this.store.get(id);
    if (!marker) return;
    const point = this.stage.toTable(event.clientX, event.clientY);
    this.#dragging = {
      id,
      dx: marker.x - point.x,
      dy: marker.y - point.y,
      pointerId: event.pointerId,
    };
    this.#setFocus(id);
    this.layer.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  #onPointerMove = (event) => {
    if (!this.#dragging || this.#dragging.pointerId !== event.pointerId) return;
    const point = this.stage.toTable(event.clientX, event.clientY);
    this.#move(this.#dragging.id, point.x + this.#dragging.dx, point.y + this.#dragging.dy);
  };

  #onPointerUp = (event) => {
    if (!this.#dragging || this.#dragging.pointerId !== event.pointerId) return;
    this.layer.releasePointerCapture(event.pointerId);
    this.#dragging = null;
  };

  #onWheel = (event) => {
    const id = this.#ghostIdFromEvent(event);
    if (id === null) return;
    event.preventDefault();
    this.#setFocus(id);
    this.#rotate(id, Math.sign(event.deltaY) * 6);
  };

  #onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key >= '0' && event.key <= '4') {
      this.setCount(Number.parseInt(event.key, 10));
      event.preventDefault();
      return;
    }

    if (event.key === 'g' || event.key === 'G') {
      this.toggleGuide();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (this.#focusedId === null) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      // Solo gira el marcador. El paso de seleccion sale del giro, como con la rosca:
      // un unico camino, si no la tecla avanzaba dos posiciones.
      this.#rotate(this.#focusedId, direction * ROTATION_STEP_DEG);
      event.preventDefault();
    }
  };
}
