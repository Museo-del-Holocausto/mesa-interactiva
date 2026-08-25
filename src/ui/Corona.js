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
import { Rotary } from '@/core/Rotary.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Alto de fila del selector y cuantas se ven a la vez. */
const ROW_H = 76;
const VISIBLE_ROWS = 4;

/**
 * Punto sobre la orbita. 0 grados arriba, sentido horario.
 * @param {number} r @param {number} deg
 */
function orbitPoint(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

/**
 * La corona: navegador de arbol anclado al marcador fisico.
 *
 * Una sola regla, valga la profundidad que valga:
 *   la rosca recorre hermanos, el toque entra y opera.
 *
 * El arbol no tiene profundidad fija. Los ejes 1, 2, 4 a 9 son eje -> items.
 * El eje 3 es eje -> submodulo -> item, porque tiene dos piezas adentro.
 * La corona no sabe cuantos niveles hay: apila un cuadro por nivel y listo.
 *
 * Cada nodo declara como se muestran sus hijos con `display`:
 *   destacado  de a uno, con bajada  (pocos hijos, cada uno pide explicacion)
 *   lista      selector vertical      (muchos hijos, se recorren)
 *
 * Un nodo sin hijos es una hoja: ahi la rosca queda inerte y se opera solo con toque.
 */
export class Corona {
  /** @type {{ nodes: any[], parent: any|null, index: number }[]} */
  #stack = [];
  #rotary = new Rotary();
  #side = 'right';
  #panelWidth = 0;
  /** @type {SVGCircleElement[]} */
  #dots = [];
  #listKey = '';

  /**
   * @param {any[]} axes
   * @param {{ onNavigate?: Function }} [callbacks]
   */
  constructor(axes, callbacks = {}) {
    this.callbacks = callbacks;
    this.el = this.#build();
    this.#stack = [{ nodes: axes, parent: null, index: 0 }];
    this.#refresh(true);
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
    this.#rotary.feed(rotation, this.#stepDeg(), (direction) => this.step(direction));
  }

  /** @param {number} direction */
  step(direction) {
    const n = this.#frame().nodes.length;
    if (n === 0) return; // hoja: no hay hermanos que recorrer
    this.select((this.#frame().index + direction + n) % n);
  }

  /** @param {number} index */
  select(index) {
    const frame = this.#frame();
    if (frame.nodes.length === 0 || index === frame.index) return;
    frame.index = index;
    this.#render(false);
  }

  /** Resetea cuando el marcador se levanta y se vuelve a apoyar. */
  detach() {
    this.#rotary.reset();
    this.#stack.length = 1;
    this.#frame().index = 0;
    this.#refresh(true);
  }

  destroy() {
    gsap.killTweensOf([this.orbit, this.slot, this.list, this.panel]);
    this.el.remove();
  }

  // --- arbol ----------------------------------------------------------------

  #frame() {
    return this.#stack[this.#stack.length - 1];
  }

  /** El nodo bajo la ranura de lectura. */
  #node() {
    const frame = this.#frame();
    return frame.nodes[frame.index];
  }

  #depth() {
    return this.#stack.length - 1;
  }

  #isLeaf() {
    return this.#frame().nodes.length === 0;
  }

  /** Como se muestran los hijos del nivel actual. Lo declara el padre. */
  #display() {
    if (this.#isLeaf()) return 'contenido';
    return this.#frame().parent?.display ?? (this.#depth() === 0 ? 'destacado' : 'lista');
  }

  #stepDeg() {
    const n = this.#frame().nodes.length;
    return n > 0 ? 360 / n : 40;
  }

  #forward() {
    const node = this.#node();
    if (!node) return;
    // Eje sin resolver: no se entra. El rotulo ya dice que esta en desarrollo.
    if (node.estado === 'pendiente') return;
    // Un nodo con modulo propio no abre hijos: lo monta el cuadrante.
    if (node.module) {
      this.callbacks.onModule?.(node);
      return;
    }
    this.#stack.push({ nodes: node.children ?? [], parent: node, index: 0 });
    this.#refresh(false);
  }

  #back() {
    if (this.#stack.length <= 1) return;
    this.#stack.pop();
    this.#refresh(false);
  }

  /** @param {boolean} immediate */
  #refresh(immediate) {
    this.#rotary.reset();
    this.el.dataset.display = this.#display();
    this.el.dataset.depth = String(this.#depth());
    this.#buildOrbit(this.#frame().nodes.length);
    this.#render(immediate);
    this.callbacks.onNavigate?.(this.#stack.map((f) => f.parent?.id ?? 'root'));
  }

  // --- construccion ---------------------------------------------------------

  #build() {
    const root = document.createElement('div');
    root.className = 'menu';
    root.dataset.side = 'right';

    const size = (PANEL_OFFSET + 20) * 2;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'menu__corona');
    svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));

    // Huella del objeto apoyado. Va sin relleno: abajo esta el marcador.
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
      <div class="menu__view" data-view="destacado">
        <p class="menu__eyebrow" data-slot="eyebrow"></p>
        <h2 class="menu__title" data-slot="title"></h2>
        <p class="menu__subtitle" data-slot="subtitle"></p>
      </div>
      <div class="menu__view" data-view="lista">
        <p class="menu__eyebrow" data-slot="eyebrow"></p>
        <div class="menu__picker"><ul class="menu__list"></ul></div>
      </div>
      <div class="menu__view" data-view="contenido">
        <p class="menu__eyebrow" data-slot="eyebrow"></p>
        <p class="menu__kicker" data-slot="kicker"></p>
        <h2 class="menu__title" data-slot="title"></h2>
        <p class="menu__body" data-slot="body"></p>
      </div>
      <div class="menu__cta"></div>`;
    root.append(this.panel);

    this.backButton = document.createElement('button');
    this.backButton.className = 'menu__back';
    this.backButton.type = 'button';
    this.backButton.textContent = i18n.t('back');
    root.append(this.backButton);

    this.views = {
      destacado: this.panel.querySelector('[data-view="destacado"]'),
      lista: this.panel.querySelector('[data-view="lista"]'),
      contenido: this.panel.querySelector('[data-view="contenido"]'),
    };
    this.list = this.panel.querySelector('.menu__list');
    this.cta = this.panel.querySelector('.menu__cta');
    this.panel.querySelector('.menu__picker').style.height = `${ROW_H * VISIBLE_ROWS}px`;

    this.#bindTouch(root);
    this.#spinSlot(true);
    return root;
  }

  /**
   * La orbita se reconstruye por nivel: es el mismo widget mostrando
   * otro conjunto de hermanos.
   * @param {number} count
   */
  #buildOrbit(count) {
    this.orbit.replaceChildren();
    this.#dots = [];
    if (count === 0) return;
    const step = 360 / count;
    const hitR = Math.min(48, (Math.PI * CORONA_R) / count);

    for (let index = 0; index < count; index += 1) {
      const [x, y] = orbitPoint(CORONA_R, index * step);

      // Area de toque generosa, invisible: el punto dibujado es chico a proposito.
      const hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('class', 'menu__hit');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y));
      hit.setAttribute('r', String(hitR));
      hit.dataset.index = String(index);
      this.orbit.append(hit);

      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'menu__dot');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', '8');
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
        if (index === this.#frame().index) this.#forward();
        else this.select(index);
        return;
      }

      const hit = target.closest('.menu__hit');
      if (hit?.dataset.index) {
        this.select(Number.parseInt(hit.dataset.index, 10));
        return;
      }

      if (!this.#isLeaf() && target.closest('.menu__panel')) this.#forward();
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
    if (this.#isLeaf()) return;
    const vars = {
      rotation: this.#targetAngle() - this.#frame().index * this.#stepDeg(),
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
    for (const node of this.panel.querySelectorAll('.menu__title')) {
      node.style.setProperty('--title-fit', '1');
      node.style.whiteSpace = 'nowrap';
      const needed = node.scrollWidth;
      node.style.whiteSpace = '';
      if (needed === 0) continue;
      node.style.setProperty(
        '--title-fit',
        Math.min(1, Math.max(0.58, this.#panelWidth / needed)).toFixed(3),
      );
    }
  }

  /** El rotulo de contexto: donde estas parado. */
  #eyebrow() {
    const frame = this.#frame();
    if (this.#depth() === 0) {
      return i18n
        .t('axisCounter')
        .replace('{n}', String(frame.index + 1))
        .replace('{total}', String(frame.nodes.length));
    }
    const parentTitle = frame.parent?.title ?? '';
    if (this.#isLeaf()) return parentTitle;
    return `${parentTitle} · ${frame.index + 1}/${frame.nodes.length}`;
  }

  /** El listado se comporta como un dial: la fila elegida entra en la ranura. */
  #renderList(immediate) {
    const frame = this.#frame();
    const key = `${frame.parent?.id ?? 'root'}:${frame.nodes.length}`;
    if (this.#listKey !== key) {
      this.#listKey = key;
      this.list.replaceChildren();
      frame.nodes.forEach((node, index) => {
        const row = document.createElement('li');
        row.className = 'menu__row';
        row.dataset.index = String(index);
        row.style.height = `${ROW_H}px`;
        // Rotulo, filete y accion en la misma linea: asi la pila se lee como
        // un listado y no como bloques apilados.
        row.innerHTML =
          '<span class="menu__row-tx">' +
          `${node.kicker ? `<span class="menu__row-kicker">${node.kicker}</span>` : ''}` +
          `<span class="menu__row-title">${node.title}</span>` +
          '</span>' +
          '<span class="menu__row-line"></span>' +
          `<span class="menu__row-cta">${
            node.estado === 'pendiente' ? i18n.t('ctaDev') : i18n.t('ctaOpen')
          }</span>`;
        this.list.append(row);
      });
    }

    [...this.list.children].forEach((row, index) => {
      row.dataset.active = String(index === frame.index);
    });

    const y = -frame.index * ROW_H;
    if (immediate) gsap.set(this.list, { y });
    else gsap.to(this.list, { y, duration: 0.4, ease: 'power3.out', overwrite: true });
  }

  /** Vuelve a tomar el angulo actual como cero. */
  rebase() {
    this.#rotary.reset();
  }

  /** Oculta la corona mientras hay un modulo montado encima. */
  setHidden(hidden) {
    this.el.dataset.hidden = String(hidden);
  }

  /** @param {boolean} immediate */
  #render(immediate) {
    const display = this.#display();
    this.el.dataset.display = display;
    const view = this.views[display];
    const node = this.#isLeaf() ? this.#frame().parent : this.#node();
    if (!view || !node) return;

    this.#dots.forEach((dot, index) => {
      dot.dataset.active = String(index === this.#frame().index);
      // Los ejes en desarrollo se ven apagados en la orbita: de un vistazo se
      // distingue lo terminado de lo que falta.
      dot.dataset.estado = this.#frame().nodes[index]?.estado ?? 'listo';
    });
    this.#spinOrbit(immediate);

    const set = (slot, value) => {
      const el = view.querySelector(`[data-slot="${slot}"]`);
      if (!el) return;
      el.textContent = value ?? '';
      el.hidden = !value;
    };

    set('eyebrow', this.#eyebrow());

    if (display === 'lista') {
      this.#renderList(immediate);
    } else if (display === 'destacado') {
      set('title', node.title);
      set('subtitle', node.subtitle);
    } else {
      set('kicker', node.kicker);
      set('title', node.title);
      set('body', node.body);
    }

    const pendiente = node.estado === 'pendiente';
    this.el.dataset.estado = pendiente ? 'pendiente' : 'listo';
    this.cta.textContent = pendiente
      ? i18n.t('ctaDev')
      : display === 'destacado'
        ? i18n.t('ctaEnter')
        : display === 'lista'
          ? i18n.t('ctaOpen')
          : i18n.t('ctaPending');
    // En la lista la accion la lleva la fila activa: el boton suelto sobra.
    // En la lista la accion la lleva la fila activa: el boton suelto sobra.
    this.cta.hidden = display === 'lista' || (display === 'contenido' && Boolean(node.body));

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
