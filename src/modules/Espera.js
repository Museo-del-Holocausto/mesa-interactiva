import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * La incertidumbre de las familias.
 *
 * Es el unico modulo que resta. En el resto de las piezas avanzar suma: la pila
 * del eje 4 crece, la frase del eje 1 se completa. Aca el tiempo pasa y la
 * pantalla tiene cada vez menos. Los canales para averiguar algo se van
 * apagando uno por uno y las preguntas sin respuesta ocupan el lugar que dejan.
 *
 * Terminas con un canal y ocho preguntas. Eso es la pieza: un panel de pared no
 * puede hacer que la informacion desaparezca mientras lo estas leyendo.
 */
export class Espera {
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

  /** El giro hace pasar el tiempo. Solo hacia adelante y hacia atras. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'espera') return;
    const n = this.#data.periodos.length;
    this.#rotary.feed(rotation, 360 / n, (direction) => {
      const next = this.#index + direction;
      if (next < 0 || next >= n) return;
      this.#go(next);
    });
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'esp';

    root.innerHTML = `
      <section class="esp__scene" data-scene="intro">
        <div>
          <h1 class="esp__h1">${this.#data.title}</h1>
          <p class="esp__lead">${this.#data.lead}</p>
        </div>
        <div><button class="esp__btn esp__btn--go" data-act="start">${t.start}</button></div>
      </section>

      <section class="esp__scene" data-scene="espera">
        <header class="esp__head">
          <p class="esp__sub" data-slot="sub"></p>
          <h1 class="esp__label" data-slot="label"></h1>
          <ol class="esp__ticks">
            ${this.#data.periodos.map((_, i) => `<li data-index="${i}"></li>`).join('')}
          </ol>
        </header>

        <div class="esp__cols">
          <div class="esp__col esp__col--canales">
            <p class="esp__k">${t.canales} <span class="esp__n" data-slot="nCanales"></span></p>
            <ul class="esp__list esp__list--canales">
              ${this.#data.canales
                .map((c, i) => `<li class="esp__item" data-i="${i}">${c.t}</li>`)
                .join('')}
            </ul>
          </div>
          <div class="esp__col esp__col--preguntas">
            <p class="esp__k">${t.preguntas} <span class="esp__n" data-slot="nPreguntas"></span></p>
            <ul class="esp__list esp__list--preguntas">
              ${this.#data.preguntas
                .map((q, i) => `<li class="esp__item" data-i="${i}">${q.t}</li>`)
                .join('')}
            </ul>
          </div>
        </div>

        <footer class="esp__foot">
          <div class="esp__cierre">
            <p class="esp__ctext">${this.#data.cierre.text}</p>
            <p class="esp__csub">${this.#data.cierre.sub}</p>
            <p class="esp__fuente">${t.fuente}</p>
          </div>
          <p class="esp__hint">${t.hint}</p>
          <button class="esp__btn esp__btn--go" data-act="next"></button>
        </footer>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      event.stopPropagation();

      const act = event.target.closest('[data-act]')?.dataset.act;
      if (act === 'start') return this.#start();
      if (act === 'next') {
        const last = this.#index === this.#data.periodos.length - 1;
        return this.#go(last ? 0 : this.#index + 1);
      }
      const tick = event.target.closest('.esp__ticks li');
      if (tick?.dataset.index) this.#go(Number.parseInt(tick.dataset.index, 10));
    });

    return root;
  }

  #start() {
    this.#showScene('espera');
    this.#go(0);
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.esp__scene')];
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

  /** @param {number} index */
  #go(index) {
    if (index === this.#index) return;
    const back = index < this.#index;
    this.#index = index;
    const periodo = this.#data.periodos[index];
    const t = this.#data.ui;

    this.el.dataset.p = String(index);
    this.el.querySelector('[data-slot="label"]').textContent = periodo.label;
    this.el.querySelector('[data-slot="sub"]').textContent = periodo.sub;

    // Los canales se apagan; las preguntas se encienden. El alto de cada fila
    // va a cero, asi que la columna de la izquierda se vacia de verdad.
    let canales = 0;
    this.#data.canales.forEach((c, i) => {
      const vivo = c.hasta >= index;
      if (vivo) canales += 1;
      this.el.querySelector(`.esp__list--canales [data-i="${i}"]`).dataset.gone = String(!vivo);
    });

    let preguntas = 0;
    this.#data.preguntas.forEach((q, i) => {
      const visible = q.desde <= index;
      if (visible) preguntas += 1;
      this.el.querySelector(`.esp__list--preguntas [data-i="${i}"]`).dataset.gone = String(!visible);
    });

    this.el.querySelector('[data-slot="nCanales"]').textContent = String(canales);
    this.el.querySelector('[data-slot="nPreguntas"]').textContent = String(preguntas);

    for (const tick of this.el.querySelectorAll('.esp__ticks li')) {
      const i = Number(tick.dataset.index);
      tick.dataset.on = String(i === index);
      tick.dataset.done = String(i < index);
    }

    const last = index === this.#data.periodos.length - 1;
    this.el.querySelector('[data-act="next"]').textContent = last ? t.again : t.next;

    if (!back && index > 0) {
      gsap.fromTo(
        this.el.querySelector('.esp__col--preguntas'),
        { opacity: 0.5 },
        { opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
