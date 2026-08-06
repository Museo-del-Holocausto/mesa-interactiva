import { GUIDE_MARKER_ID, GUIDE_REGION, QUADRANTS } from '@/config/table';
import { Quadrant } from '@/layout/Quadrant';
import { AxisMenu } from '@/ui/AxisMenu';
import { i18n } from '@/i18n/i18n';
import type { MarkerStore } from '@/core/MarkerStore';
import type { LayoutMode, Marker, MarkerId } from '@/core/types';

/**
 * Decide que regiones existen y a quien pertenece cada una.
 *
 * Regla: cuadrantes fijos siempre. El modo guia no se infiere de la cantidad de
 * marcadores sino de la presencia de un marcador dedicado, para que la intencion
 * sea explicita y fisica.
 */
export class LayoutManager {
  private store: MarkerStore;
  private root: HTMLElement;
  private quadrants: Quadrant[] = [];
  private guide: Quadrant | null = null;
  private mode: LayoutMode = 'quadrants';

  constructor(store: MarkerStore, root: HTMLElement) {
    this.store = store;
    this.root = root;
    this.mountQuadrants();
    this.store.bus.on('change', () => this.sync());
    this.sync();
  }

  get currentMode(): LayoutMode {
    return this.mode;
  }

  private mountQuadrants(): void {
    for (const region of QUADRANTS) {
      const quadrant = new Quadrant(region);
      this.quadrants.push(quadrant);
      this.root.append(quadrant.el);
    }
  }

  private setMode(mode: LayoutMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.root.dataset.layout = mode;

    if (mode === 'guide') {
      for (const quadrant of this.quadrants) quadrant.detach();
      this.guide = new Quadrant({ ...GUIDE_REGION, index: -1 });
      this.guide.el.dataset.guide = 'true';
      this.root.append(this.guide.el);
    } else {
      this.guide?.detach();
      this.guide?.el.remove();
      this.guide = null;
    }
  }

  private sync(): void {
    const markers = this.store.list();
    const guideMarker = markers.find((m) => m.id === GUIDE_MARKER_ID);

    this.setMode(guideMarker ? 'guide' : 'quadrants');

    if (guideMarker && this.guide) {
      this.guide.attach(guideMarker, () => this.makeMenu());
      this.guide.update(guideMarker, []);
      return;
    }

    const visitors = markers.filter((m) => m.id !== GUIDE_MARKER_ID);
    const claimed = new Map<number, Marker>();

    // Primero respeta las asignaciones vigentes: un cuadrante no cambia de dueno
    // mientras el marcador que lo tomo siga dentro.
    for (const quadrant of this.quadrants) {
      const owner = quadrant.claimedBy;
      if (owner === null) continue;
      const marker = visitors.find((m) => m.id === owner);
      if (marker && quadrant.contains(marker)) claimed.set(quadrant.region.index, marker);
    }

    for (const marker of visitors) {
      if ([...claimed.values()].some((m) => m.id === marker.id)) continue;
      const quadrant = this.quadrants.find((q) => q.contains(marker));
      if (!quadrant) continue;
      if (claimed.has(quadrant.region.index)) continue; // ya lo tomo otro
      claimed.set(quadrant.region.index, marker);
    }

    for (const quadrant of this.quadrants) {
      const marker = claimed.get(quadrant.region.index);
      if (!marker) {
        if (quadrant.isBusy) quadrant.detach();
        continue;
      }
      quadrant.attach(marker, () => this.makeMenu());
      quadrant.update(marker, visitors);
    }
  }

  /** Paso de seleccion por teclado sobre el cuadrante que tiene ese marcador. */
  nudge(markerId: MarkerId, direction: 1 | -1): void {
    if (this.guide && markerId === GUIDE_MARKER_ID) {
      this.guide.nudge(direction);
      return;
    }
    const quadrant = this.quadrants.find((q) => q.claimedBy === markerId);
    quadrant?.nudge(direction);
  }

  private makeMenu(): AxisMenu {
    return new AxisMenu(i18n.bundle.axes, {
      onEnter: (axis) => {
        // Proxima capa: montar el modulo del eje. Por ahora solo se registra.
        console.info('[mesa] entrar al eje', axis.id, axis.mode);
      },
      onSelect: () => {},
    });
  }
}
