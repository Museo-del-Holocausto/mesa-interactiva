import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Detras de cada cifra.
 *
 * Mosaico de retratos: se toca uno y aparece quien era. Nunca se abre con una
 * cifra total. Los campos son los que pide el contenido —edad, donde vivia,
 * familia, a que se dedicaba, algo que disfrutaba, un recuerdo— y los que
 * todavia no estan se muestran como faltantes en vez de omitirse: el hueco es
 * parte de lo que hay que ir a buscar a las familias.
 */
export class Vidas {
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
    this.#showScene('intro');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'mosaico') return;
    const n = this.#data.personas.length;
    this.#rotary.feed(rotation, 360 / n, (direction) => {
      this.#select((this.#index + direction + n) % n);
    });
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'vid';

    root.innerHTML = `
      <section class="vid__scene" data-scene="intro">
        <div>
          <p class="vid__center">${this.#data.centro}</p>
          <p class="vid__centersub">${this.#data.centroSub}</p>
          <p class="vid__lead">${this.#data.lead}</p>
        </div>
        <div><button class="vid__btn vid__btn--go" data-act="start">${t.start}</button></div>
      </section>

      <section class="vid__scene" data-scene="mosaico">
        <div class="vid__grid">
          ${this.#data.personas
            .map(
              (p, i) => `<button class="vid__tile" type="button" data-index="${i}">
                <span class="vid__tilephoto"></span>
                <span class="vid__tilename">${p.nombre}</span>
              </button>`,
            )
            .join('')}
          <p class="vid__hint">${t.hint}</p>
        </div>

        <article class="vid__card">
          <p class="vid__estado" data-slot="estado"></p>
          <h1 class="vid__name" data-slot="nombre"></h1>
          <dl class="vid__fields"></dl>
          <p class="vid__rights">${t.rights}</p>
        </article>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      if (!(event.target instanceof Element)) return;
      event.stopPropagation();
      if (event.target.closest('[data-act="start"]')) return this.#start();
      const tile = event.target.closest('.vid__tile');
      if (tile?.dataset.index) this.#select(Number.parseInt(tile.dataset.index, 10));
    });

    return root;
  }

  #start() {
    this.#showScene('mosaico');
    this.#select(0, true);
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.vid__scene')];
    for (const scene of scenes) scene.dataset.on = String(scene.dataset.scene === name);
    this.el.dataset.scene = name;
    gsap.killTweensOf(scenes);
    gsap.set(scenes, { opacity: 0 });
    gsap.to(this.el.querySelector(`[data-scene="${name}"]`), {
      opacity: 1,
      duration: 0.34,
      ease: 'power2.out',
    });
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index) return;
    this.#index = index;
    const persona = this.#data.personas[index];
    if (!persona) return;

    const set = (slot, value) => {
      const el = this.el.querySelector(`[data-slot="${slot}"]`);
      if (!el) return;
      el.textContent = value ?? '';
      el.hidden = !value;
    };
    set('estado', persona.estado);
    set('nombre', persona.nombre);

    const dl = this.el.querySelector('.vid__fields');
    dl.replaceChildren();
    for (const field of this.#data.fields) {
      const value = persona[field.k];
      const falta = !value;
      const row = document.createElement('div');
      row.className = 'vid__field';
      row.dataset.falta = String(falta);
      row.innerHTML = `<dt>${field.label}</dt><dd>${value ?? '—'}</dd>`;
      dl.append(row);
    }

    for (const tile of this.el.querySelectorAll('.vid__tile')) {
      tile.dataset.on = String(Number(tile.dataset.index) === index);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.vid__card'),
        { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
