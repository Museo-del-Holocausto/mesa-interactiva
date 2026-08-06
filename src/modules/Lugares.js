import gsap from 'gsap';

const RAIL_TOP = 0.16;
const RAIL_BOTTOM = 0.84;
/** Movimiento vertical minimo para considerar que el marcador se movio. */
const Y_DEADZONE = 6;
/** Grados de giro que llevan del antes al despues completo. */
const WIPE_SWEEP_DEG = 180;

/**
 * Las comunidades atacadas. Dos gestos sobre el mismo objeto:
 *
 *   deslizar   elegir el lugar. El marcador sube y baja dentro de su columna.
 *   girar      la cortina. Media vuelta lleva del antes al despues del mismo
 *              lugar, y el texto acompana al lado que ocupe mas de la mitad.
 *
 * El barrido lo maneja el giro y no la posicion horizontal: mover el objeto a
 * lo ancho lo obligaba a pasearse por encima del contenido y lo tapaba. Girando
 * se queda en su columna y el barrido sigue siendo continuo.
 */
export class Lugares {
  #data;
  #onExit;
  #index = -1;
  #lastY = null;
  #lastRot = null;
  #wipeT = 0.5;

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    this.#showScene('aviso');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  // --- entrada del marcador -------------------------------------------------

  /** Vertical: elegir el lugar. */
  applyPosition(_x, y, _w, h) {
    if (this.el.dataset.scene !== 'lugar') return;
    if (this.#lastY !== null && Math.abs(y - this.#lastY) <= Y_DEADZONE) return;
    this.#lastY = y;

    const n = this.#data.lugares.length;
    const t = Math.min(1, Math.max(0, (y - h * RAIL_TOP) / (h * (RAIL_BOTTOM - RAIL_TOP))));
    this.#select(Math.round(t * (n - 1)));
  }

  /** Giro: la cortina. */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'lugar') return;
    if (this.#lastRot === null) {
      this.#lastRot = rotation;
      return;
    }
    const delta = rotation - this.#lastRot;
    this.#lastRot = rotation;
    this.#setWipe(this.#wipeT + delta / WIPE_SWEEP_DEG);
  }

  // --- construccion ---------------------------------------------------------

  #build() {
    const t = this.#data.ui;
    const a = this.#data.advertencia;
    const root = document.createElement('div');
    root.className = 'lug';
    root.dataset.side = 'antes';

    root.innerHTML = `
      <section class="lug__scene" data-scene="aviso">
        <div>
          <p class="lug__k lug__k--warn">${a.label}</p>
          <p class="lug__warn">${a.text}</p>
          <p class="lug__lead">${this.#data.lead}</p>
        </div>
        <div class="lug__acts">
          <button class="lug__btn lug__btn--go" data-act="enter">${a.enter}</button>
          <button class="lug__btn" data-act="exit">${a.exit}</button>
        </div>
      </section>

      <section class="lug__scene" data-scene="lugar">
        <ol class="lug__rail">
          ${this.#data.lugares
            .map((l, i) => `<li data-index="${i}"><span>${l.nombre}</span></li>`)
            .join('')}
        </ol>

        <header class="lug__head">
          <p class="lug__k" data-slot="tipo"></p>
          <h1 class="lug__name" data-slot="nombre"></h1>
        </header>

        <div class="lug__wipe">
          <div class="lug__panel lug__panel--antes">
            <div class="lug__photo"><span>${t.imagePending}</span></div>
          </div>
          <div class="lug__panel lug__panel--despues">
            <div class="lug__photo"><span>${t.imagePending}</span></div>
          </div>
          <div class="lug__seam"></div>
          <div class="lug__tabs">
            <span class="lug__tab lug__tab--antes">${t.antes}</span>
            <span class="lug__tab lug__tab--despues">${t.despues}</span>
          </div>
          <p class="lug__hint">${t.hint}</p>
        </div>

        <div class="lug__cols">
          <div class="lug__state">
            <p class="lug__k" data-slot="estadoLabel"></p>
            <h2 class="lug__stitle" data-slot="estadoTitulo"></h2>
            <p class="lug__stext" data-slot="estadoTexto"></p>
            <p class="lug__caption" data-slot="epigrafe"></p>
          </div>
          <div class="lug__durante">
            <p class="lug__k">${t.durante}</p>
            <p class="lug__stext" data-slot="duranteTexto"></p>
          </div>
        </div>
      </section>`;

    this.despuesEl = root.querySelector('.lug__panel--despues');
    this.seamEl = root.querySelector('.lug__seam');

    root.addEventListener('pointerdown', (event) => {
      if (!(event.target instanceof Element)) return;
      event.stopPropagation();

      const act = event.target.closest('[data-act]')?.dataset.act;
      if (act === 'enter') return this.#enter();
      if (act === 'exit') return this.#onExit();

      const tick = event.target.closest('.lug__rail li');
      if (tick?.dataset.index) return this.#select(Number.parseInt(tick.dataset.index, 10));

      // Arrastrar sobre la imagen hace lo mismo que girar.
      if (event.target.closest('.lug__wipe')) this.#dragWipe(event);
    });

    const n = this.#data.lugares.length;
    [...root.querySelectorAll('.lug__rail li')].forEach((li, i) => {
      li.style.top = `${(RAIL_TOP + (i / (n - 1)) * (RAIL_BOTTOM - RAIL_TOP)) * 100}%`;
    });

    return root;
  }

  /** @param {PointerEvent} event */
  #dragWipe(event) {
    const wipe = this.el.querySelector('.lug__wipe');
    const apply = (e) => {
      const rect = wipe.getBoundingClientRect();
      this.#setWipe((e.clientX - rect.left) / rect.width);
    };
    apply(event);
    wipe.setPointerCapture(event.pointerId);
    const move = (e) => apply(e);
    const up = (e) => {
      wipe.releasePointerCapture(e.pointerId);
      wipe.removeEventListener('pointermove', move);
      wipe.removeEventListener('pointerup', up);
    };
    wipe.addEventListener('pointermove', move);
    wipe.addEventListener('pointerup', up);
  }

  #enter() {
    this.#showScene('lugar');
    this.#select(0, true);
    this.#setWipe(0.5);
  }

  /** @param {string} name */
  #showScene(name) {
    const scenes = [...this.el.querySelectorAll('.lug__scene')];
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

  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = value ?? '';
    el.hidden = !value;
  }

  // --- render ---------------------------------------------------------------

  /** @param {number} t 0 = todo antes, 1 = todo despues */
  #setWipe(t) {
    this.#wipeT = Math.min(1, Math.max(0, t));
    const pct = this.#wipeT * 100;
    this.despuesEl.style.clipPath = `inset(0 0 0 ${pct}%)`;
    this.seamEl.style.left = `${pct}%`;
    this.el.querySelector('.lug__tab--antes').dataset.on = String(this.#wipeT <= 0.5);
    this.el.querySelector('.lug__tab--despues').dataset.on = String(this.#wipeT > 0.5);

    const side = this.#wipeT > 0.5 ? 'despues' : 'antes';
    if (side === this.el.dataset.side) return;
    this.el.dataset.side = side;
    this.#renderState();
    gsap.fromTo(
      this.el.querySelector('.lug__state'),
      { opacity: 0.35 },
      { opacity: 1, duration: 0.28, ease: 'power2.out', overwrite: true },
    );
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index) return;
    this.#index = index;
    const lugar = this.#data.lugares[index];
    if (!lugar) return;

    this.#set('tipo', lugar.tipo);
    this.#set('nombre', lugar.nombre);
    this.#set('duranteTexto', lugar.durante.texto);

    for (const li of this.el.querySelectorAll('.lug__rail li')) {
      li.dataset.on = String(Number(li.dataset.index) === index);
    }
    this.#renderState();

    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.lug__cols'),
        { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', overwrite: true },
      );
    }
  }

  /** El texto sigue a la cortina: manda el lado que ocupa mas de la mitad. */
  #renderState() {
    const lugar = this.#data.lugares[this.#index];
    if (!lugar) return;
    const t = this.#data.ui;
    const despues = this.el.dataset.side === 'despues';
    const layer = despues ? lugar.despues : lugar.antes;
    this.#set('estadoLabel', despues ? t.despues : t.antes);
    this.#set('estadoTitulo', layer.titulo);
    this.#set('estadoTexto', layer.texto);
    this.#set('epigrafe', layer.epigrafe);
  }
}
