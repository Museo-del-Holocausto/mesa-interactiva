import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Columnas de la grilla. 60 x 24 = 1.440, alcanza para las 1.414 personas. */
const COLS = 60;

/**
 * Cifras: las 1.414 personas del 7 de octubre, una figura cada una.
 *
 * Una figura es una persona y no diez. Con este total se puede, y es la unica
 * manera de que el numero deje de ser un numero: 1.163 no se dimensiona, 1.163
 * siluetas si.
 *
 * Sin cascada y sin contador que sube. Un numero que trepa y una ola que
 * avanza son recursos de espectaculo, y aca se esta contando gente asesinada.
 * Las figuras aparecen con un desvanecido corto y en orden aleatorio: no como
 * una barra que progresa, sino como una poblacion que estaba ahi.
 *
 * Los tres ultimos estados son subconjuntos: las 251 secuestradas ocupan
 * siempre el mismo bloque de la grilla, y adentro de ese bloque se separan las
 * que volvieron de las que no. La escala nunca cambia, asi que la proporcion
 * se lee sola.
 */
export class Cifras {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = -1;
  #figuras = [];

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

  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'estado') return;
    const n = this.#data.estados.length;
    this.#rotary.feed(rotation, 40, (direction) => {
      const next = this.#index + direction;
      if (next < 0) return;
      if (next >= n) this.#showScene('fin');
      else this.#ir(next);
    });
  }

  get #estado() {
    return this.#data.estados[this.#index];
  }

  /** @param {number} n */
  #num(n) {
    return n.toLocaleString('es-AR');
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'cif';
    root.dataset.scene = 'intro';
    root.innerHTML = `
      <section class="cif__scene" data-scene="intro">
        <div>
          <h1 class="cif__h1">${this.#data.title}</h1>
          <p class="cif__lead">${this.#data.lead}</p>
        </div>
        <div class="cif__acts">
          <button class="cif__btn cif__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="cif__scene" data-scene="estado">
        <div class="cif__col">
          <ol class="cif__pasos">
            ${this.#data.estados
              .map((e, i) => `<li data-index="${i}"><span>${e.titulo}</span></li>`)
              .join('')}
          </ol>
          <p class="cif__rot" data-slot="rot"></p>
          <p class="cif__cuenta">
            <span class="cif__cifra" data-slot="cifra"></span>
            <span class="cif__unidad">${t.unit}</span>
          </p>
          <h2 class="cif__tit" data-slot="titulo"></h2>
          <p class="cif__nota" data-slot="nota"></p>
        </div>

        <div class="cif__gente">
          ${this.#grilla(this.#data.total)}
          <p class="cif__escala">${t.scale}</p>
        </div>

        <div class="cif__foot">
          <p class="cif__hint">${t.hint}</p>
          <button class="cif__btn cif__btn--go" data-act="next"></button>
        </div>
      </section>

      <section class="cif__scene" data-scene="fin">
        <div>
          <p class="cif__k">${this.#data.closing.label}</p>
          <p class="cif__close">${this.#data.closing.text}</p>
          <p class="cif__close2">${this.#data.closing.sub}</p>
        </div>
        <div class="cif__acts">
          <button class="cif__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const paso = target.closest('.cif__pasos li');
      if (paso?.dataset.index) return this.#ir(Number.parseInt(paso.dataset.index, 10));

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#ir(0);
      else if (act === 'next') this.#siguiente();
      else if (act === 'again') this.#ir(0);
    });

    this.#figuras = [...root.querySelectorAll('.cif__fig')];
    return root;
  }

  /** @param {number} total */
  #grilla(total) {
    const w = 8;
    const h = 13;
    const gapX = 4;
    const gapY = 5;
    const rows = Math.ceil(total / COLS);
    const usos = [];
    for (let i = 0; i < total; i += 1) {
      const x = (i % COLS) * (w + gapX);
      const y = Math.floor(i / COLS) * (h + gapY);
      usos.push(
        `<use class="cif__fig" href="#cif-fig" x="${x}" y="${y}" width="${w}" height="${h}"/>`,
      );
    }
    return `
      <svg class="cif__grid" viewBox="0 0 ${COLS * (w + gapX) - gapX} ${rows * (h + gapY) - gapY}" aria-hidden="true">
        <defs>
          <symbol id="cif-fig" viewBox="0 0 8 13">
            <circle cx="4" cy="2" r="1.8"/>
            <rect x="1.6" y="4.2" width="4.8" height="4.9" rx="2.1"/>
            <rect x="2.3" y="8.1" width="1.4" height="4.7" rx="0.7"/>
            <rect x="4.3" y="8.1" width="1.4" height="4.7" rx="0.7"/>
          </symbol>
        </defs>
        ${usos.join('')}
      </svg>`;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.cif__scene')];
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

  /** @param {number} index */
  #ir(index) {
    this.#index = index;
    const e = this.#estado;
    const t = this.#data.ui;

    this.#set('rot', e.rot);
    // El numero se pone, no trepa. Un contador subiendo convierte muertos en
    // marcador.
    this.#set('cifra', this.#num(e.cifra));
    this.#set('titulo', e.titulo);
    this.#set('nota', e.nota);
    this.el.dataset.color = e.color;

    for (const li of this.el.querySelectorAll('.cif__pasos li')) {
      const i = Number(li.dataset.index);
      li.dataset.on = String(i === index);
      li.dataset.done = String(i < index);
    }

    const btn = this.el.querySelector('[data-act="next"]');
    btn.textContent = index === this.#data.estados.length - 1 ? t.last : t.next;

    this.#pintar(e);
    this.#showScene('estado');
  }

  /** @param {any} e */
  #pintar(e) {
    const desde = e.desde;
    const hasta = desde + e.cifra;
    const nuevas = [];

    this.#figuras.forEach((f, i) => {
      const on = i >= desde && i < hasta;
      if (on && f.dataset.on !== 'true') nuevas.push(f);
      f.dataset.on = String(on);
    });

    // Orden aleatorio y no de izquierda a derecha: una ola que avanza se lee
    // como una barra de progreso. Disperso se lee como gente que estaba ahi.
    gsap.killTweensOf(nuevas);
    for (const f of nuevas) {
      gsap.fromTo(
        f,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, delay: Math.random() * 0.7, ease: 'none' },
      );
    }
  }

  #siguiente() {
    if (this.#index < this.#data.estados.length - 1) this.#ir(this.#index + 1);
    else this.#showScene('fin');
  }
}
