import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Columnas de la grilla. 20 x 16 = 320 figuras, el alcance de la ultima etapa. */
const COLS = 20;

/**
 * Alcance: cuanta gente vio la publicacion en cada etapa de la escalada.
 *
 * No hay nada que elegir. Se gira y la multitud se enciende: una figura el
 * primer dia, trescientas veinte el noveno. El dato no se lee, se ve.
 *
 * Preguntarle al visitante en que etapa habria intervenido convertia esto en
 * un examen y tapaba lo unico que importa, que es la progresion. La conclusion
 * la saca solo cuando mira las dos puntas.
 *
 * Cada figura son diez personas y la pieza lo dice. Las cifras son de un caso
 * de ejemplo, tambien dicho: un museo no puede mostrar como dato lo que es una
 * ilustracion.
 */
export class Alcance {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = -1;
  #figuras = [];
  #mostrado = 0;

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

  /** Girar avanza de etapa. Para atras tambien: la progresion se puede revisar. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'etapa') return;
    const n = this.#data.etapas.length;
    this.#rotary.feed(rotation, 40, (direction) => {
      const next = this.#index + direction;
      if (next < 0) return;
      if (next >= n) this.#finish();
      else this.#ir(next);
    });
  }

  get #etapa() {
    return this.#data.etapas[this.#index];
  }

  /** @param {number} n */
  #num(n) {
    return n.toLocaleString('es-AR');
  }

  get #totalFiguras() {
    const max = Math.max(...this.#data.etapas.map((e) => e.alcance));
    return Math.round(max / this.#data.porFigura);
  }

  #build() {
    const t = this.#data.ui;
    const total = this.#totalFiguras;
    const root = document.createElement('div');
    root.className = 'alc';
    root.dataset.scene = 'intro';
    root.innerHTML = `
      <section class="alc__scene" data-scene="intro">
        <div>
          <h1 class="alc__h1">${this.#data.title}</h1>
          <p class="alc__lead">${this.#data.lead}</p>
          <p class="alc__aviso">${this.#data.aviso}</p>
        </div>
        <div class="alc__acts">
          <button class="alc__btn alc__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="alc__scene" data-scene="etapa">
        <div class="alc__col">
          <ol class="alc__pasos">
            ${this.#data.etapas
              .map((e, i) => `<li data-index="${i}"><span>${e.dia}</span></li>`)
              .join('')}
          </ol>
          <p class="alc__dia" data-slot="dia"></p>
          <h2 class="alc__tit" data-slot="titulo"></h2>
          <p class="alc__que" data-slot="que"></p>
          <p class="alc__ruta"><span class="alc__k">${t.route}</span><span data-slot="ruta"></span></p>
          <div class="alc__accion">
            <p class="alc__k">${t.act}</p>
            <p class="alc__acc" data-slot="accion"></p>
            <p class="alc__evita" data-slot="evita"></p>
          </div>
        </div>

        <div class="alc__gente">
          <p class="alc__cuenta">
            <span class="alc__cifra" data-slot="cifra">0</span>
            <span class="alc__unidad">${t.reach}</span>
          </p>
          ${this.#grilla(total)}
          <p class="alc__escala">${t.scale}</p>
        </div>

        <div class="alc__foot">
          <p class="alc__hint">${t.hint}</p>
          <button class="alc__btn alc__btn--go" data-act="next"></button>
        </div>
      </section>

      <section class="alc__scene" data-scene="fin">
        <div>
          <p class="alc__k">${this.#data.closing.label}</p>
          <p class="alc__close">${this.#data.closing.text}</p>
          <p class="alc__close2">${this.#data.closing.sub}</p>
        </div>
        <div class="alc__acts">
          <button class="alc__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const paso = target.closest('.alc__pasos li');
      if (paso?.dataset.index) return this.#ir(Number.parseInt(paso.dataset.index, 10));

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#ir(0, true);
      else if (act === 'next') this.#siguiente();
      else if (act === 'again') this.#ir(0, true);
    });

    this.#figuras = [...root.querySelectorAll('.alc__fig')];
    return root;
  }

  /**
   * Una sola definicion de la figura y N referencias: dibujar 320 siluetas
   * completas hace que la mesa se arrastre al animarlas.
   * @param {number} total
   */
  #grilla(total) {
    const w = 13;
    const h = 21;
    const gapX = 6;
    const gapY = 7;
    const rows = Math.ceil(total / COLS);
    const usos = [];
    for (let i = 0; i < total; i += 1) {
      const x = (i % COLS) * (w + gapX);
      const y = Math.floor(i / COLS) * (h + gapY);
      // Sin width/height, cada referencia se estira al tamano del lienzo
      // entero y las 320 figuras quedan una encima de otra.
      usos.push(
        `<use class="alc__fig" href="#alc-fig" x="${x}" y="${y}" width="${w}" height="${h}" data-i="${i}"/>`,
      );
    }
    const vbW = COLS * (w + gapX) - gapX;
    const vbH = rows * (h + gapY) - gapY;
    return `
      <svg class="alc__grid" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-hidden="true">
        <defs>
          <symbol id="alc-fig" viewBox="0 0 13 21">
            <circle cx="6.5" cy="3.2" r="2.9"/>
            <rect x="2.7" y="6.8" width="7.6" height="7.8" rx="3.3"/>
            <rect x="3.8" y="13" width="2.1" height="7.6" rx="1.05"/>
            <rect x="7.1" y="13" width="2.1" height="7.6" rx="1.05"/>
          </symbol>
        </defs>
        ${usos.join('')}
      </svg>`;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.alc__scene')];
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

  /** @param {number} index @param {boolean} [reset] */
  #ir(index, reset = false) {
    if (reset) {
      this.#mostrado = 0;
      for (const f of this.#figuras) f.dataset.on = 'false';
    }
    this.#index = index;
    const e = this.#etapa;
    const t = this.#data.ui;

    this.#set('dia', e.dia);
    this.#set('titulo', e.titulo);
    this.#set('que', e.que);
    // Por que crece el numero: la ruta que hace el posteo en cada salto.
    this.#set('ruta', e.ruta);
    this.#set('accion', e.accion);
    this.#set('evita', e.evita);

    for (const li of this.el.querySelectorAll('.alc__pasos li')) {
      const i = Number(li.dataset.index);
      li.dataset.on = String(i === index);
      li.dataset.done = String(i < index);
    }

    const btn = this.el.querySelector('[data-act="next"]');
    btn.textContent = index === this.#data.etapas.length - 1 ? t.last : t.next;

    this.#pintarGente(Math.round(e.alcance / this.#data.porFigura));
    this.#contarHasta(e.alcance);
    this.#showScene('etapa');
  }

  /**
   * Las figuras nuevas se encienden de a una, en cascada. Todas juntas es un
   * cambio de color; de a una, es una multitud que crece.
   * @param {number} hasta
   */
  #pintarGente(hasta) {
    const desde = this.#mostrado;
    this.#mostrado = hasta;

    if (hasta < desde) {
      for (let i = hasta; i < desde; i += 1) this.#figuras[i].dataset.on = 'false';
      return;
    }
    const nuevas = hasta - desde;
    // Con 210 figuras nuevas, una cascada de a una tardaria demasiado: el paso
    // se acorta a medida que hay mas.
    const paso = Math.min(0.03, 1.6 / Math.max(nuevas, 1));
    for (let i = desde; i < hasta; i += 1) {
      const fig = this.#figuras[i];
      gsap.delayedCall((i - desde) * paso, () => {
        fig.dataset.on = 'true';
      });
    }
  }

  /** @param {number} valor */
  #contarHasta(valor) {
    const el = this.el.querySelector('[data-slot="cifra"]');
    const obj = { v: Number.parseInt(el.textContent.replace(/\D/g, ''), 10) || 0 };
    gsap.to(obj, {
      v: valor,
      duration: 1.1,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = this.#num(Math.round(obj.v));
      },
    });
  }

  #siguiente() {
    if (this.#index < this.#data.etapas.length - 1) this.#ir(this.#index + 1);
    else this.#finish();
  }

  #finish() {
    for (const li of this.el.querySelectorAll('.alc__pasos li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
