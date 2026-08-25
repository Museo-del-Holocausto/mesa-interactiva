import gsap from 'gsap';
import { evaluateProximity } from '@/layout/ProximityGuard.js';
import { MARKER_COLUMN_W, MARKER_RADIUS, QUADRANT_GRACE_MS } from '@/config/table.js';
import { DEBUG } from '@/config/debug.js';
import { MODULES } from '@/modules/index.js';
import { Modulo } from '@/modules/Modulo.js';
import { i18n } from '@/i18n/i18n.js';

/**
 * Una region de la mesa asignada a un usuario.
 * Los cuadrantes son fijos: no se recalculan segun cuanta gente haya.
 * Un layout que se reacomoda al llegar alguien le rompe la lectura al que ya estaba.
 */
export class Quadrant {
  #menu = null;
  #module = null;
  #markerId = null;
  #sleepTimer = null;
  /** Lado del cuadrante donde vive el marcador. Con histeresis: no salta solo. */
  #markerSide = 'left';

  /** @param {import('@/core/types.js').Region} region */
  constructor(region) {
    this.region = region;

    this.el = document.createElement('section');
    this.el.className = 'quadrant';
    this.el.dataset.index = String(region.index);
    this.el.dataset.state = 'idle';
    this.el.style.left = `${region.x}px`;
    this.el.style.top = `${region.y}px`;
    this.el.style.width = `${region.w}px`;
    this.el.style.height = `${region.h}px`;
    // Los usuarios de la mitad de arriba leen desde el borde opuesto.
    this.el.style.transform = `rotate(${region.orientation}deg)`;

    this.idleEl = document.createElement('div');
    this.idleEl.className = 'idle';
    this.idleEl.innerHTML = `
      <div class="idle__pulse"></div>
      <p class="idle__prompt">${i18n.t('idlePrompt')}</p>
      <p class="idle__hint">${i18n.t('idleHint')}</p>`;
    this.el.append(this.idleEl);

    this.warningEl = document.createElement('div');
    this.warningEl.className = 'warning';
    this.warningEl.dataset.visible = 'false';
    this.el.append(this.warningEl);
  }

  get isBusy() {
    return this.#markerId !== null;
  }

  /** Dormido: sin marcador pero todavia con estado guardado. */
  get isDormant() {
    return this.#sleepTimer !== null;
  }

  /** Un cuadrante dormido sigue reservado para quien lo dejo. */
  get isReserved() {
    return this.#menu !== null;
  }

  get claimedBy() {
    return this.#markerId;
  }

  /** @param {import('@/core/types.js').Marker} marker */
  contains(marker) {
    return (
      marker.x >= this.region.x &&
      marker.x < this.region.x + this.region.w &&
      marker.y >= this.region.y &&
      marker.y < this.region.y + this.region.h
    );
  }

  /**
   * Coordenadas de mesa -> coordenadas locales, contemplando la rotacion de 180.
   * @param {number} x @param {number} y
   */
  toLocal(x, y) {
    const dx = x - this.region.x;
    const dy = y - this.region.y;
    if (this.region.orientation === 180) {
      return { x: this.region.w - dx, y: this.region.h - dy };
    }
    return { x: dx, y: dy };
  }

  /**
   * @param {import('@/core/types.js').Marker} marker
   * @param {() => import('@/ui/Corona.js').Corona} menuFactory
   */
  attach(marker, menuFactory) {
    this.#wake();
    if (this.#markerId === marker.id && this.#menu) return;
    this.#markerId = marker.id;
    if (!this.#menu) {
      this.#menu = menuFactory();
      this.#menu.callbacks.onModule = (node) => this.#mountModule(node);
      this.el.append(this.#menu.el);
      // Solo opacidad: el transform del menu lo maneja GSAP en los hijos,
      // y la posicion sale de left/top. Animar transform aca pisaba el place().
      gsap.fromTo(this.#menu.el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power3.out' });
    }
    this.el.dataset.state = 'active';
  }

  /**
   * El marcador desaparecio. No se resetea: el cuadrante queda dormido, listo
   * para retomar si vuelve. Levantar el objeto y volver a apoyarlo es lo que
   * la gente hace, y perder el recorrido por eso seria un castigo absurdo.
   */
  sleep() {
    if (!this.#menu || this.#sleepTimer !== null) return;
    this.#markerId = null;
    this.el.dataset.state = 'dormant';
    this.warningEl.dataset.visible = 'false';
    this.#sleepTimer = window.setTimeout(() => {
      this.#sleepTimer = null;
      this.detach();
    }, QUADRANT_GRACE_MS);
  }

  #wake() {
    if (this.#sleepTimer === null) return;
    window.clearTimeout(this.#sleepTimer);
    this.#sleepTimer = null;
  }

  detach() {
    this.#wake();
    this.#markerId = null;
    this.#unmountModule();
    this.#menu?.detach();
    this.#menu?.destroy();
    this.#menu = null;
    this.el.dataset.state = 'idle';
    this.warningEl.dataset.visible = 'false';
  }

  /** Monta la pieza propia de un eje. Ocupa el cuadrante entero. */
  #mountModule(node) {
    const make = MODULES[node.module];
    if (!make) return;
    this.#module = new Modulo(node, make, () => this.#unmountModule());
    // En un cuadrante el lienzo entra 1:1; en modo guia se agranda pero no
    // llena la mesa, y el sobrante es el margen por el que se desliza.
    const guia = this.region.w > 1920;
    this.#module.fit(this.region.w, this.region.h, guia ? DEBUG.guideScale : 1);
    this.el.append(this.#module.el);
    this.el.dataset.warning = 'none';
    this.#menu?.setHidden(true);
    gsap.fromTo(this.#module.el, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }

  #unmountModule() {
    if (!this.#module) return;
    this.#module.destroy();
    this.#module = null;
    this.el.dataset.warning = 'none';
    // La corona no vio el giro mientras estuvo la pieza: si no se rebasa,
    // al volver pega un salto proporcional a cuanto se giro adentro.
    this.#menu?.rebase();
    this.#menu?.setHidden(false);
  }

  /**
   * @param {import('@/core/types.js').Marker} marker
   * @param {import('@/core/types.js').Marker[]} others
   */
  update(marker, others) {
    if (!this.#menu) return;

    const local = this.toLocal(marker.x, marker.y);
    this.el.style.setProperty('--marker-x', `${Math.round(local.x)}px`);
    this.el.style.setProperty('--marker-y', `${Math.round(local.y)}px`);
    this.#menu.place(local.x, local.y, this.region.w);
    this.#syncSide(local.x);

    if (this.#module) {
      // Con una pieza montada el giro y la posicion son de la pieza, no de la
      // corona oculta. El aviso lo decide el modulo contra su propio lienzo.
      this.#module.applyRotation(marker.rotation);
      this.#module.applyPosition(local.x, local.y);
      const estorba = this.#module.overlaps;
      this.warningEl.dataset.visible = String(estorba);
      this.warningEl.textContent = i18n.t('warnPark');
      this.warningEl.style.transform = `translate(${local.x}px, ${local.y}px)`;
      this.el.dataset.warning = estorba ? 'park' : 'none';
      return;
    }

    this.#menu.applyRotation(marker.rotation);

    const proximity = evaluateProximity(marker, this.region, others);
    if (proximity.issue === 'none') {
      this.warningEl.dataset.visible = 'false';
    } else {
      this.warningEl.textContent =
        proximity.issue === 'edge' ? i18n.t('warnEdge') : i18n.t('warnNeighbour');
      this.warningEl.dataset.visible = 'true';
      this.warningEl.style.transform = `translate(${local.x}px, ${local.y}px)`;
    }
    this.el.dataset.warning = proximity.issue;
  }

  /**
   * El marcador define un lado, no un punto. La pieza ocupa el lado opuesto.
   * Dos estados espejados en vez de un layout distinto por cada posicion, y
   * una banda muerta en el medio para que no salte solo.
   * @param {number} localX
   */
  #syncSide(localX) {
    const w = this.region.w;
    if (localX < w * 0.42) this.#markerSide = 'left';
    else if (localX > w * 0.58) this.#markerSide = 'right';
    this.el.dataset.markerSide = this.#markerSide;
  }

  /** El marcador esta parado donde tiene que ir el contenido. */
  #isCentral(localX) {
    const limit = MARKER_COLUMN_W - MARKER_RADIUS - 40;
    return localX > limit && localX < this.region.w - limit;
  }
}
