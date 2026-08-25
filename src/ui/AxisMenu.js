import gsap from 'gsap';
import {
  CORONA_R,
  CORONA_TRACK_GAP,
  MARKER_RADIUS,
  PANEL_EDGE_PAD,
  PANEL_MIN_W,
  PANEL_OFFSET,
} from '@/config/table.js';
import { i18n } from '@/i18n/i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Alto de fila del selector y cuantas se ven a la vez. */
const ROW_H = 64;
const VISIBLE_ROWS = 7;

/**
 * Punto sobre la orbita. 0 grados arriba, sentido horario.
 * @param {number} r @param {number} deg
 */
function orbitPoint(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

/**
 * La corona: nueve puntos en orbita alrededor del marcador fisico.
 *
 * Gramatica de entrada, una sola regla en los tres niveles:
 *   la rosca recorre hermanos, el toque entra y opera.
 *
 *   ejes     la rosca recorre los 9 ejes
 *   items    la rosca recorre los items del eje
 *   contenido  la rosca no hace nada: adentro se opera solo con toque
 *
 * El indice seleccionado es la fuente de verdad. El giro lo avanza de a pasos,
 * nunca por angulo absoluto: un objeto fisico se apoya en cualquier orientacion.
 *
 * La posicion de lectura no esta a las 12 sino del lado del panel. Un aro fijo
 * marca la ranura y una linea la ata al texto; los puntos giran y el elegido
 * entra en la ranura.
 */
export class AxisMenu {
  /** @type {'ejes'|'items'|'contenido'} */
  #level = 'ejes';
  #axisIndex = 0;
  #itemIndex = 0;
  #lastRotation = null;
  #accumulator = 0;
  #side = 'right';
  #panelWidth = 0;
  /** @type {SVGCircleElement[]} */
  #dots = [];
  /** @type {HTMLElement[]} */
  #rows = [];

  /**
   * @param {import('@/core/types.js').Axis[]} axes
   * @param {{ onEnter: Function, onOpen: Function, onSelect: Function }} callbacks
   */
  constructor(axes, callbacks) {
    this.axes = axes;
    this.callbacks = callbacks;
    this.el = this.#build();
    this.#goto('ejes', true);
    // Las metricas reales recien existen con la fuente cargada.
    void document.fonts.ready.then(() => this.#fitTitle());
  }

  // --- API ------------------------------------------------------------------

  /**
   * Reposiciona la corona en coordenadas locales y le da al panel todo el ancho
   * que sobra hasta el borde. Se usan left/top y no transform: el transform del
   * elemento queda libre para las animaciones de GSAP.
   * @param {number} localX @param {number} localY @param {number} regionW
   */
  place(localX, localY, regionW) {
    this.el.style.left = `${localX}px`;
    this.el.style.top = `${localY}px`;

    const roomRight = regionW - localX - PANEL_OFFSET - PANEL_EDGE_PAD;
    const roomLeft = localX - PANEL_OFFSET - PANEL_EDGE_PAD;
    const side = roomRight >= Math.max(PANEL_MIN_W, roomLeft) ? 'right' : 'left';
    const width = Math.max(PANEL_MIN_W, side === 'right' ? roomRight : roomLeft);

    const resolved = Math.round(Math.min(width, regionW * 0.44));
    if (resolved !== this.#panelWidth) {
      this.#panelWidth = resolved;
      this.panel.style.width = `${resolved}px`;
      this.#fitTitle();
    }

    if (side !== this.#side) {
      this.#side = side;
      this.el.dataset.side = side;
      this.#spinSlot(false);
      this.#spinOrbit(false);
    }
  }

  /**
   * Traduce el giro del marcador en pasos de seleccion.
   * @param {number} rotation
   */
  applyRotation(rotation) {
    if (this.#lastRotation === null) {
      this.#lastRotation = rotation;
      return;
    }
    this.#accumulator += rotation - this.#lastRotation;
    this.#lastRotation = rotation;

    const step = this.#stepDeg();
    while (Math.abs(this.#accumulator) >= step) {
      const direction = this.#accumulator > 0 ? 1 : -1;
      this.#accumulator -= direction * step;
      this.step(direction);
    }
  }

  /** @param {number} direction */
  step(direction) {
    if (this.#level === 'contenido') return; // adentro no hay hermanos que recorrer
    const list = this.#siblings();
    const n = list.length;
    if (n === 0) return;
    const next = (this.#index() + direction + n) % n;
    this.select(next);
  }

  /** @param {number} index */
  select(index) {
    if (this.#level === 'contenido') return;
    if (index === this.#index()) return;
    if (this.#level === 'ejes') {
      this.#axisIndex = index;
      this.#itemIndex = 0;
    } else {
      this.#itemIndex = index;
    }
    this.#render(false);
    this.callbacks.onSelect?.(this.#level, index);
  }

  get axis() {
    return this.axes[this.#axisIndex];
  }

  get level() {
    return this.#level;
  }

  /** Resetea el acumulador cuando el marcador se levanta y se vuelve a apoyar. */
  detach() {
    this.#lastRotation = null;
    this.#accumulator = 0;
    this.#goto('ejes', true);
  }

  destroy() {
    gsap.killTweensOf([this.orbit, this.slot, this.list, this.panel]);
    this.el.remove();
  }

  // --- niveles --------------------------------------------------------------

  #siblings() {
    if (this.#level === 'ejes') return this.axes;
    return this.axis?.items ?? [];
  }

  #index() {
    return this.#level === 'ejes' ? this.#axisIndex : this.#itemIndex;
  }

  #stepDeg() {
    const n = this.#siblings().length;
    return n > 0 ? 360 / n : 40;
  }

  /**
   * @param {'ejes'|'items'|'contenido'} level
   * @param {boolean} immediate
   */
  #goto(level, immediate) {
    this.#level = level;
    this.el.dataset.level = level;
    this.#accumulator = 0;
    if (level !== 'contenido') this.#buildOrbit(this.#siblings().length);
    this.#render(immediate);
  }

  #back() {
    if (this.#level === 'contenido') this.#goto('items', false);
    else if (this.#level === 'items') this.#goto('ejes', false);
  }

  #forward() {
    if (this.#level === 'ejes') {
      this.#itemIndex = 0;
      this.#goto('items', false);
      this.callbacks.onEnter?.(this.axis);
    } else if (this.#level === 'items') {
      const item = this.#siblings()[this.#itemIndex];
      this.#goto('contenido', false);
      this.callbacks.onOpen?.(this.axis, item);
    }
  }

  // --- construccion ---------------------------------------------------------

  #build() {
    const root = document.createElement('div');
    root.className = 'menu';
    root.dataset.side = 'right';
    root.dataset.level = 'ejes';

    const size = (PANEL_OFFSET + 20) * 2;
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

    // Ranura de lectura: fija, del lado del panel. Es lo que hace legible la seleccion.
    this.slot = document.createElementNS(SVG_NS, 'g');
    this.slot.setAttribute('class', 'menu__slot');

    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('class', 'menu__halo');
    halo.setAttribute('cx', '0');
    halo.setAttribute('cy', String(-CORONA_R));
    halo.setAttribute('r', '28');
    this.slot.append(halo);

    const leader = document.createElementNS(SVG_NS, 'line');
    leader.setAttribute('class', 'menu__leader');
    leader.setAttribute('x1', '0');
    leader.setAttribute('y1', String(-(CORONA_R + 40)));
    leader.setAttribute('x2', '0');
    leader.setAttribute('y2', String(-(PANEL_OFFSET - 24)));
    this.slot.append(leader);
    svg.append(this.slot);

    this.orbit = document.createElementNS(SVG_NS, 'g');
    this.orbit.setAttribute('class', 'menu__orbit');
    svg.append(this.orbit);
    root.append(svg);

    this.panel = document.createElement('div');
    this.panel.className = 'menu__panel';
    this.panel.innerHTML = `
      <div class="menu__view" data-view="ejes">
        <p class="menu__eyebrow"></p>
        <h2 class="menu__title"></h2>
        <p class="menu__subtitle"></p>
      </div>
      <div class="menu__view" data-view="items">
        <p class="menu__eyebrow menu__eyebrow--items"></p>
        <div class="menu__picker"><ul class="menu__list"></ul></div>
      </div>
      <div class="menu__view" data-view="contenido">
        <p class="menu__eyebrow menu__eyebrow--contenido"></p>
        <h2 class="menu__title menu__title--contenido"></h2>
      </div>
      <div class="menu__cta"></div>`;
    root.append(this.panel);

    this.backButton = document.createElement('button');
    this.backButton.className = 'menu__back';
    this.backButton.type = 'button';
    this.backButton.textContent = i18n.t('back');
    root.append(this.backButton);

    this.eyebrow = this.panel.querySelector('.menu__view[data-view="ejes"] .menu__eyebrow');
    this.title = this.panel.querySelector('.menu__view[data-view="ejes"] .menu__title');
    this.subtitle = this.panel.querySelector('.menu__subtitle');
    this.itemsEyebrow = this.panel.querySelector('.menu__eyebrow--items');
    this.list = this.panel.querySelector('.menu__list');
    this.contentEyebrow = this.panel.querySelector('.menu__eyebrow--contenido');
    this.contentTitle = this.panel.querySelector('.menu__title--contenido');
    this.cta = this.panel.querySelector('.menu__cta');

    this.panel.querySelector('.menu__picker').style.height = `${ROW_H * VISIBLE_ROWS}px`;

    this.#bindTouch(root);
    this.#spinSlot(true);
    return root;
  }

  /**
   * La orbita se reconstruye por nivel: 9 puntos para los ejes, N para los items.
   * Es el mismo widget mostrando otro conjunto de hermanos.
   * @param {number} count
   */
  #buildOrbit(count) {
    this.orbit.replaceChildren();
    this.#dots = [];
    const step = count > 0 ? 360 / count : 40;

    for (let index = 0; index < count; index += 1) {
      const [x, y] = orbitPoint(CORONA_R, index * step);

      // Area de toque generosa, invisible: el punto dibujado es chico a proposito.
      const hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('class', 'menu__hit');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y));
      hit.setAttribute('r', String(Math.min(48, (Math.PI * CORONA_R) / count)));
      hit.dataset.index = String(index);
      this.orbit.append(hit);

      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'menu__dot');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', '8');
      dot.dataset.index = String(index);
      this.orbit.append(dot);
      this.#dots.push(dot);
    }
  }

  /**
   * El toque replica todo lo que hace el marcador. El giro es mejora, no requisito.
   * @param {HTMLElement} root
   */
  #bindTouch(root) {
    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      if (target.closest('.menu__back')) {
        this.#back();
        return;
      }

      const row = target.closest('.menu__row');
      if (row?.dataset.index) {
        const index = Number.parseInt(row.dataset.index, 10);
        // Tocar una fila ya activa la abre: seleccionar y entrar en un solo gesto.
        if (index === this.#itemIndex) this.#forward();
        else this.select(index);
        return;
      }

      const hit = target.closest('.menu__hit');
      if (hit?.dataset.index) {
        this.select(Number.parseInt(hit.dataset.index, 10));
        return;
      }

      if (target.closest('.menu__cta') || target.closest('.menu__view')) {
        this.#forward();
      }
    });
  }

  // --- render ---------------------------------------------------------------

  /** La posicion de lectura: a las 3 si el panel esta a la derecha, a las 9 si esta a la izquierda. */
  #targetAngle() {
    return this.#side === 'right' ? 90 : 270;
  }

  /** @param {boolean} immediate */
  #spinSlot(immediate) {
    const vars = { rotation: this.#targetAngle(), svgOrigin: '0 0' };
    if (immediate) gsap.set(this.slot, vars);
    else gsap.to(this.slot, { ...vars, duration: 0.44, ease: 'power3.out', overwrite: true });
  }

  /** @param {boolean} immediate */
  #spinOrbit(immediate) {
    if (this.#level === 'contenido') return;
    const vars = {
      rotation: this.#targetAngle() - this.#index() * this.#stepDeg(),
      svgOrigin: '0 0',
    };
    if (immediate) gsap.set(this.orbit, vars);
    else gsap.to(this.orbit, { ...vars, duration: 0.44, ease: 'power3.out', overwrite: true });
  }

  /**
   * Con el marcador en el centro de un cuadrante quedan ~530 px de panel,
   * y los titulos mas largos no entran en una linea al cuerpo base.
   * En vez de bajar el cuerpo para todos, se ajusta por titulo con un piso.
   */
  #fitTitle() {
    if (this.#panelWidth === 0) return;
    for (const node of [this.title, this.contentTitle]) {
      node.style.setProperty('--title-fit', '1');
      node.style.whiteSpace = 'nowrap';
      const needed = node.scrollWidth;
      node.style.whiteSpace = '';
      if (needed === 0) continue;
      node.style.setProperty(
        '--title-fit',
        Math.min(1, Math.max(0.62, this.#panelWidth / needed)).toFixed(3),
      );
    }
  }

  /** Renderiza la lista de items como un selector: la fila activa queda en la ranura. */
  #renderList(immediate) {
    const items = this.axis?.items ?? [];
    if (this.#rows.length !== items.length || this.list.dataset.axis !== this.axis?.id) {
      this.list.replaceChildren();
      this.#rows = items.map((item, index) => {
        const row = document.createElement('li');
        row.className = 'menu__row';
        row.dataset.index = String(index);
        row.style.height = `${ROW_H}px`;
        row.textContent = item.title;
        this.list.append(row);
        return row;
      });
      this.list.dataset.axis = this.axis?.id ?? '';
    }

    this.#rows.forEach((row, index) => {
      row.dataset.active = String(index === this.#itemIndex);
    });

    const y = -this.#itemIndex * ROW_H;
    if (immediate) gsap.set(this.list, { y });
    else gsap.to(this.list, { y, duration: 0.4, ease: 'power3.out', overwrite: true });
  }

  /** @param {boolean} immediate */
  #render(immediate) {
    const axis = this.axis;
    if (!axis) return;

    this.#dots.forEach((dot, index) => {
      dot.dataset.active = String(index === this.#index());
    });
    this.#spinOrbit(immediate);

    // Nivel ejes
    this.eyebrow.textContent = i18n
      .t('axisCounter')
      .replace('{n}', String(this.#axisIndex + 1))
      .replace('{total}', String(this.axes.length));
    this.title.textContent = axis.title;
    this.subtitle.textContent = axis.subtitle;

    // Nivel items
    this.itemsEyebrow.textContent = axis.title;
    this.#renderList(immediate);

    // Nivel contenido
    const item = (axis.items ?? [])[this.#itemIndex];
    this.contentEyebrow.textContent = axis.title;
    this.contentTitle.textContent = item?.title ?? '';

    this.cta.textContent =
      this.#level === 'ejes'
        ? i18n.t('ctaEnter')
        : this.#level === 'items'
          ? i18n.t('ctaOpen')
          : i18n.t('ctaPending');

    this.#fitTitle();

    if (!immediate) {
      gsap.fromTo(
        this.panel,
        { opacity: 0.4 },
        { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
