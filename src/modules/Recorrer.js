import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Recorrer: traves&iacute;a ordenada donde la acumulaci&oacute;n es el argumento.
 *
 * El tercer modo del pliego. La diferencia con Explorar no es el orden: es que
 * lo anterior no se va. Cada paso agrega medidas a una pila que queda a la
 * vista, y al final la pila entera es la demostracion. Contarlo con texto no
 * alcanza: hay que verlo apilarse.
 *
 * La rosca recorre pasos, que son hermanos. Ir para atras des-apila, porque el
 * mecanismo tiene que poder verse en los dos sentidos.
 */
export class Recorrer {
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
    this.#showScene('intro');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /** El cuadrante reenvia el giro cuando la pieza lo acepta. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'walk') return;
    this.#rotary.feed(rotation, 40, (direction) => {
      const next = this.#index + direction;
      if (next < 0) return;
      if (next >= this.#data.steps.length) this.#finish();
      else this.#goStep(next);
    });
  }

  get #step() {
    return this.#data.steps[this.#index];
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'rec';
    root.innerHTML = `
      <ol class="rec__steps">${this.#data.steps.map(() => '<li></li>').join('')}</ol>

      <section class="rec__scene" data-scene="intro">
        <div>
          <h1 class="rec__h1">${this.#data.title}</h1>
          <p class="rec__lead">${this.#data.lead}</p>
        </div>
        <div><button class="rec__btn rec__btn--go" data-act="start">${t.start}</button></div>
      </section>

      <section class="rec__scene" data-scene="walk">
        <div class="rec__step">
          <p class="rec__counter" data-slot="counter"></p>
          <h2 class="rec__title" data-slot="title"></h2>
          <p class="rec__desc" data-slot="desc"></p>
          <p class="rec__note" data-slot="nota"></p>
        </div>
        <div class="rec__stack">
          <p class="rec__k">${this.#data.stackLabel}</p>
          <p class="rec__total"><span class="rec__accum">0</span> ${t.accum}</p>
          <ul class="rec__list"></ul>
        </div>
        <div class="rec__foot">
          <p class="rec__hint">${this.#data.hint}</p>
          <button class="rec__btn rec__btn--go" data-act="next"></button>
        </div>
      </section>

      <section class="rec__scene" data-scene="fin">
        <div class="rec__stack rec__stack--full">
          <p class="rec__k">${this.#data.stackLabel}</p>
          <ul class="rec__list rec__list--full"></ul>
        </div>
        <div class="rec__end">
          <p class="rec__k">${this.#data.closing.label}</p>
          <p class="rec__close">${this.#data.closing.text}</p>
          <p class="rec__close2">${this.#data.closing.sub}</p>
          <button class="rec__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const dot = target.closest('.rec__steps li');
      if (dot?.dataset.index) return this.#goStep(Number.parseInt(dot.dataset.index, 10));

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#goStep(0);
      else if (act === 'next') {
        if (this.#index < this.#data.steps.length - 1) this.#goStep(this.#index + 1);
        else this.#finish();
      } else if (act === 'again') this.#goStep(0);
    });

    [...root.querySelectorAll('.rec__steps li')].forEach((li, i) => {
      li.dataset.index = String(i);
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.rec__scene')];
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
  #goStep(index) {
    this.#index = index;
    this.#rotary.reset();

    const step = this.#step;
    const t = this.#data.ui;
    const set = (slot, value) => {
      const el = this.el.querySelector(`[data-scene="walk"] [data-slot="${slot}"]`);
      if (!el) return;
      el.textContent = value ?? '';
      el.hidden = !value;
    };
    set(
      'counter',
      t.counter
        .replace('{n}', String(index + 1))
        .replace('{total}', String(this.#data.steps.length)),
    );
    set('title', step.title);
    set('desc', step.desc);
    set('nota', step.nota);

    [...this.el.querySelectorAll('.rec__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });

    const last = index === this.#data.steps.length - 1;
    this.el.querySelector('[data-act="next"]').textContent = last ? t.last : t.next;

    this.#renderStack(index);
    this.#showScene('walk');
  }

  /**
   * La pila no lista las veinte medidas de corrido: eso se lee como un menu.
   * Los pasos ya recorridos se colapsan a nombre + barra de marcas + cuenta,
   * y solo el paso actual muestra sus rotulos. Lo que crece es la barra, y
   * arriba el numero acumulado. La lista completa va en el cierre.
   * @param {number} upTo
   */
  #renderStack(upTo) {
    const list = this.el.querySelector('.rec__list');
    list.replaceChildren();

    this.#data.steps.slice(0, upTo + 1).forEach((step, i) => {
      const current = i === upTo;
      const row = document.createElement('li');
      row.className = 'rec__row';
      row.dataset.current = String(current);
      row.innerHTML = `
        <p class="rec__rowhead">
          <span class="rec__rowname">${step.title}</span>
          <span class="rec__ticks">${step.measures.map(() => '<i></i>').join('')}</span>
          <span class="rec__rowcount">${step.measures.length}</span>
        </p>
        ${
          current
            ? `<ul class="rec__items">${step.measures
                .map(
                  (m) =>
                    `<li class="rec__measure">${m.t}${
                      m.fecha ? `<span class="rec__fecha">${m.fecha}</span>` : ''
                    }</li>`,
                )
                .join('')}</ul>`
            : ''
        }`;
      list.append(row);
    });

    const accum = this.#data.steps
      .slice(0, upTo + 1)
      .reduce((acc, step) => acc + step.measures.length, 0);
    this.#countTo(accum);

    const fresh = list.querySelectorAll('[data-current="true"] .rec__measure');
    if (fresh.length > 0) {
      gsap.from(fresh, { opacity: 0, x: -12, duration: 0.32, stagger: 0.05, ease: 'power2.out' });
    }
    const ticks = list.querySelectorAll('[data-current="true"] .rec__ticks i');
    gsap.from(ticks, { scaleX: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out' });
  }

  /**
   * El numero sube en vez de cambiar de golpe: la cifra es la que carga el
   * argumento y conviene verla moverse.
   * @param {number} value
   */
  #countTo(value) {
    const el = this.el.querySelector('.rec__accum');
    const from = { n: Number.parseInt(el.textContent, 10) || 0 };
    gsap.to(from, {
      n: value,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(from.n));
      },
    });
  }

  /** El cierre si muestra las veinte, que es donde la pila es el argumento. */
  #renderFull() {
    const list = this.el.querySelector('.rec__list--full');
    list.replaceChildren();
    for (const step of this.#data.steps) {
      const group = document.createElement('li');
      group.className = 'rec__group';
      group.innerHTML = `
        <p class="rec__grouph">${step.title}</p>
        <ul>${step.measures
          .map(
            (m) =>
              `<li class="rec__measure">${m.t}${
                m.fecha ? `<span class="rec__fecha">${m.fecha}</span>` : ''
              }</li>`,
          )
          .join('')}</ul>`;
      list.append(group);
    }
  }

  #finish() {
    this.#renderFull();
    for (const li of this.el.querySelectorAll('.rec__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
