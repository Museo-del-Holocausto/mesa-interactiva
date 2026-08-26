import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Escala: siete frases sobre Israel y los judios, de la critica politica clara
 * a la amenaza.
 *
 * No hay nada que elegir ni respuesta correcta. Es un recorrido: el marcador
 * se gira y el cursor avanza sobre la escala, mostrando una frase por parada.
 *
 * El documento pide expresamente que la escala no de a entender que todo
 * encaja perfectamente, asi que las paradas no llevan numero ni puntaje y la
 * franja del medio esta dibujada como una zona gris y no como una linea.
 */
export class Escala {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = 0;

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    this.#ir(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  applyRotation(rotation) {
    const n = this.#data.frases.length;
    this.#rotary.feed(rotation, 30, (direction) => {
      this.#ir(Math.min(n - 1, Math.max(0, this.#index + direction)));
    });
  }

  #build() {
    const t = this.#data.ui;
    const n = this.#data.frases.length;
    const root = document.createElement('div');
    root.className = 'esc';
    root.innerHTML = `
      <div class="esc__top">
        <p class="esc__aviso">${this.#data.aviso}</p>
      </div>

      <div class="esc__escala">
        <div class="esc__extremos">
          <span>${t.left}</span>
          <span>${t.right}</span>
        </div>
        <div class="esc__pista">
          <ol class="esc__paradas">
            ${this.#data.frases
              .map(
                (f, i) =>
                  `<li data-index="${i}" data-zona="${f.zona}" style="left:${(i / (n - 1)) * 100}%"></li>`,
              )
              .join('')}
          </ol>
          <i class="esc__cursor" data-slot="cursor"></i>
        </div>
      </div>

      <article class="esc__card">
        <p class="esc__cat" data-slot="cat"></p>
        <p class="esc__frase" data-slot="frase"></p>
      </article>

      <div class="esc__criterios">
        <p class="esc__k">${this.#data.criterios.label}</p>
        <ul>${this.#data.criterios.items.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>

      <p class="esc__hint">${t.hint}</p>`;

    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const parada = target.closest('.esc__paradas li');
      if (!parada?.dataset.index) return;
      event.stopPropagation();
      this.#ir(Number.parseInt(parada.dataset.index, 10));
    });

    return root;
  }

  /** @param {number} index @param {boolean} [immediate] */
  #ir(index, immediate = false) {
    if (index === this.#index && !immediate) return;
    this.#index = index;
    const f = this.#data.frases[index];
    const n = this.#data.frases.length;

    this.el.querySelector('[data-slot="cat"]').textContent = f.cat;
    this.el.querySelector('[data-slot="frase"]').textContent = f.texto;
    this.el.querySelector('[data-slot="cursor"]').style.left = `${(index / (n - 1)) * 100}%`;
    this.el.dataset.zona = f.zona;

    for (const li of this.el.querySelectorAll('.esc__paradas li')) {
      li.dataset.on = String(Number(li.dataset.index) === index);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.esc__card'),
        { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
