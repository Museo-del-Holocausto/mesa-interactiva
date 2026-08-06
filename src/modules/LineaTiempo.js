import gsap from 'gsap';

/**
 * Dos mil anos.
 *
 * Los nueve mitos en orden de fecha sobre una linea arrastrable. Las bandas de
 * color muestran el registro del prejuicio —religioso, economico, racial,
 * conspirativo— y que va mutando sin irse nunca.
 *
 * El eje esta comprimido con una potencia para que los primeros siglos no
 * aplasten a los ultimos: sin eso, siete de los nueve mitos caen en el 5% final.
 */
export class LineaTiempo {
  #data;
  #index = 0;
  #dragging = false;

  /** @param {any} data bloque `linea` del contenido */
  constructor(data) {
    this.#data = data;
    this.el = this.#build();
    this.#select(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** Posicion 0..100 de un año sobre la linea. */
  #pos(year) {
    return ((year - 0) / 2050) ** 0.62 * 100;
  }

  #build() {
    const { myths, categories, hint } = this.#data;
    const root = document.createElement('div');
    root.className = 'linea';
    root.innerHTML = `
      <div class="linea__top">
        <p class="linea__era" data-slot="era"></p>
        <h1 class="linea__frase" data-slot="frase"></h1>
        <p class="linea__glosa" data-slot="glosa"></p>
      </div>
      <div class="linea__track">
        <div class="linea__bands"></div>
        <div class="linea__axis"></div>
        <div class="linea__pts"></div>
      </div>
      <div class="linea__foot">
        <div class="linea__legend">
          ${Object.entries(categories)
            .map(([k, label]) => `<span><i data-cat="${k}"></i>${label}</span>`)
            .join('')}
        </div>
        <p class="linea__hint">${hint}</p>
      </div>`;

    // Bandas: cada mito pinta hasta la mitad del camino al siguiente.
    const bands = root.querySelector('.linea__bands');
    myths.forEach((m, i) => {
      const a = i === 0 ? 0 : (this.#pos(myths[i - 1].y) + this.#pos(m.y)) / 2;
      const b = i === myths.length - 1 ? 100 : (this.#pos(m.y) + this.#pos(myths[i + 1].y)) / 2;
      const band = document.createElement('div');
      band.className = 'linea__band';
      band.dataset.cat = m.cat;
      band.style.left = `${a}%`;
      band.style.width = `${b - a}%`;
      bands.append(band);
    });

    const pts = root.querySelector('.linea__pts');
    myths.forEach((m, i) => {
      const pt = document.createElement('button');
      pt.className = 'linea__pt';
      pt.type = 'button';
      pt.dataset.index = String(i);
      pt.dataset.cat = m.cat;
      pt.style.left = `${this.#pos(m.y)}%`;
      pt.setAttribute('aria-label', m.frase);
      pts.append(pt);

      const label = document.createElement('span');
      label.className = 'linea__yr';
      label.dataset.index = String(i);
      label.style.left = `${this.#pos(m.y)}%`;
      label.textContent = m.era.split(',')[0];
      pts.append(label);
    });

    this.track = root.querySelector('.linea__track');
    this.track.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.#dragging = true;
      this.track.setPointerCapture(event.pointerId);
      this.#select(this.#nearest(event.clientX));
    });
    this.track.addEventListener('pointermove', (event) => {
      if (this.#dragging) this.#select(this.#nearest(event.clientX));
    });
    const end = (event) => {
      this.#dragging = false;
      if (this.track.hasPointerCapture(event.pointerId)) {
        this.track.releasePointerCapture(event.pointerId);
      }
    };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);

    return root;
  }

  /** @param {number} clientX */
  #nearest(clientX) {
    const rect = this.track.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    let best = 0;
    let dist = Infinity;
    this.#data.myths.forEach((m, i) => {
      const d = Math.abs(this.#pos(m.y) - p);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index && !immediate) return;
    this.#index = index;
    const m = this.#data.myths[index];

    const set = (slot, value) => {
      const el = this.el.querySelector(`[data-slot="${slot}"]`);
      if (el) el.textContent = value;
    };
    set('era', `${m.era} · ${this.#data.categories[m.cat]}`);
    set('frase', `“${m.frase}”`);
    set('glosa', m.glosa);

    this.el.querySelector('[data-slot="era"]').dataset.cat = m.cat;
    this.el.querySelector('[data-slot="glosa"]').dataset.vacio = String(m.vacio);

    for (const node of this.el.querySelectorAll('.linea__pt, .linea__yr')) {
      node.dataset.on = String(Number(node.dataset.index) === index);
    }

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.linea__top'),
        { opacity: 0.35 },
        { opacity: 1, duration: 0.28, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
