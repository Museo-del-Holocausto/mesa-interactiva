import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Tramo vertical del cuadrante donde vive el riel, en fracciones del alto. */
const RAIL_TOP = 0.16;
const RAIL_BOTTOM = 0.84;

/**
 * Explorar: recorrido sin orden obligatorio.
 *
 * El cuarto modo del pliego, y el primero donde el marcador se usa como
 * posicion y no como giro: el objeto se desliza por un riel vertical en su
 * propia columna y arrastra la seleccion. El marcador es el cursor.
 *
 * Se eligio el eje vertical porque el horizontal ya esta ocupado: la posicion
 * en X decide de que lado va el contenido, y moverlo a lo ancho reacomodaria
 * la pantalla. A lo alto quedan ~720 px libres, de sobra para ocho paradas.
 *
 * El giro hace lo mismo y el toque tambien: deslizar es una mejora, no un
 * requisito, igual que la rosca en el resto de las piezas.
 */
export class Explorar {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = -1;

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    this.#select(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** Deslizar: la posicion vertical del marcador elige la parada. */
  applyPosition(_x, y, _w, h) {
    const top = h * RAIL_TOP;
    const span = h * (RAIL_BOTTOM - RAIL_TOP);
    const n = this.#data.people.length;
    const t = Math.min(1, Math.max(0, (y - top) / span));
    this.#select(Math.round(t * (n - 1)));
  }

  /** Girar hace lo mismo, para quien no descubra el deslizamiento. */
  applyRotation(rotation) {
    const n = this.#data.people.length;
    this.#rotary.feed(rotation, 360 / n, (direction) => {
      this.#select((this.#index + direction + n) % n);
    });
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'exp';
    root.innerHTML = `
      <div class="exp__rail">
        <div class="exp__line"></div>
        <ol class="exp__ticks">
          ${this.#data.people.map((_, i) => `<li data-index="${i}"></li>`).join('')}
        </ol>
        <p class="exp__pos"><span data-slot="n"></span> ${t.of} ${this.#data.people.length}</p>
        <p class="exp__hint">${this.#data.hint}</p>
      </div>

      <article class="exp__card">
        <figure class="exp__figure">
          <div class="exp__photo"><span>${t.imagePending}</span></div>
          <figcaption class="exp__caption">
            <span data-slot="epigrafe"></span>
            <span class="exp__credit" data-slot="credito"></span>
          </figcaption>
        </figure>
        <div class="exp__text">
          <p class="exp__disc" data-slot="disciplina"></p>
          <h1 class="exp__name" data-slot="nombre"></h1>
          <p class="exp__years" data-slot="anios"></p>
          <p class="exp__bio" data-slot="bio"></p>
          <div class="exp__dato" data-slot="datoCaja">
            <p class="exp__datok">${t.dato}</p>
            <p class="exp__datotx" data-slot="dato"></p>
          </div>
        </div>
      </article>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      const tick = event.target.closest('.exp__ticks li');
      if (!tick?.dataset.index) return;
      event.stopPropagation();
      this.#select(Number.parseInt(tick.dataset.index, 10));
    });

    // Las paradas se reparten a lo largo del riel, en el mismo tramo que lee
    // applyPosition: el tick de cada persona queda donde hay que apoyar.
    const n = this.#data.people.length;
    [...root.querySelectorAll('.exp__ticks li')].forEach((li, i) => {
      li.style.top = `${(RAIL_TOP + (i / (n - 1)) * (RAIL_BOTTOM - RAIL_TOP)) * 100}%`;
    });

    return root;
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index) return;
    this.#index = index;
    const person = this.#data.people[index];
    const t = this.#data.ui;

    const set = (slot, value) => {
      const el = this.el.querySelector(`[data-slot="${slot}"]`);
      if (!el) return;
      el.textContent = value ?? '';
      el.hidden = !value;
    };
    set('n', String(index + 1));
    set('disciplina', person.disciplina);
    set('nombre', person.nombre);
    set('anios', person.anios);
    set('bio', person.bio);
    set('dato', person.dato);
    const caja = this.el.querySelector('[data-slot="datoCaja"]');
    if (caja) caja.hidden = !person.dato;
    set('epigrafe', person.epigrafe);
    set('credito', person.credito ?? t.creditPending);

    for (const tick of this.el.querySelectorAll('.exp__ticks li')) {
      tick.dataset.on = String(Number(tick.dataset.index) === index);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.exp__card'),
        { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
