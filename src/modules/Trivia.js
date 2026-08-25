import gsap from 'gsap';

/**
 * Trivia: preguntas de opcion multiple al final de un eje.
 *
 * El equipo de contenido cierra cada parte de sus documentos con una pregunta.
 * No son un juego: son la forma en que un educador verifica que se entendio,
 * como en una visita guiada. Juntarlas al final del eje las convierte en un
 * repaso, que es lo unico que las vuelve util —sueltas, una pregunta por
 * pantalla de texto, quedan como un examen de tres renglones.
 *
 * Se dice cual era la respuesta, no cuantas acertaste. Igual que en Decidir:
 * no hay puntaje, pero el error tiene que verse. La correcta se enciende y la
 * elegida queda marcada al lado.
 *
 * La pieza no sabe de que eje se trata: recibe preguntas y las pasa.
 */
export class Trivia {
  #data;
  #onExit;
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

  get #pregunta() {
    return this.#data.preguntas[this.#index];
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'tri';
    root.innerHTML = `
      <ol class="tri__steps">${this.#data.preguntas.map(() => '<li></li>').join('')}</ol>

      <section class="tri__scene" data-scene="intro">
        <div>
          <h1 class="tri__h1">${this.#data.title}</h1>
          <p class="tri__lead">${this.#data.lead}</p>
        </div>
        <div class="tri__acts">
          <button class="tri__btn tri__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="tri__scene" data-scene="ask">
        <p class="tri__kicker" data-slot="counter"></p>
        <p class="tri__claim" data-slot="enunciado"></p>
        <div class="tri__opts" data-slot="opts"></div>
        <div class="tri__after">
          <p class="tri__exp" data-slot="explicacion"></p>
          <p class="tri__msg" data-slot="mensaje"></p>
        </div>
        <div class="tri__foot">
          <button class="tri__btn tri__btn--go" data-act="next"></button>
        </div>
      </section>

      <section class="tri__scene" data-scene="fin">
        <div>
          <p class="tri__k">${this.#data.closing.label}</p>
          <p class="tri__close">${this.#data.closing.text}</p>
          <p class="tri__close2">${this.#data.closing.sub}</p>
          <button class="tri__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const opt = target.closest('.tri__opt');
      if (opt?.dataset.k) return this.#answer(opt.dataset.k);

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#ask(0);
      else if (act === 'next') this.#next();
      else if (act === 'again') this.#ask(0);
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.tri__scene')];
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
    const t = this.#data.ui;
    const p = this.#pregunta;

    this.#set(
      'counter',
      t.counter
        .replace('{n}', String(index + 1))
        .replace('{total}', String(this.#data.preguntas.length)),
    );
    this.#set('enunciado', p.enunciado);

    const opts = this.el.querySelector('[data-slot="opts"]');
    opts.replaceChildren();
    opts.dataset.formato = p.formato ?? 'columna';
    opts.dataset.cerrado = 'false';
    for (const option of p.opciones) {
      const button = document.createElement('button');
      button.className = 'tri__opt';
      button.type = 'button';
      button.dataset.k = option.k;
      button.textContent = option.label;
      opts.append(button);
    }

    this.#set('explicacion', '');
    this.#set('mensaje', '');
    gsap.set(this.el.querySelector('.tri__after'), { opacity: 0 });

    const next = this.el.querySelector('[data-act="next"]');
    next.hidden = true;

    [...this.el.querySelectorAll('.tri__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });

    this.#showScene('ask');
  }

  /**
   * Sin puntaje ni felicitacion. La correcta se enciende siempre; la elegida
   * solo se marca cuando no coincide, para que el error se vea sin tener que
   * escribir "incorrecto".
   * @param {string} k
   */
  #answer(k) {
    const opts = this.el.querySelector('[data-slot="opts"]');
    if (opts.dataset.cerrado === 'true') return;
    opts.dataset.cerrado = 'true';

    const p = this.#pregunta;
    for (const opt of opts.querySelectorAll('.tri__opt')) {
      if (opt.dataset.k === p.correcta) opt.dataset.estado = 'correcta';
      else if (opt.dataset.k === k) opt.dataset.estado = 'elegida';
      else opt.dataset.estado = 'apagada';
    }

    this.#set('explicacion', p.explicacion ?? '');
    this.#set('mensaje', p.mensaje ?? '');
    gsap.to(this.el.querySelector('.tri__after'), {
      opacity: 1,
      duration: 0.55,
      delay: 0.3,
      ease: 'power2.out',
    });

    const t = this.#data.ui;
    const last = this.#index === this.#data.preguntas.length - 1;
    const next = this.el.querySelector('[data-act="next"]');
    next.textContent = last ? t.last : t.next;
    next.hidden = false;
  }

  #next() {
    if (this.#index < this.#data.preguntas.length - 1) {
      this.#ask(this.#index + 1);
      return;
    }
    for (const li of this.el.querySelectorAll('.tri__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
