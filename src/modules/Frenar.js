import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Tramo del alto donde vive el riel, en fracciones. */
const RAIL_TOP = 0.2;
const RAIL_BOTTOM = 0.8;

/**
 * Frenar: cinco etapas de una escalada en redes, y una sola pregunta.
 *
 * El visitante elige en cual habria intervenido. Casi todos eligen las
 * ultimas, porque son las que se ven graves. Recien despues aparece cuanta
 * gente vio el contenido en cada etapa: treinta y dos personas al principio,
 * ciento cuarenta mil al final.
 *
 * El dato tiene dos lecturas al mismo tiempo, y esa es la pieza: cuanto mas
 * obvio se vuelve el daño, menos se puede hacer. Nadie se equivoca —intervenir
 * tarde es mejor que no intervenir—, pero el numero muestra lo que costo
 * esperar.
 *
 * Las cifras son de un caso de ejemplo y la pieza lo dice. Un museo no puede
 * presentar como dato lo que es una ilustracion.
 */
export class Frenar {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = 0;
  #elegida = null;

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    this.#showScene('intro');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** Deslizar recorre las etapas mientras no se haya confirmado. */
  applyPosition(_x, y, _w, h) {
    if (this.el.dataset.scene !== 'elegir') return;
    const top = h * RAIL_TOP;
    const span = h * (RAIL_BOTTOM - RAIL_TOP);
    const n = this.#data.etapas.length;
    const t = Math.min(1, Math.max(0, (y - top) / span));
    this.#mirar(Math.round(t * (n - 1)));
  }

  /** Girar hace lo mismo, para quien no descubra el deslizamiento. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'elegir') return;
    const n = this.#data.etapas.length;
    this.#rotary.feed(rotation, 40, (direction) => {
      this.#mirar(Math.min(n - 1, Math.max(0, this.#index + direction)));
    });
  }

  get #etapa() {
    return this.#data.etapas[this.#index];
  }

  /** @param {number} n */
  #num(n) {
    return n.toLocaleString('es-AR');
  }

  #build() {
    const t = this.#data.ui;
    const n = this.#data.etapas.length;
    const root = document.createElement('div');
    root.className = 'fre';
    root.dataset.scene = 'intro';
    root.innerHTML = `
      <section class="fre__scene" data-scene="intro">
        <div>
          <h1 class="fre__h1">${this.#data.title}</h1>
          <p class="fre__lead">${this.#data.lead}</p>
          <p class="fre__aviso">${this.#data.aviso}</p>
        </div>
        <div class="fre__acts">
          <button class="fre__btn fre__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="fre__scene" data-scene="elegir">
        <div class="fre__rail">
          <div class="fre__line"></div>
          <ol class="fre__ticks">
            ${this.#data.etapas.map((e, i) => `<li data-index="${i}"><span></span></li>`).join('')}
          </ol>
          <p class="fre__hint">${t.hint}</p>
        </div>

        <div class="fre__col">
          <p class="fre__ask">${t.ask}</p>
          <div class="fre__etapa">
            <p class="fre__dia" data-slot="dia"></p>
            <h2 class="fre__tit" data-slot="titulo"></h2>
            <p class="fre__que" data-slot="que"></p>
          </div>
          <div class="fre__foot">
            <button class="fre__btn fre__btn--go" data-act="confirm">${t.confirm}</button>
          </div>
        </div>
      </section>

      <section class="fre__scene" data-scene="fin">
        <div class="fre__ver">
          <p class="fre__k" data-slot="v-label"></p>
          <p class="fre__vtext" data-slot="v-text"></p>
          <p class="fre__vsub" data-slot="v-sub"></p>
        </div>
        <ol class="fre__grafico" data-slot="grafico"></ol>
        <div class="fre__cierre">
          <p class="fre__k">${this.#data.closing.label}</p>
          <p class="fre__ctext">${this.#data.closing.text}</p>
          <p class="fre__csub">${this.#data.closing.sub}</p>
          <button class="fre__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const tick = target.closest('.fre__ticks li');
      if (tick?.dataset.index) return this.#mirar(Number.parseInt(tick.dataset.index, 10));

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#empezar();
      else if (act === 'confirm') this.#confirmar();
      else if (act === 'again') this.#empezar();
    });

    [...root.querySelectorAll('.fre__ticks li')].forEach((li, i) => {
      li.style.top = `${(RAIL_TOP + (i / (n - 1)) * (RAIL_BOTTOM - RAIL_TOP)) * 100}%`;
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.fre__scene')];
    for (const scene of scenes) scene.dataset.on = String(scene.dataset.scene === name);
    gsap.killTweensOf(scenes);
    gsap.set(scenes, { opacity: 0 });
    gsap.to(this.el.querySelector(`[data-scene="${name}"]`), {
      opacity: 1,
      duration: 0.34,
      ease: 'power2.out',
    });
  }

  /** @param {string} slot @param {string} value */
  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = value ?? '';
  }

  #empezar() {
    this.#elegida = null;
    this.#index = -1;
    this.#rotary.reset();
    this.#mirar(0);
    this.#showScene('elegir');
  }

  /** @param {number} index */
  #mirar(index) {
    if (index === this.#index) return;
    this.#index = index;
    const e = this.#etapa;
    this.#set('dia', e.dia);
    this.#set('titulo', e.titulo);
    this.#set('que', e.que);
    for (const tick of this.el.querySelectorAll('.fre__ticks li')) {
      tick.dataset.on = String(Number(tick.dataset.index) === index);
    }
    gsap.fromTo(
      this.el.querySelector('.fre__etapa'),
      { opacity: 0.35, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true },
    );
  }

  /**
   * El grafico se dibuja despues de elegir, nunca antes: si el alcance estuviera
   * a la vista mientras se decide, la respuesta vendria dada.
   */
  #confirmar() {
    this.#elegida = this.#index;
    const t = this.#data.ui;
    const v = this.#index === 0 ? this.#data.veredicto.temprano : this.#data.veredicto.tarde;
    this.#set('v-label', v.label);
    this.#set('v-text', v.text);
    this.#set('v-sub', v.sub);

    const max = Math.max(...this.#data.etapas.map((e) => e.alcance));
    const lista = this.el.querySelector('[data-slot="grafico"]');
    lista.replaceChildren();

    this.#data.etapas.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'fre__barra';
      li.dataset.tuya = String(i === this.#elegida);
      li.dataset.clave = String(i === 0);
      li.innerHTML = `
        <p class="fre__brot"><span class="fre__bn"></span><span class="fre__btit"></span></p>
        <div class="fre__bpista"><i></i><span class="fre__balc"></span></div>
        <p class="fre__bacc"></p>`;
      li.querySelector('.fre__bn').textContent = e.dia;
      li.querySelector('.fre__btit').textContent = e.titulo;
      li.querySelector('.fre__balc').textContent = `${this.#num(e.alcance)} ${t.reach}`;
      li.querySelector('.fre__bacc').textContent = e.evita;
      lista.append(li);
      // Escala por raiz: con 32 contra 140.000, una escala lineal deja las
      // cuatro primeras barras invisibles y no se ve la progresion.
      const w = Math.max(2, Math.sqrt(e.alcance / max) * 100);
      gsap.fromTo(
        li.querySelector('.fre__bpista i'),
        { width: '0%' },
        { width: `${w}%`, duration: 0.9, delay: 0.15 + i * 0.12, ease: 'power2.out' },
      );
    });

    this.#showScene('fin');
  }
}
