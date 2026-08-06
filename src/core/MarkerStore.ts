import { EventBus } from '@/core/EventBus';
import type { Marker, MarkerFrame, MarkerId } from '@/core/types';
import { MARKER_TIMEOUT_MS } from '@/config/table';

type MarkerEvents = {
  'marker:add': Marker;
  'marker:update': Marker;
  'marker:remove': MarkerId;
  /** Cualquier cambio en el conjunto. El layout escucha solo esto. */
  change: Marker[];
};

/**
 * Unica fuente de verdad de los marcadores.
 * El simulador y Tangible Engine escriben aca con la misma forma de dato.
 * La UI solo lee. El dia que se enchufe TE no se toca nada rio abajo.
 */
export class MarkerStore {
  readonly bus = new EventBus<MarkerEvents>();
  private markers = new Map<MarkerId, Marker>();
  private sweepTimer: number | null = null;

  /** Alta o actualizacion. Idempotente: es el metodo que llama el loop de entrada. */
  upsert(frame: MarkerFrame, source: Marker['source']): void {
    const existing = this.markers.get(frame.id);
    const now = performance.now();

    if (!existing) {
      const marker: Marker = { ...frame, source, lastSeen: now };
      this.markers.set(frame.id, marker);
      this.bus.emit('marker:add', marker);
      this.emitChange();
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
      this.emitChange();
    }
  }

  remove(id: MarkerId): void {
    if (!this.markers.delete(id)) return;
    this.bus.emit('marker:remove', id);
    this.emitChange();
  }

  clear(): void {
    const ids = [...this.markers.keys()];
    this.markers.clear();
    for (const id of ids) this.bus.emit('marker:remove', id);
    this.emitChange();
  }

  get(id: MarkerId): Marker | undefined {
    return this.markers.get(id);
  }

  list(): Marker[] {
    return [...this.markers.values()];
  }

  has(id: MarkerId): boolean {
    return this.markers.has(id);
  }

  get size(): number {
    return this.markers.size;
  }

  /**
   * Da de baja marcadores que dejaron de reportarse.
   * Tangible Engine pierde el marcador de a ratos; sin esto la UI parpadea.
   * El simulador no lo necesita pero comparte el camino para que se comporten igual.
   */
  startSweep(): void {
    if (this.sweepTimer !== null) return;
    this.sweepTimer = window.setInterval(() => {
      const now = performance.now();
      for (const marker of [...this.markers.values()]) {
        if (marker.source === 'simulated') continue;
        if (now - marker.lastSeen > MARKER_TIMEOUT_MS) this.remove(marker.id);
      }
    }, 120);
  }

  stopSweep(): void {
    if (this.sweepTimer === null) return;
    window.clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  private emitChange(): void {
    this.bus.emit('change', this.list());
  }
}
