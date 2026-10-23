import gsap from 'gsap';
import { MOTION } from '@/config/motion.js';
import { MARKER_RADIUS } from '@/config/table.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** El anillo abraza al objeto: apenas por fuera de su borde. */
const RING_R = MARKER_RADIUS + 16;
const TICKS = 48;
const TICK_LEN = 9;
const SIZE = (RING_R + 90) * 2;
const ARC_LEN = 2 * Math.PI * RING_R;

/**
 * La huella del marcador: el anillo que confirma que la mesa vio el objeto.
 *
 *   apoyar    el anillo se dibuja alrededor y sale una onda hacia afuera
 *   girar     las marcas giran con el objeto: lo físico y lo dibujado van juntos
 *   levantar  el anillo queda donde estaba y se vacía en los segundos de gracia,
 *             con la cuenta en el centro. Si el objeto vuelve, se recompone.
 *
 * Vive en el cuadrante y se posiciona con --marker-x / --marker-y, que el
 * cuadrante ya actualiza en cada lectura.
 */
export class Huella {
  #visible = false;
  #countdown = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'huella';
    this.el.dataset.estado = 'oculta';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`);
    svg.setAttribute('width', String(SIZE));
    svg.setAttribute('height', String(SIZE));

    // Onda de confirmación: un aro que se expande una sola vez al apoyar.
    this.onda = document.createElementNS(SVG_NS, 'circle');
    this.onda.setAttribute('class', 'huella__onda');
    this.onda.setAttribute('r', String(RING_R));
    svg.append(this.onda);

    // Latido: la misma onda en gris, cada vez que el giro cambia la selección.
    this.latidoEl = document.createElementNS(SVG_NS, 'circle');
    this.latidoEl.setAttribute('class', 'huella__latido');
    this.latidoEl.setAttribute('r', String(RING_R));
    svg.append(this.latidoEl);

    // Marcas que giran con el objeto. Una más larga hace de índice.
    // Dos grupos: el de afuera gira con el objeto, el de adentro lo anima GSAP.
    this.giro = document.createElementNS(SVG_NS, 'g');
    this.giro.setAttribute('class', 'huella__giro');
    this.ticks = document.createElementNS(SVG_NS, 'g');
    this.ticks.setAttribute('class', 'huella__ticks');
    this.giro.append(this.ticks);
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * Math.PI * 2;
      const len = i === 0 ? TICK_LEN * 2.4 : TICK_LEN;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(Math.sin(a) * RING_R));
      line.setAttribute('y1', String(-Math.cos(a) * RING_R));
      line.setAttribute('x2', String(Math.sin(a) * (RING_R + len)));
      line.setAttribute('y2', String(-Math.cos(a) * (RING_R + len)));
      if (i === 0) line.setAttribute('class', 'huella__indice');
      this.ticks.append(line);
    }
    svg.append(this.giro);

    // Cuenta regresiva: arco que se vacía. Arranca arriba y va en sentido horario.
    this.arco = document.createElementNS(SVG_NS, 'circle');
    this.arco.setAttribute('class', 'huella__arco');
    this.arco.setAttribute('r', String(RING_R));
    this.arco.setAttribute('transform', 'rotate(-90)');
    this.arco.setAttribute('stroke-dasharray', String(ARC_LEN));
    svg.append(this.arco);

    this.el.append(svg);

    this.segundos = document.createElement('p');
    this.segundos.className = 'huella__segundos';
    this.el.append(this.segundos);
  }

  /** El objeto apareció (o volvió). */
  mostrar() {
    this.#cancelarCuenta();
    const venia = this.#visible;
    this.#visible = true;
    this.el.dataset.estado = 'activa';
    gsap.killTweensOf([this.el, this.ticks, this.onda]);
    gsap.set(this.el, { opacity: 1 });

    this.#onda(this.onda, 0.7);

    // Volver de la cuenta regresiva: las marcas se reencienden, sin rearmarse.
    if (venia) {
      gsap.fromTo(this.ticks, { opacity: 0.3 }, { opacity: 1, duration: MOTION.dur.paso, ease: MOTION.ease.sale });
      return;
    }

    gsap.fromTo(
      this.ticks,
      { opacity: 0, scale: 0.86, transformOrigin: '50% 50%' },
      { opacity: 1, scale: 1, duration: MOTION.dur.entrada, ease: MOTION.ease.firme },
    );
  }

  /** El giro cambió la selección: una onda gris, más corta que la de apoyar. */
  latido() {
    if (!this.#visible) return;
    this.#onda(this.latidoEl, 0.5, 56);
  }

  /**
   * Un aro que sale del anillo hacia afuera y se apaga.
   * @param {SVGCircleElement} el @param {number} opacity @param {number} [reach] px
   */
  #onda(el, opacity, reach = 80) {
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { attr: { r: RING_R }, opacity },
      { attr: { r: RING_R + reach }, opacity: 0, duration: MOTION.dur.largo, ease: MOTION.ease.sale },
    );
  }

  /** @param {number} grados */
  girar(grados) {
    this.giro.style.transform = `rotate(${grados}deg)`;
  }

  /**
   * El objeto se levantó: el anillo se vacía durante la gracia.
   * @param {number} ms
   */
  cuenta(ms) {
    if (!this.#visible) return;
    this.#cancelarCuenta();
    this.el.dataset.estado = 'cuenta';
    const total = ms / 1000;
    const state = { t: 0 };
    this.segundos.textContent = String(Math.ceil(total));
    gsap.set(this.arco, { attr: { 'stroke-dashoffset': 0 } });
    this.#countdown = gsap.to(state, {
      t: total,
      duration: total,
      ease: MOTION.ease.lineal,
      onUpdate: () => {
        gsap.set(this.arco, { attr: { 'stroke-dashoffset': -(state.t / total) * ARC_LEN } });
        this.segundos.textContent = String(Math.max(1, Math.ceil(total - state.t)));
      },
    });
  }

  /** Se terminó la gracia o se cerró el cuadrante. */
  ocultar() {
    this.#cancelarCuenta();
    if (!this.#visible) return;
    this.#visible = false;
    gsap.to(this.el, {
      opacity: 0,
      duration: MOTION.dur.escena,
      ease: MOTION.ease.sale,
      onComplete: () => {
        if (!this.#visible) this.el.dataset.estado = 'oculta';
      },
    });
  }

  destroy() {
    this.#cancelarCuenta();
    gsap.killTweensOf([this.el, this.ticks, this.onda, this.latidoEl]);
    this.el.remove();
  }

  #cancelarCuenta() {
    this.#countdown?.kill();
    this.#countdown = null;
  }
}
