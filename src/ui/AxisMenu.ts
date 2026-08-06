import gsap from 'gsap';
import {
  CORONA_OUTER_R,
  CORONA_R,
  CORONA_TRACK_GAP,
  MARKER_RADIUS,
  PANEL_EDGE_PAD,
  PANEL_MIN_W,
  PANEL_OFFSET,
} from '@/config/table';
import { i18n } from '@/i18n/i18n';
import type { Axis } from '@/core/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Punto sobre la orbita. 0 grados arriba, sentido horario. */
function orbitPoint(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

export interface AxisMenuCallbacks {
  onEnter(axis: Axis): void;
  onSelect(axis: Axis, index: number): void;
}

/**
 * La corona: nueve puntos en orbita alrededor del marcador fisico.
 *
 * El indice seleccionado es la fuente de verdad. El giro del marcador lo avanza
 * de a pasos; el toque lo fija directo. Nunca se lee el angulo absoluto del
 * marcador, porque un objeto fisico se apoya en cualquier orientacion.
 *
 * El punto activo se para del lado del panel: apunta al texto que estas leyendo.
 */
export class AxisMenu {
  readonly el: HTMLElement;

  private axes: Axis[];
  private callbacks: AxisMenuCallbacks;
  private stepDeg: number;

  private selectedIndex = 0;
  private lastRotation: number | null = null;
  private accumulator = 0;
  private entered = false;
  private side: 'left' | 'right' = 'right';
  private panelWidth = 0;

  private orbit!: SVGGElement;
  private dots: SVGCircleElement[] = [];
  private panel!: HTMLElement;
  private eyebrow!: HTMLElement;
  private title!: HTMLElement;
  private subtitle!: HTMLElement;
  private cta!: HTMLElement;
  private backButton!: HTMLButtonElement;

  constructor(axes: Axis[], callbacks: AxisMenuCallbacks) {
    this.axes = axes;
    this.callbacks = callbacks;
    this.stepDeg = 360 / axes.length;
    this.el = this.build();
    this.render(true);
    // Las metricas reales recien existen con la fuente cargada.
    void document.fonts.ready.then(() => this.fitTitle());
  }

  // --- API ------------------------------------------------------------------

  /**
   * Reposiciona la corona en coordenadas locales y le da al panel
   * todo el ancho que sobra hasta el borde. Asi el titulo entra en una linea
   * cuando hay lugar, sin achicar la tipografia cuando no lo hay.
   */
  place(localX: number, localY: number, regionW: number): void {
    this.el.style.transform = `translate(${localX}px, ${localY}px)`;

    const roomRight = regionW - localX - PANEL_OFFSET - PANEL_EDGE_PAD;
    const roomLeft = localX - PANEL_OFFSET - PANEL_EDGE_PAD;
    const side = roomRight >= Math.max(PANEL_MIN_W, roomLeft) ? 'right' : 'left';
    const width = Math.max(PANEL_MIN_W, side === 'right' ? roomRight : roomLeft);

    const resolved = Math.round(Math.min(width, regionW * 0.44));
    if (resolved !== this.panelWidth) {
      this.panelWidth = resolved;
      this.panel.style.width = `${resolved}px`;
      this.fitTitle();
    }

    if (side !== this.side) {
      this.side = side;
      this.el.dataset.side = side;
      this.spinOrbit(false);
    }
  }

  /** Traduce el giro del marcador en pasos de seleccion. */
  applyRotation(rotation: number): void {
    if (this.lastRotation === null) {
      this.lastRotation = rotation;
      return;
    }
    this.accumulator += rotation - this.lastRotation;
    this.lastRotation = rotation;

    while (Math.abs(this.accumulator) >= this.stepDeg) {
      const direction = this.accumulator > 0 ? 1 : -1;
      this.accumulator -= direction * this.stepDeg;
      this.step(direction);
    }
  }

  step(direction: 1 | -1 | number): void {
    const n = this.axes.length;
    this.select((this.selectedIndex + direction + n) % n);
  }

  select(index: number): void {
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.render(false);
    const axis = this.axes[index];
    if (axis) this.callbacks.onSelect(axis, index);
  }

  get current(): Axis | undefined {
    return this.axes[this.selectedIndex];
  }

  /** Resetea el acumulador cuando el marcador se levanta y se vuelve a apoyar. */
  detach(): void {
    this.lastRotation = null;
    this.accumulator = 0;
    this.exit();
  }

  destroy(): void {
    gsap.killTweensOf(this.orbit);
    this.el.remove();
  }

  // --- construccion ---------------------------------------------------------

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'menu';
    root.dataset.side = 'right';

    const size = (CORONA_OUTER_R + 20) * 2;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'menu__corona');
    svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));

    // Huella del objeto apoyado. No va nada adentro: el marcador la tapa.
    const footprint = document.createElementNS(SVG_NS, 'circle');
    footprint.setAttribute('class', 'menu__footprint');
    footprint.setAttribute('r', String(MARKER_RADIUS));
    svg.append(footprint);

    // Dos hairlines que encuadran la orbita. No giran.
    for (const r of [CORONA_R - CORONA_TRACK_GAP, CORONA_R + CORONA_TRACK_GAP]) {
      const track = document.createElementNS(SVG_NS, 'circle');
      track.setAttribute('class', 'menu__track');
      track.setAttribute('r', String(r));
      svg.append(track);
    }

    this.orbit = document.createElementNS(SVG_NS, 'g');
    this.orbit.setAttribute('class', 'menu__orbit');

    this.axes.forEach((axis, index) => {
      const [x, y] = orbitPoint(CORONA_R, index * this.stepDeg);

      // Area de toque generosa, invisible: el punto dibujado es chico a proposito.
      const hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('class', 'menu__hit');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y));
      hit.setAttribute('r', '48');
      hit.dataset.index = String(index);
      hit.dataset.axis = axis.id;
      this.orbit.append(hit);

      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'menu__dot');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', '9');
      dot.dataset.index = String(index);
      this.orbit.append(dot);
      this.dots.push(dot);
    });

    svg.append(this.orbit);
    root.append(svg);

    this.panel = document.createElement('div');
    this.panel.className = 'menu__panel';
    this.panel.innerHTML = `
      <p class="menu__eyebrow"></p>
      <h2 class="menu__title"></h2>
      <p class="menu__subtitle"></p>
      <div class="menu__cta"></div>`;
    root.append(this.panel);

    this.backButton = document.createElement('button');
    this.backButton.className = 'menu__back';
    this.backButton.type = 'button';
    this.backButton.textContent = i18n.t('back');
    root.append(this.backButton);

    this.eyebrow = this.panel.querySelector('.menu__eyebrow')!;
    this.title = this.panel.querySelector('.menu__title')!;
    this.subtitle = this.panel.querySelector('.menu__subtitle')!;
    this.cta = this.panel.querySelector('.menu__cta')!;

    this.bindTouch(root);
    return root;
  }

  /** El toque replica todo lo que hace el marcador. El giro es mejora, no requisito. */
  private bindTouch(root: HTMLElement): void {
    root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('.menu__back')) {
        this.exit();
        event.stopPropagation();
        return;
      }

      const hit = target.closest<SVGCircleElement>('.menu__hit');
      if (hit?.dataset.index) {
        this.select(Number.parseInt(hit.dataset.index, 10));
        event.stopPropagation();
        return;
      }

      if (target.closest('.menu__panel') && !this.entered) {
        this.enter();
        event.stopPropagation();
      }
    });
  }

  private enter(): void {
    const axis = this.current;
    if (!axis) return;
    this.entered = true;
    this.el.dataset.entered = 'true';
    this.cta.textContent = i18n.t('ctaPending');
    this.callbacks.onEnter(axis);
  }

  private exit(): void {
    if (!this.entered) return;
    this.entered = false;
    this.el.dataset.entered = 'false';
    this.cta.textContent = i18n.t('ctaEnter');
  }

  // --- render ---------------------------------------------------------------

  /**
   * Con el marcador en el centro de un cuadrante quedan ~530 px de panel,
   * y los titulos mas largos no entran en una linea al cuerpo base.
   * En vez de bajar el cuerpo para todos, se ajusta por titulo con un piso.
   */
  private fitTitle(): void {
    if (this.panelWidth === 0) return;
    this.title.style.setProperty('--title-fit', '1');
    this.title.style.whiteSpace = 'nowrap';
    const needed = this.title.scrollWidth;
    this.title.style.whiteSpace = '';
    if (needed === 0) return;
    const fit = Math.min(1, Math.max(0.62, this.panelWidth / needed));
    this.title.style.setProperty('--title-fit', fit.toFixed(3));
  }

  /** El punto activo se para del lado del panel. */
  private targetAngle(): number {
    return this.side === 'right' ? 90 : 270;
  }

  private spinOrbit(immediate: boolean): void {
    const angle = this.targetAngle() - this.selectedIndex * this.stepDeg;
    if (immediate) {
      gsap.set(this.orbit, { rotation: angle, svgOrigin: '0 0' });
    } else {
      gsap.to(this.orbit, {
        rotation: angle,
        svgOrigin: '0 0',
        duration: 0.44,
        ease: 'power3.out',
        overwrite: true,
      });
    }
  }

  private render(immediate: boolean): void {
    const axis = this.axes[this.selectedIndex];
    if (!axis) return;

    this.dots.forEach((dot, index) => {
      const active = index === this.selectedIndex;
      dot.dataset.active = String(active);
      dot.setAttribute('r', active ? '14' : '9');
    });

    this.spinOrbit(immediate);

    this.eyebrow.textContent = i18n
      .t('axisCounter')
      .replace('{n}', String(this.selectedIndex + 1))
      .replace('{total}', String(this.axes.length));
    this.title.textContent = axis.title;
    this.fitTitle();
    this.subtitle.textContent = axis.subtitle;
    this.cta.textContent = this.entered ? i18n.t('ctaPending') : i18n.t('ctaEnter');

    if (!immediate) {
      gsap.fromTo(
        this.panel,
        { opacity: 0.4 },
        { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
