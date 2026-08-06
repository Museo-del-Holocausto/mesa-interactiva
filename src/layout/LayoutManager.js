import { GUIDE_MARKER_ID, GUIDE_REGION, QUADRANTS } from '@/config/table.js';
import { Quadrant } from '@/layout/Quadrant.js';
import { Corona } from '@/ui/Corona.js';
import { i18n } from '@/i18n/i18n.js';

/**
 * Decide que regiones existen y a quien pertenece cada una.
 *
 * Regla: cuadrantes fijos siempre. El modo guia no se infiere de la cantidad de
 * marcadores sino de la presencia de un marcador dedicado, para que la intencion
 * sea explicita y fisica.
 */
export class LayoutManager {
  /** @type {Quadrant[]} */
  #quadrants = [];
  #guide = null;
  #mode = 'quadrants';

  /**
   * @param {import('@/core/MarkerStore.js').MarkerStore} store
   * @param {HTMLElement} root
   */
  constructor(store, root) {
    this.store = store;
    this.root = root;
    this.#mountQuadrants();
    this.store.bus.on('change', () => this.#sync());
    this.#sync();
  }

  get mode() {
    return this.#mode;
  }

  #mountQuadrants() {
    for (const region of QUADRANTS) {
      const quadrant = new Quadrant(region);
      this.#quadrants.push(quadrant);
      this.root.append(quadrant.el);
    }
  }

  /** @param {'quadrants'|'guide'} mode */
  #setMode(mode) {
    if (this.#mode === mode) return;
    this.#mode = mode;
    this.root.dataset.layout = mode;

    if (mode === 'guide') {
      for (const quadrant of this.#quadrants) quadrant.detach();
      this.#guide = new Quadrant(GUIDE_REGION);
      this.#guide.el.dataset.guide = 'true';
      this.root.append(this.#guide.el);
    } else {
      this.#guide?.detach();
      this.#guide?.el.remove();
      this.#guide = null;
    }
  }

  #sync() {
    const markers = this.store.list();
    const guideMarker = markers.find((m) => m.id === GUIDE_MARKER_ID);

    this.#setMode(guideMarker ? 'guide' : 'quadrants');

    if (guideMarker && this.#guide) {
      this.#guide.attach(guideMarker, () => this.#makeMenu());
      this.#guide.update(guideMarker, []);
      return;
    }

    const visitors = markers.filter((m) => m.id !== GUIDE_MARKER_ID);
    /** @type {Map<number, import('@/core/types.js').Marker>} */
    const claimed = new Map();

    // Primero respeta las asignaciones vigentes: un cuadrante no cambia de dueno
    // mientras el marcador que lo tomo siga adentro.
    for (const quadrant of this.#quadrants) {
      const owner = quadrant.claimedBy;
      if (owner === null) continue;
      const marker = visitors.find((m) => m.id === owner);
      if (marker && quadrant.contains(marker)) claimed.set(quadrant.region.index, marker);
    }

    for (const marker of visitors) {
      if ([...claimed.values()].some((m) => m.id === marker.id)) continue;
      const quadrant = this.#quadrants.find((q) => q.contains(marker));
      if (!quadrant) continue;
      if (claimed.has(quadrant.region.index)) continue; // ya lo tomo otro
      claimed.set(quadrant.region.index, marker);
    }

    for (const quadrant of this.#quadrants) {
      const marker = claimed.get(quadrant.region.index);
      if (!marker) {
        if (quadrant.isBusy) quadrant.sleep();
        continue;
      }
      quadrant.attach(marker, () => this.#makeMenu());
      quadrant.update(marker, visitors);
    }
  }

  #makeMenu() {
    // Proxima capa: en las hojas, montar el modulo segun el modo del nodo.
    return new Corona(i18n.bundle.axes, {
      onNavigate: (path) => console.info('[mesa]', path.join(' / ')),
    });
  }
}
