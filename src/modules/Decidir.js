import gsap from 'gsap';

/**
 * Decidir: clasificar afirmaciones en categorias.
 *
 * Es el modo del pliego que usan los ejes 1, 2, 6 y 7. El componente no sabe
 * de que eje se trata: recibe categorias y casos, y devuelve la clasificacion
 * con su explicacion.
 *
 * Antes de responder solo se ve la afirmacion. El caso que la origina aparece
 * despues, en la devolucion: si se mostrara antes, la respuesta vendria servida.
 *
 * No hay puntaje ni felicitacion. Se dice que eligio, cual era, y por que.
 */
export class Decidir {
  #data;
  #onExit;
  #index = 0;
  #pick = null;

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

  get case() {
    return this.#data.cases[this.#index];
  }

  /** @param {string} k */
  #label(k) {
    return this.#data.categories.find((c) => c.k === k)?.label ?? k;
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'dec';
    root.innerHTML = `
      <ol class="dec__steps">${this.#data.cases.map(() => '<li></li>').join('')}</ol>

      <section class="dec__scene" data-scene="intro">
        <div>
          <h1 class="dec__h1">${this.#data.title}</h1>
          <p class="dec__lead">${this.#data.lead}</p>
          <dl class="dec__defs">
            ${this.#data.categories
              .map(
                (c) => `<div class="dec__def" data-cat="${c.k}">
                  <dt>${c.label}</dt><dd>${c.def}</dd></div>`,
              )
              .join('')}
          </dl>
        </div>
        <div class="dec__acts">
          <button class="dec__btn dec__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="dec__scene" data-scene="ask">
        <p class="dec__kicker" data-slot="counter"></p>
        <blockquote class="dec__claim" data-slot="afirmacion"></blockquote>
        <div>
          <p class="dec__k">${t.prompt}</p>
          <div class="dec__opts"></div>
        </div>
      </section>

      <section class="dec__scene" data-scene="reveal">
        <div class="dec__verdict">
          <p class="dec__row" data-slot="row-yours">
            <span class="dec__k">${t.yours}</span>
            <span class="dec__pill" data-slot="pill-yours"></span>
          </p>
          <p class="dec__row">
            <span class="dec__k" data-slot="k-correct"></span>
            <span class="dec__pill" data-slot="pill-correct"></span>
          </p>
          <p class="dec__matiz" data-slot="matiz"></p>
        </div>
        <div class="dec__explain">
          <p class="dec__k">${t.context}</p>
          <p class="dec__case" data-slot="caso"></p>
          <p class="dec__k dec__k--why">${t.why}</p>
          <p class="dec__why" data-slot="devolucion"></p>
          <p class="dec__note" data-slot="nota"></p>
        </div>
        <button class="dec__btn dec__btn--go dec__next" data-act="next"></button>
      </section>

      <section class="dec__scene" data-scene="fin">
        <div>
          <p class="dec__k">${this.#data.closing.label}</p>
          <p class="dec__close">${this.#data.closing.text}</p>
          <p class="dec__close2">${this.#data.closing.sub}</p>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const opt = target.closest('.dec__opt');
      if (opt?.dataset.cat) return this.#answer(opt.dataset.cat);

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#ask(0);
      else if (act === 'next') this.#next();
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.dec__scene')];
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
    el.hidden = !value;
  }

  /** @param {number} index */
  #ask(index) {
    this.#index = index;
    this.#pick = null;

    const t = this.#data.ui;
    this.#set(
      'counter',
      t.counter
        .replace('{n}', String(index + 1))
        .replace('{total}', String(this.#data.cases.length)),
    );
    this.#set('afirmacion', `“${this.case.afirmacion}”`);

    const opts = this.el.querySelector('.dec__opts');
    opts.replaceChildren();
    for (const category of this.#data.categories) {
      const button = document.createElement('button');
      button.className = 'dec__opt';
      button.type = 'button';
      button.dataset.cat = category.k;
      button.textContent = category.label;
      opts.append(button);
    }

    [...this.el.querySelectorAll('.dec__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });
    this.#showScene('ask');
  }

  /**
   * Sin puntaje ni felicitacion, pero el error tiene que verse. Las dos
   * categorias salen como pastillas del color de cada una: el contraste
   * cromatico hace el trabajo que hacia el "incorrecto".
   * @param {string} cat
   */
  #answer(cat) {
    this.#pick = cat;
    const t = this.#data.ui;
    const right = cat === this.case.correcta;

    const yours = this.el.querySelector('[data-slot="row-yours"]');
    yours.hidden = right;
    const pillYours = this.el.querySelector('[data-slot="pill-yours"]');
    pillYours.textContent = this.#label(cat);
    pillYours.dataset.cat = cat;

    this.#set('k-correct', right ? t.rightIs : t.wrongIs);
    const pillCorrect = this.el.querySelector('[data-slot="pill-correct"]');
    pillCorrect.textContent = this.#label(this.case.correcta);
    pillCorrect.dataset.cat = this.case.correcta;

    // El documento no siempre dice "Distorsion" a secas: cuando hay una
    // formulacion mas precisa, va debajo de la pastilla.
    this.#set('matiz', this.case.matiz ?? '');
    this.el.querySelector('[data-slot="matiz"]').dataset.cat = this.case.correcta;

    this.el.querySelector('.dec__verdict').dataset.right = String(right);

    this.#set('caso', this.case.caso);
    this.#set('devolucion', this.case.devolucion);
    this.#set('nota', this.case.nota ? `${t.note}: ${this.case.nota}` : '');

    const last = this.#index === this.#data.cases.length - 1;
    this.el.querySelector('[data-act="next"]').textContent = last ? t.last : t.next;
    this.#showScene('reveal');
  }

  #next() {
    if (this.#index < this.#data.cases.length - 1) {
      this.#ask(this.#index + 1);
      return;
    }
    for (const li of this.el.querySelectorAll('.dec__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
