import type { InputSource } from '@/core/inputs/InputSource';
import type { MarkerStore } from '@/core/MarkerStore';
import type { Stage } from '@/core/Stage';
import type { MarkerId } from '@/core/types';
import { EventBus } from '@/core/EventBus';
import {
  GUIDE_MARKER_ID,
  QUADRANTS,
  ROTATION_STEP_DEG,
  TABLE_H,
  TABLE_W,
} from '@/config/table';

type SimEvents = {
  'focus:change': MarkerId | null;
  /** Un paso de seleccion pedido por teclado sobre el marcador con foco. */
  'nudge:step': { id: MarkerId; direction: -1 | 1 };
};

/**
 * Marcadores simulados para desarrollo.
 *
 *   1 2 3 4   cantidad de marcadores en pantalla
 *   arrastre  mover el marcador
 *   rueda     girar el marcador
 *   flechas   girar un paso el marcador con foco
 *   G         marcador de guia (pantalla completa)
 *   0         sacar todos los marcadores
 *
 * Escribe en el MarkerStore con la misma forma de dato que Tangible Engine.
 */
export class SimulatedInput implements InputSource {
  readonly bus = new EventBus<SimEvents>();

  private store: MarkerStore;
  private stage: Stage;
  private layer: HTMLElement;
  private ghosts = new Map<MarkerId, HTMLElement>();
  private rotations = new Map<MarkerId, number>();
  private focusedId: MarkerId | null = null;
  private dragging: { id: MarkerId; dx: number; dy: number; pointerId: number } | null = null;
  private running = false;
  private countBeforeGuide = 1;

  /** Orden de aparicion: primero el frente de la mesa, despues el fondo. */
  private static readonly SPAWN_ORDER = [2, 3, 0, 1] as const;

  constructor(store: MarkerStore, stage: Stage, layer: HTMLElement) {
    this.store = store;
    this.stage = stage;
    this.layer = layer;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener('keydown', this.onKeyDown);
    this.layer.addEventListener('pointerdown', this.onPointerDown);
    this.layer.addEventListener('pointermove', this.onPointerMove);
    this.layer.addEventListener('pointerup', this.onPointerUp);
    this.layer.addEventListener('pointercancel', this.onPointerUp);
    this.layer.addEventListener('wheel', this.onWheel, { passive: false });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('keydown', this.onKeyDown);
    this.layer.removeEventListener('pointerdown', this.onPointerDown);
    this.layer.removeEventListener('pointermove', this.onPointerMove);
    this.layer.removeEventListener('pointerup', this.onPointerUp);
    this.layer.removeEventListener('pointercancel', this.onPointerUp);
    this.layer.removeEventListener('wheel', this.onWheel);
    this.setCount(0);
  }

  /** Deja exactamente `n` marcadores de visitante en la mesa. No toca el de guia. */
  setCount(n: number): void {
    const target = Math.min(4, Math.max(0, n));
    const current = this.visitorIds();

    for (const id of current) {
      if (id >= target) this.removeMarker(id);
    }
    for (let id = 0; id < target; id += 1) {
      if (!this.store.has(id)) this.spawn(id);
    }

    if (this.focusedId === null || !this.store.has(this.focusedId)) {
      this.setFocus(target > 0 ? 0 : null);
    }
  }

  toggleGuide(): void {
    if (this.store.has(GUIDE_MARKER_ID)) {
      this.removeMarker(GUIDE_MARKER_ID);
      this.setCount(this.countBeforeGuide);
      return;
    }
    // En modo guia la mesa es una sola: los marcadores de visitante salen.
    this.countBeforeGuide = this.visitorIds().length;
    this.setCount(0);

    this.rotations.set(GUIDE_MARKER_ID, 0);
    this.store.upsert(
      { id: GUIDE_MARKER_ID, x: TABLE_W * 0.3, y: TABLE_H / 2, rotation: 0 },
      'simulated',
    );
    this.mountGhost(GUIDE_MARKER_ID);
    this.setFocus(GUIDE_MARKER_ID);
  }

  // --- internos -------------------------------------------------------------

  private visitorIds(): MarkerId[] {
    return this.store
      .list()
      .map((m) => m.id)
      .filter((id) => id !== GUIDE_MARKER_ID);
  }

  private spawn(id: MarkerId): void {
    const quadrantIndex = SimulatedInput.SPAWN_ORDER[id] ?? 0;
    const region = QUADRANTS[quadrantIndex];
    if (!region) return;
    const rotation = 0;
    this.rotations.set(id, rotation);
    this.store.upsert(
      { id, x: region.x + region.w / 2, y: region.y + region.h / 2, rotation },
      'simulated',
    );
    this.mountGhost(id);
  }

  private removeMarker(id: MarkerId): void {
    this.store.remove(id);
    this.rotations.delete(id);
    this.ghosts.get(id)?.remove();
    this.ghosts.delete(id);
    if (this.focusedId === id) this.setFocus(this.visitorIds()[0] ?? null);
  }

  private mountGhost(id: MarkerId): void {
    if (this.ghosts.has(id)) return;
    const el = document.createElement('div');
    el.className = 'ghost';
    el.dataset.markerId = String(id);
    if (id === GUIDE_MARKER_ID) el.dataset.guide = 'true';
    el.innerHTML = `
      <div class="ghost__body">
        <span class="ghost__label">${id === GUIDE_MARKER_ID ? 'G' : id}</span>
        <div class="ghost__needle"></div>
      </div>`;
    this.layer.append(el);
    this.ghosts.set(id, el);
    this.syncGhost(id);
  }

  /** Reposiciona el ghost desde el store. Lo llama el render loop de DebugLayer. */
  syncGhost(id: MarkerId): void {
    const el = this.ghosts.get(id);
    const marker = this.store.get(id);
    if (!el || !marker) return;
    el.style.transform = `translate(${marker.x}px, ${marker.y}px) rotate(${marker.rotation}deg)`;
    el.dataset.focused = String(this.focusedId === id);
  }

  syncAll(): void {
    for (const id of this.ghosts.keys()) this.syncGhost(id);
  }

  private setFocus(id: MarkerId | null): void {
    if (this.focusedId === id) return;
    this.focusedId = id;
    this.syncAll();
    this.bus.emit('focus:change', id);
  }

  private move(id: MarkerId, x: number, y: number): void {
    const rotation = this.rotations.get(id) ?? 0;
    this.store.upsert(
      {
        id,
        x: Math.min(TABLE_W, Math.max(0, x)),
        y: Math.min(TABLE_H, Math.max(0, y)),
        rotation,
      },
      'simulated',
    );
    this.syncGhost(id);
  }

  private rotate(id: MarkerId, deltaDeg: number): void {
    const marker = this.store.get(id);
    if (!marker) return;
    const rotation = (this.rotations.get(id) ?? 0) + deltaDeg;
    this.rotations.set(id, rotation);
    this.store.upsert({ id, x: marker.x, y: marker.y, rotation }, 'simulated');
    this.syncGhost(id);
  }

  private ghostIdFromEvent(event: Event): MarkerId | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const ghost = target.closest<HTMLElement>('.ghost');
    if (!ghost?.dataset.markerId) return null;
    return Number.parseInt(ghost.dataset.markerId, 10);
  }

  private onPointerDown = (event: PointerEvent): void => {
    const id = this.ghostIdFromEvent(event);
    if (id === null) return;
    const marker = this.store.get(id);
    if (!marker) return;
    const point = this.stage.toTable(event.clientX, event.clientY);
    this.dragging = {
      id,
      dx: marker.x - point.x,
      dy: marker.y - point.y,
      pointerId: event.pointerId,
    };
    this.setFocus(id);
    this.layer.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || this.dragging.pointerId !== event.pointerId) return;
    const point = this.stage.toTable(event.clientX, event.clientY);
    this.move(this.dragging.id, point.x + this.dragging.dx, point.y + this.dragging.dy);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging || this.dragging.pointerId !== event.pointerId) return;
    this.layer.releasePointerCapture(event.pointerId);
    this.dragging = null;
  };

  private onWheel = (event: WheelEvent): void => {
    const id = this.ghostIdFromEvent(event);
    if (id === null) return;
    event.preventDefault();
    this.setFocus(id);
    this.rotate(id, Math.sign(event.deltaY) * 6);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
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
      if (this.focusedId === null) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      this.rotate(this.focusedId, direction * ROTATION_STEP_DEG);
      this.bus.emit('nudge:step', { id: this.focusedId, direction });
      event.preventDefault();
    }
  };
}
