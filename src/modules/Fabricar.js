import gsap from 'gsap';

/**
 * Fabrica de mitos.
 *
 * El visitante arma la acusacion: elige un hecho cierto y una emocion para
 * dirigirla, la mesa compone la frase, y despues muestra que esa acusacion
 * existio de verdad, con fecha y consecuencia.
 *
 * Cuatro crisis en orden. Al final las cuatro frases juntas, que hablan de las
 * mismas personas y se contradicen entre si.
 */
export class Fabricar {
  #data;
  #onExit;
  #crisisIndex = 0;
  #pickA = null;
  #pickB = null;
  /** @type {{yr: string, t: string}[]} */
  #dichas = [];

  /**
   * @param {any} data bloque `fabricar` del contenido
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

  get crisis() {
    return this.#data.crisis[this.#crisisIndex];
  }

  #build() {
    const t = this.#data;
    const root = document.createElement('div');
    root.className = 'fab';
    root.innerHTML = `
      <ol class="fab__steps">${t.crisis.map(() => '<li></li>').join('')}</ol>

      <section class="fab__scene" data-scene="intro">
        <div>
          <h1 class="fab__h1">${t.h1}</h1>
          <p class="fab__lead">${t.intro}</p>
          <p class="fab__warn">${t.warn}</p>
        </div>
        <div class="fab__acts">
          <button class="fab__btn fab__btn--go" data-act="start">${t.start}</button>
          <button class="fab__btn" data-act="exit">${t.optOut}</button>
        </div>
      </section>

      <section class="fab__scene" data-scene="build">
        <div class="fab__crisis">
          <p class="fab__yr" data-slot="yr"></p>
          <p class="fab__lg" data-slot="lg"></p>
          <p class="fab__ctx" data-slot="ctx"></p>
          <p class="fab__rol" data-slot="rol"></p>
        </div>
        <div class="fab__cola">
          <h3 class="fab__colh">${t.colA}</h3>
          <div class="fab__opts" data-col="a"></div>
        </div>
        <div class="fab__colb">
          <h3 class="fab__colh" data-slot="h2"></h3>
          <div class="fab__opts" data-col="b"></div>
        </div>
        <div class="fab__said">
          <p class="fab__saidh">${t.sayLabel}</p>
          <p class="fab__phrase" data-slot="phrase" data-wait="true">${t.waiting}</p>
        </div>
        <button class="fab__btn fab__btn--go fab__say" data-act="say" disabled>${t.say}</button>
      </section>

      <section class="fab__scene" data-scene="reveal">
        <div class="fab__recipe">
          <p class="fab__rrow"><span class="fab__k">${t.revFrom}</span>
            <span class="fab__v" data-slot="r-hecho"></span>
            <span class="fab__tag">${t.revTagTrue}</span></p>
          <p class="fab__rrow"><span class="fab__k">${t.revAdd}</span>
            <span class="fab__v fab__v--em" data-slot="r-emo"></span></p>
          <p class="fab__rrow"><span class="fab__k">${t.revSaid}</span>
            <span class="fab__mine" data-slot="r-mine"></span></p>
        </div>
        <div class="fab__cut">
          <p class="fab__k">${t.revHeard}</p>
          <p class="fab__hist" data-slot="hist"></p>
          <p class="fab__kick" data-slot="kick"></p>
        </div>
        <button class="fab__btn fab__btn--go fab__say" data-act="next"></button>
      </section>

      <section class="fab__scene" data-scene="fin">
        <p class="fab__k">${t.finLabel}</p>
        <ul class="fab__list"></ul>
        <p class="fab__close">${t.finClose}</p>
        <p class="fab__close2">${t.finClose2}</p>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const opt = target.closest('.fab__opt');
      if (opt) return this.#pick(opt.dataset.col, opt.dataset.key);

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#startCrisis(0);
      else if (act === 'exit') this.#onExit();
      else if (act === 'say') this.#reveal();
      else if (act === 'next') this.#next();
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.fab__scene')];
    for (const scene of scenes) {
      scene.dataset.on = String(scene.dataset.scene === name);
    }
    // Apagar todas por GSAP y no solo por CSS: si queda una opacidad inline
    // de una transicion anterior, le gana a la regla y las escenas se apilan.
    gsap.killTweensOf(scenes);
    gsap.set(scenes, { opacity: 0 });
    this.el.dataset.scene = name;
    const active = this.el.querySelector(`[data-scene="${name}"]`);
    gsap.to(active, { opacity: 1, duration: 0.34, ease: 'power2.out' });
  }

  /** @param {string} slot @param {string} value */
  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (el) el.textContent = value;
  }

  /** @param {number} index */
  #startCrisis(index) {
    this.#crisisIndex = index;
    this.#pickA = null;
    this.#pickB = null;

    const c = this.crisis;
    this.#set('yr', c.yr);
    this.#set('lg', c.lg);
    this.#set('ctx', c.ctx);
    this.#set('rol', c.rol);
    this.#set('h2', c.h2);

    for (const [col, opts] of [['a', c.a], ['b', c.b]]) {
      const box = this.el.querySelector(`[data-col="${col}"]`);
      box.replaceChildren();
      for (const opt of opts) {
        const button = document.createElement('button');
        button.className = 'fab__opt';
        button.type = 'button';
        button.dataset.col = col;
        button.dataset.key = opt.k;
        button.textContent = opt.t;
        box.append(button);
      }
    }

    this.#syncPhrase();
    [...this.el.querySelectorAll('.fab__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });
    this.#showScene('build');
  }

  /** @param {string} col @param {string} key */
  #pick(col, key) {
    if (col === 'a') this.#pickA = key;
    else this.#pickB = key;
    for (const button of this.el.querySelectorAll(`[data-col="${col}"] .fab__opt`)) {
      button.dataset.on = String(button.dataset.key === key);
    }
    this.#syncPhrase();
  }

  #syncPhrase() {
    const ready = this.#pickA && this.#pickB;
    const phrase = this.el.querySelector('[data-slot="phrase"]');
    const say = this.el.querySelector('[data-act="say"]');
    phrase.dataset.wait = String(!ready);
    phrase.textContent = ready
      ? this.crisis.f[`${this.#pickA}|${this.#pickB}`]
      : this.#data.waiting;
    say.disabled = !ready;
    if (ready) gsap.fromTo(phrase, { opacity: 0.3 }, { opacity: 1, duration: 0.3 });
  }

  #reveal() {
    const c = this.crisis;
    const hecho = c.a.find((o) => o.k === this.#pickA);
    const emo = c.b.find((o) => o.k === this.#pickB);
    const frase = c.f[`${this.#pickA}|${this.#pickB}`];

    this.#dichas.push({ yr: c.yr, t: frase });

    this.#set('r-hecho', hecho?.t ?? '');
    this.#set('r-emo', emo?.t ?? '');
    this.#set('r-mine', frase);
    this.#set('hist', c.hist);
    this.#set('kick', c.kick[this.#pickB] ?? '');

    const last = this.#crisisIndex === this.#data.crisis.length - 1;
    this.el.querySelector('[data-act="next"]').textContent = last
      ? this.#data.last
      : this.#data.next;
    this.#showScene('reveal');
  }

  #next() {
    if (this.#crisisIndex < this.#data.crisis.length - 1) {
      this.#startCrisis(this.#crisisIndex + 1);
      return;
    }
    const list = this.el.querySelector('.fab__list');
    list.replaceChildren();
    for (const said of this.#dichas) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="fab__liyr">${said.yr}</span>${said.t}`;
      list.append(li);
    }
    for (const li of this.el.querySelectorAll('.fab__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
