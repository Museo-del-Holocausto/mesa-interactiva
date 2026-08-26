import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Tramo del alto donde vive el riel, en fracciones. Igual que en Aportes judios. */
const RAIL_TOP = 0.16;
const RAIL_BOTTOM = 0.84;

/**
 * Linea de tiempo. Se usa en el eje 3 —nueve mitos— y en el eje 4 —cinco
 * tramos de politicas de Estado—. La pieza no sabe de que habla: recibe
 * paradas con tres bloques y las recorre.
 *
 * Dos gestos que no se pisan:
 * - Deslizar el marcador a lo alto recorre el tiempo.
 * - Girarlo abre los bloques del mito seleccionado.
 *
 * El riel va vertical aunque el eje sea temporal. Dos razones: en X la
 * posicion ya decide de que lado se acomoda el contenido, asi que recorrer a
 * lo ancho reacomodaria la pantalla en el camino; y un riel abajo le come al
 * texto la unica zona donde entra, que fue exactamente lo que paso cuando se
 * probo acostado.
 *
 * De cada mito, el equipo de contenido escribio tres bloques —origen, como se
 * construyo el prejuicio e idea clave— y aparecen de a uno. Los tres juntos
 * son un parrafo largo, y un parrafo largo en una mesa no se lee.
 */
export class Mitos {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = -1;
  /** Bloques abiertos en cada mito. Se recuerda al volver. */
  #abiertos = [];

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.#abiertos = data.mitos.map(() => 1);
    this.el = this.#build();
    this.#select(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** Deslizar: la altura del marcador elige el mito. */
  applyPosition(_x, y, _w, h) {
    const top = h * RAIL_TOP;
    const span = h * (RAIL_BOTTOM - RAIL_TOP);
    const n = this.#data.mitos.length;
    const t = Math.min(1, Math.max(0, (y - top) / span));
    this.#select(Math.round(t * (n - 1)));
  }

  /** Girar: abre el bloque siguiente del mito actual, o cierra el ultimo. */
  applyRotation(rotation) {
    this.#rotary.feed(rotation, 45, (direction) => {
      if (direction > 0) this.#revelar();
      else this.#ocultar();
    });
  }

  get #mito() {
    return this.#data.mitos[this.#index];
  }

  /**
   * Bloques que esa parada trae escritos. No todas tienen los tres: en el eje
   * 4 hay tramos con una sola linea, y forzar tres dejaba rotulos con nada
   * debajo.
   * @param {number} [index]
   */
  #bloquesDe(index = this.#index) {
    const m = this.#data.mitos[index];
    return this.#data.bloques.filter((b) => m?.[b.k]);
  }

  #build() {
    const t = this.#data.ui;
    const n = this.#data.mitos.length;
    const root = document.createElement('div');
    root.className = 'mit';
    root.innerHTML = `
      <div class="mit__rail">
        <div class="mit__line"></div>
        <ol class="mit__ticks">
          ${this.#data.mitos
            .map(
              (m, i) =>
                `<li data-index="${i}" data-cat="${m.cat}"><span>${m.eje ?? m.y}</span></li>`,
            )
            .join('')}
        </ol>
        <p class="mit__pos"><span data-slot="n"></span> ${t.of} ${n}</p>
        <p class="mit__hint">${t.hint}</p>
      </div>

      <ul class="mit__leyenda">
        ${Object.entries(this.#data.categorias)
          .map(([k, label]) => `<li data-cat="${k}"><i></i>${label}</li>`)
          .join('')}
      </ul>

      <article class="mit__card">
        <p class="mit__meta">
          <span data-slot="era"></span>
          <span class="mit__cat" data-slot="cat"></span>
        </p>
        <h1 class="mit__frase" data-slot="frase"></h1>
        <div class="mit__bloques" data-slot="bloques"></div>
        <p class="mit__vacio" data-slot="vacio">${t.pending}</p>
        <div class="mit__acciones">
          <button class="mit__btn" data-act="revelar"></button>
          <ol class="mit__pasos">${this.#data.bloques.map(() => '<li></li>').join('')}</ol>
        </div>
      </article>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const tick = target.closest('.mit__ticks li');
      if (tick?.dataset.index) {
        event.stopPropagation();
        this.#select(Number.parseInt(tick.dataset.index, 10));
        return;
      }
      if (target.closest('[data-act="revelar"]')) {
        event.stopPropagation();
        this.#revelar();
      }
    });

    // Las paradas se reparten en el mismo tramo que lee applyPosition: el punto
    // de cada mito queda donde hay que apoyar el marcador.
    [...root.querySelectorAll('.mit__ticks li')].forEach((li, i) => {
      li.style.top = `${(RAIL_TOP + (i / (n - 1)) * (RAIL_BOTTOM - RAIL_TOP)) * 100}%`;
    });

    return root;
  }

  /** @param {string} slot @param {string} value */
  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = value ?? '';
    el.hidden = !value;
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index) return;
    this.#index = index;
    const m = this.#mito;

    this.#set('n', String(index + 1));
    this.#set('era', m.era);
    this.#set('frase', `«${m.frase}»`);

    const cat = this.el.querySelector('[data-slot="cat"]');
    cat.textContent = this.#data.categorias[m.cat];
    cat.dataset.cat = m.cat;

    for (const tick of this.el.querySelectorAll('.mit__ticks li')) {
      const i = Number(tick.dataset.index);
      tick.dataset.on = String(i === index);
      tick.dataset.leido = String(
        this.#abiertos[i] >= this.#bloquesDe(i).length && !this.#data.mitos[i].vacio,
      );
    }

    const caja = this.el.querySelector('[data-slot="bloques"]');
    const vacio = this.el.querySelector('[data-slot="vacio"]');
    const acciones = this.el.querySelector('.mit__acciones');
    caja.replaceChildren();

    // El mito 9 llego sin texto. Se dice, en vez de dejar un hueco que parezca
    // un error de la pieza.
    if (m.vacio) {
      vacio.hidden = false;
      acciones.hidden = true;
    } else {
      vacio.hidden = true;
      acciones.hidden = false;
      for (const b of this.#bloquesDe()) {
        const bloque = document.createElement('div');
        bloque.className = 'mit__bloque';
        bloque.dataset.k = b.k;
        bloque.innerHTML = '<p class="mit__rot"></p><p class="mit__txt"></p>';
        bloque.querySelector('.mit__rot').textContent = b.rot;
        bloque.querySelector('.mit__txt').textContent = m[b.k];
        caja.append(bloque);
      }
      this.#pintarBloques(true);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.mit__card'),
        { opacity: 0.35, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }

  /** @param {boolean} [immediate] */
  #pintarBloques(immediate = false) {
    const t = this.#data.ui;
    const abiertos = this.#abiertos[this.#index];
    const bloques = [...this.el.querySelectorAll('.mit__bloque')];
    bloques.forEach((b, i) => {
      b.dataset.on = String(i < abiertos);
    });
    const total = bloques.length;
    [...this.el.querySelectorAll('.mit__pasos li')].forEach((li, i) => {
      li.hidden = i >= total;
      li.dataset.on = String(i < abiertos);
    });

    const completo = abiertos >= total;
    const btn = this.el.querySelector('[data-act="revelar"]');
    // Con una sola linea escrita no hay nada que revelar: el botón sobra.
    btn.hidden = total <= 1;
    btn.textContent = completo ? t.read : t.reveal;
    btn.disabled = completo;

    if (!immediate && bloques[abiertos - 1]) {
      gsap.fromTo(
        bloques[abiertos - 1],
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      );
    }
  }

  #revelar() {
    if (this.#mito?.vacio) return;
    const total = this.#bloquesDe().length;
    if (this.#abiertos[this.#index] >= total) return;
    this.#abiertos[this.#index] += 1;
    this.#pintarBloques();
    const tick = this.el.querySelector(`.mit__ticks li[data-index="${this.#index}"]`);
    if (tick) tick.dataset.leido = String(this.#abiertos[this.#index] >= total);
  }

  /** Girar para el otro lado cierra el ultimo bloque: el gesto es reversible. */
  #ocultar() {
    if (this.#mito?.vacio) return;
    if (this.#abiertos[this.#index] <= 1) return;
    this.#abiertos[this.#index] -= 1;
    this.#pintarBloques(true);
    const tick = this.el.querySelector(`.mit__ticks li[data-index="${this.#index}"]`);
    if (tick) tick.dataset.leido = 'false';
  }
}
