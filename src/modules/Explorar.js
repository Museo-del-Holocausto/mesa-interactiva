import gsap from 'gsap';
import { MOTION } from '@/config/motion.js';
import { fotoDe } from '@/config/fotos.js';

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
 * Aca el giro no hace nada: la navegacion es vertical y mezclar los dos
 * metodos confundia (girar cambiaba de persona y la posicion la devolvia).
 * El toque sobre los puntos del riel sigue andando.
 */
export class Explorar {
  #data;
  #onExit;
  #index = -1;
  /** Cual de las dos capas de foto esta arriba. Se alternan en cada cambio. */
  #capa = 0;
  /** @type {(HTMLImageElement|null)[]} */
  #fotos = [];

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    // Las fotos se piden todas al entrar: al deslizar no puede haber un hueco
    // mientras la siguiente baja del disco.
    this.#fotos = this.#data.people.map((p) => {
      if (!p.imagen) return null;
      const img = new Image();
      img.decoding = 'async';
      img.src = fotoDe(p.imagen);
      return img;
    });
    this.#select(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** Sentido del ultimo cambio: 1 hacia abajo en el riel, -1 hacia arriba. */
  #dir = 1;

  /** Deslizar: la posicion vertical del marcador elige la parada. */
  applyPosition(_x, y, _w, h) {
    const top = h * RAIL_TOP;
    const span = h * (RAIL_BOTTOM - RAIL_TOP);
    const n = this.#data.people.length;
    const t = Math.min(1, Math.max(0, (y - top) / span));
    this.#select(Math.round(t * (n - 1)));
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
      </div>

      <div class="exp__nav">
        <p class="exp__hint">${this.#data.hint}</p>
      </div>

      <article class="exp__card">
        <figure class="exp__figure">
          <div class="exp__photo" data-foto="false">
            <span class="exp__pending">${t.imagePending}</span>
            <img class="exp__img" alt="" data-capa="0">
            <img class="exp__img" alt="" data-capa="1">
            <i class="exp__scan"></i>
          </div>
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
    this.#dir = index > this.#index ? 1 : -1;
    this.#index = index;
    // Apenas el visitante recorre, la instrucción ya cumplió y se apaga.
    if (!immediate) this.el.dataset.guiado = 'true';
    const person = this.#data.people[index];
    const t = this.#data.ui;

    const set = (slot, value) => {
      const el = this.el.querySelector(`[data-slot="${slot}"]`);
      if (!el) return;
      el.textContent = value ?? '';
      el.hidden = !value;
    };
    set('disciplina', person.disciplina);
    set('nombre', person.nombre);
    set('anios', person.anios);
    set('bio', person.bio);
    set('dato', person.dato);
    const caja = this.el.querySelector('[data-slot="datoCaja"]');
    if (caja) caja.hidden = !person.dato;
    set('epigrafe', person.epigrafe);
    set('credito', person.credito ?? t.creditPending);

    this.#foto(person, immediate);

    for (const tick of this.el.querySelectorAll('.exp__ticks li')) {
      tick.dataset.on = String(Number(tick.dataset.index) === index);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.exp__card'),
        { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: MOTION.dur.paso, ease: MOTION.ease.sale, overwrite: true },
      );
    }
  }

  /**
   * La foto nueva entra por arriba de la anterior: se descubre de arriba hacia
   * abajo con una linea de barrido en el borde, y se asienta con un leve
   * acercamiento. Dos capas que se alternan, asi nunca queda un hueco negro.
   * @param {any} person @param {boolean} immediate
   */
  #foto(person, immediate) {
    const marco = this.el.querySelector('.exp__photo');
    const capas = [...marco.querySelectorAll('.exp__img')];
    const scan = marco.querySelector('.exp__scan');
    gsap.killTweensOf([...capas, scan]);

    if (!person.imagen) {
      marco.dataset.foto = 'false';
      for (const c of capas) c.removeAttribute('src');
      return;
    }
    marco.dataset.foto = 'true';
    marco.querySelector('.exp__pending').hidden = true;

    const abajo = capas[this.#capa];
    this.#capa = 1 - this.#capa;
    const arriba = capas[this.#capa];
    arriba.src = fotoDe(person.imagen);
    arriba.alt = person.nombre ?? '';
    abajo.style.zIndex = '1';
    arriba.style.zIndex = '2';

    if (immediate || !abajo.getAttribute('src')) {
      gsap.set(arriba, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, opacity: 1 });
      gsap.set(abajo, { opacity: 0 });
      return;
    }

    // La mascara acompaña el sentido del riel: bajando se descubre de arriba
    // hacia abajo; subiendo, de abajo hacia arriba.
    const bajando = this.#dir > 0;
    gsap.set(abajo, { opacity: 1 });
    gsap.fromTo(
      arriba,
      { clipPath: bajando ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)', scale: 1.06, opacity: 1 },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: MOTION.dur.entrada, ease: MOTION.ease.firme },
    );
    gsap.to(arriba, { scale: 1, duration: MOTION.dur.largo * 1.6, ease: MOTION.ease.sale });
    gsap.fromTo(
      scan,
      { top: bajando ? '0%' : '100%', opacity: 1 },
      {
        top: bajando ? '100%' : '0%',
        duration: MOTION.dur.entrada,
        ease: MOTION.ease.firme,
        onComplete: () => gsap.to(scan, { opacity: 0, duration: MOTION.dur.paso }),
      },
    );
  }
}
