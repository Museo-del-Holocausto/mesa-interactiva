import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Combinar: armar una persona eligiendo un valor por eje.
 *
 * El visitante no acierta ni falla: compone. La frase se arma a medida que
 * elige y al final la mesa dice dos cosas: que esa persona existe, y cuantas
 * mas hay. La cuenta sale de multiplicar las opciones reales del contenido,
 * asi que si cambian las listas cambia el numero solo.
 *
 * Es la unica pieza donde el marcador fisico trabaja adentro del contenido, y
 * es coherente con la gramatica: las opciones de un eje son hermanas, y la
 * rosca recorre hermanos. El toque hace todo lo mismo.
 */
export class Combinar {
  #data;
  #onExit;
  #rotary = new Rotary();
  #axisIndex = 0;
  /** @type {number[]} indice elegido por eje */
  #picks = [];

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.#picks = data.axes.map(() => 0);
    this.el = this.#build();
    this.#showScene('intro');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** El cuadrante reenvia el giro cuando la pieza lo acepta. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'compose') return;
    this.#rotary.feed(rotation, 360 / this.#axis.options.length, (direction) => {
      const n = this.#axis.options.length;
      this.#pick((this.#picks[this.#axisIndex] + direction + n) % n);
    });
  }

  get #axis() {
    return this.#data.axes[this.#axisIndex];
  }

  /** Cuantas personas distintas permiten estas preguntas. */
  get #total() {
    return this.#data.axes.reduce((acc, axis) => acc * axis.options.length, 1);
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'comb';
    root.innerHTML = `
      <ol class="comb__steps">${this.#data.axes.map(() => '<li></li>').join('')}</ol>

      <section class="comb__scene" data-scene="intro">
        <div>
          <h1 class="comb__h1">${this.#data.title}</h1>
          <p class="comb__lead">${this.#data.lead}</p>
        </div>
        <div><button class="comb__btn comb__btn--go" data-act="start">${t.start}</button></div>
      </section>

      <section class="comb__scene" data-scene="compose">
        <p class="comb__sentence"></p>
        <div class="comb__pick">
          <div>
            <p class="comb__q" data-slot="question"></p>
            <div class="comb__opts"></div>
          </div>
          <div class="comb__def">
            <p class="comb__k" data-slot="axis-label"></p>
            <p class="comb__deftext" data-slot="def"></p>
          </div>
        </div>
        <div class="comb__foot">
          <p class="comb__hint">${this.#data.hint}</p>
          <button class="comb__btn comb__btn--go" data-act="next"></button>
        </div>
      </section>

      <section class="comb__scene" data-scene="fin">
        <div>
          <p class="comb__final"></p>
          <p class="comb__exists">${t.exists}</p>
        </div>
        <div class="comb__count">
          <p class="comb__number">${this.#total.toLocaleString('es-AR')}</p>
          <p class="comb__k">${t.countLabel}</p>
          <p class="comb__andthis">${t.andThis}</p>
        </div>
        <div>
          <p class="comb__close">${this.#data.closing.text}</p>
          <p class="comb__close2">${this.#data.closing.sub}</p>
        </div>
        <div class="comb__foot">
          <span></span>
          <button class="comb__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const opt = target.closest('.comb__opt');
      if (opt?.dataset.index) {
        const index = Number.parseInt(opt.dataset.index, 10);
        // Tocar la opcion ya elegida confirma: seleccionar y avanzar en un gesto.
        if (index === this.#picks[this.#axisIndex]) this.#advance();
        else this.#pick(index);
        return;
      }

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#goAxis(0);
      else if (act === 'next') this.#advance();
      else if (act === 'again') {
        this.#picks = this.#data.axes.map(() => 0);
        this.#goAxis(0);
      }
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.comb__scene')];
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
  #goAxis(index) {
    this.#axisIndex = index;
    this.#rotary.reset();

    const axis = this.#axis;
    this.el.querySelector('[data-slot="question"]').textContent = axis.question;
    this.el.querySelector('[data-slot="axis-label"]').textContent = axis.label;

    const opts = this.el.querySelector('.comb__opts');
    opts.replaceChildren();
    axis.options.forEach((option, i) => {
      const button = document.createElement('button');
      button.className = 'comb__opt';
      button.type = 'button';
      button.dataset.index = String(i);
      button.textContent = option.label;
      opts.append(button);
    });

    [...this.el.querySelectorAll('.comb__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });

    const last = index === this.#data.axes.length - 1;
    this.el.querySelector('[data-act="next"]').textContent = last
      ? this.#data.ui.last
      : this.#data.ui.next;

    this.#pick(this.#picks[index] ?? 0, true);
    this.#showScene('compose');
  }

  /** @param {number} index @param {boolean} [immediate] */
  #pick(index, immediate = false) {
    this.#picks[this.#axisIndex] = index;
    const option = this.#axis.options[index];

    for (const button of this.el.querySelectorAll('.comb__opt')) {
      button.dataset.on = String(Number(button.dataset.index) === index);
    }
    this.el.querySelector('[data-slot="def"]').textContent = option.def;
    this.#renderSentence();

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.comb__def'),
        { opacity: 0.35 },
        { opacity: 1, duration: 0.26, ease: 'power2.out', overwrite: true },
      );
    }
  }

  #advance() {
    if (this.#axisIndex < this.#data.axes.length - 1) {
      this.#goAxis(this.#axisIndex + 1);
      return;
    }
    this.el.querySelector('.comb__final').textContent = this.#sentence(false);
    for (const li of this.el.querySelectorAll('.comb__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }

  /**
   * Arma la frase desde la plantilla del contenido. Los ejes que todavia no se
   * eligieron quedan como hueco, para que se vea que falta.
   * @param {boolean} withPending
   */
  #sentence(withPending) {
    return this.#data.axes
      .reduce(
        (text, axis, i) =>
          text.replace(
            `{${axis.id}}`,
            i <= this.#axisIndex || !withPending
              ? axis.options[this.#picks[i]].frase
              : `<span class="comb__gap">${axis.label}</span>`,
          ),
        this.#data.template,
      )
      .trim();
  }

  #renderSentence() {
    this.el.querySelector('.comb__sentence').innerHTML = this.#sentence(true);
  }
}
