import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Definir: pantallas de contenido donde el texto no se entrega servido.
 *
 * El documento de este eje es texto plano y preguntas. No hay mecanismo que
 * descubrir ni decision que tomar. Lo unico que se puede hacer sin tocar una
 * palabra del original es que el visitante tenga que actuar para que el texto
 * aparezca.
 *
 * Dos formas, segun lo que hay adentro de la frase:
 *
 * - `elegir`: la frase enumera cosas. El visitante marca las que le parecen y
 *   confirma. Las que dejo afuera se encienden solas. Nadie se equivoca: se
 *   elige de menos, y eso es justamente el punto —"palabras" y "rumores" no
 *   parecen antisemitismo hasta que estan al lado de "violencia organizada".
 *
 * - `abrir`: la frase asocia varios casos a una misma respuesta. Cada caso se
 *   toca por separado y devuelve siempre lo mismo. La repeticion es el
 *   argumento: la crisis cambia, el culpable no.
 *
 * Sin puntaje y sin respuestas incorrectas. Decir que algo *no* es
 * antisemitismo seria una definicion nueva, y eso lo escribe el equipo de
 * contenido, no la pieza.
 */
export class Definir {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = 0;
  /** Estado por pantalla: 'virgen' | 'elegido' | 'resuelto'. */
  #estado = [];

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.#estado = data.pantallas.map((p) => (p.tipo === 'texto' ? 'resuelto' : 'virgen'));
    this.el = this.#build();
    this.#goPantalla(0);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /**
   * La rosca recorre pantallas, que son hermanas. Para atras siempre se puede.
   * Para adelante solo si la pantalla ya se resolvio: si no, el giro saltearia
   * la interaccion y dejaria el remate sin leer.
   */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'pantalla') return;
    this.#rotary.feed(rotation, 40, (direction) => {
      const next = this.#index + direction;
      if (next < 0) return;
      if (this.#estado[this.#index] !== 'resuelto' && direction > 0) return;
      if (next >= this.#data.pantallas.length) this.#finish();
      else this.#goPantalla(next);
    });
  }

  get #pantalla() {
    return this.#data.pantallas[this.#index];
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'def';
    root.dataset.scene = 'pantalla';
    root.innerHTML = `
      <ol class="def__steps">${this.#data.pantallas.map(() => '<li></li>').join('')}</ol>

      <section class="def__scene" data-scene="pantalla">
        <div class="def__top">
          <h1 class="def__h1" data-slot="titulo"></h1>
          <div class="def__intro" data-slot="intro"></div>
        </div>
        <div class="def__work">
          <p class="def__consigna" data-slot="consigna"></p>
          <p class="def__ayuda" data-slot="ayuda"></p>
          <div class="def__items" data-slot="items"></div>
          <p class="def__estado" data-slot="estado"></p>
        </div>
        <p class="def__remate" data-slot="remate"></p>
        <div class="def__foot">
          <button class="def__btn def__btn--go" data-act="avanzar"></button>
        </div>
      </section>

      <section class="def__scene" data-scene="fin">
        <div>
          <p class="def__k">${this.#data.closing.label}</p>
          <p class="def__close">${this.#data.closing.text}</p>
          <p class="def__close2">${this.#data.closing.sub}</p>
          <button class="def__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const chip = target.closest('.def__chip');
      if (chip) return this.#toggleChip(chip);

      const dot = target.closest('.def__steps li');
      if (dot?.dataset.index) {
        const i = Number.parseInt(dot.dataset.index, 10);
        // Solo hacia atras o hacia una ya resuelta: adelante hay que interactuar.
        if (i <= this.#index || this.#estado[i] === 'resuelto') this.#goPantalla(i);
        return;
      }

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'avanzar') this.#avanzar();
      else if (act === 'again') this.#goPantalla(0);
    });

    [...root.querySelectorAll('.def__steps li')].forEach((li, i) => {
      li.dataset.index = String(i);
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.def__scene')];
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
  #goPantalla(index) {
    this.#index = index;
    const p = this.#pantalla;
    const t = this.#data.ui;

    this.#set('titulo', p.titulo);

    const intro = this.el.querySelector('[data-slot="intro"]');
    intro.replaceChildren();
    for (const text of p.intro ?? []) {
      const el = document.createElement('p');
      el.textContent = text;
      intro.append(el);
    }

    this.#set('consigna', p.consigna ?? '');
    // La instruccion no comparte renglon con la cuenta. Cuando lo hacian, la
    // linea empezaba diciendo una cosa y terminaba diciendo otra.
    this.#set('ayuda', p.ayuda ?? '');
    this.#set('estado', '');
    this.el.querySelector('[data-slot="estado"]').dataset.fuerte = 'false';

    const items = this.el.querySelector('[data-slot="items"]');
    items.replaceChildren();
    items.dataset.formato = p.formato ?? 'pastillas';
    items.dataset.cerrado = 'false';

    if (p.tipo === 'elegir') {
      for (const item of p.items) {
        const chip = document.createElement('button');
        chip.className = 'def__chip';
        chip.type = 'button';
        if (typeof item === 'string') {
          chip.textContent = item;
        } else {
          // Tarjeta: el titulo se elige, y lo de abajo aparece al confirmar.
          chip.innerHTML = `
            <span class="def__chip-nom"></span>
            <span class="def__chip-mas">
              <span class="def__chip-cuando"></span>
              <span class="def__chip-texto"></span>
            </span>`;
          chip.querySelector('.def__chip-nom').textContent = item.titulo;
          chip.querySelector('.def__chip-cuando').textContent = item.cuando;
          chip.querySelector('.def__chip-texto').textContent = item.acusacion;
        }
        items.append(chip);
      }
    }

    const remate = this.el.querySelector('[data-slot="remate"]');
    remate.textContent = p.remate ?? '';
    remate.hidden = !p.remate;
    // En la de texto el remate ya esta: no hay nada que resolver antes.
    gsap.set(remate, { opacity: p.tipo === 'texto' ? 1 : 0 });

    this.#estado[index] = p.tipo === 'texto' ? 'resuelto' : 'virgen';

    [...this.el.querySelectorAll('.def__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });

    this.#syncBoton();
    this.#showScene('pantalla');
  }

  /**
   * Un solo boton con tres estados. Confirmar aparece cuando hay algo elegido;
   * Continuar cuando la pantalla ya se resolvio. Dos botones al lado hacian
   * dudar sobre cual tocar.
   */
  #syncBoton() {
    const t = this.#data.ui;
    const btn = this.el.querySelector('[data-act="avanzar"]');
    const estado = this.#estado[this.#index];
    const ultima = this.#index === this.#data.pantallas.length - 1;

    if (estado === 'elegido') {
      btn.textContent = t.confirm;
      btn.dataset.modo = 'confirmar';
      btn.disabled = false;
    } else if (estado === 'resuelto') {
      btn.textContent = ultima ? t.last : t.next;
      btn.dataset.modo = 'seguir';
      btn.disabled = false;
    } else {
      btn.textContent = t.confirm;
      btn.dataset.modo = 'confirmar';
      // Donde la respuesta correcta es "ninguno", exigir una marcada obligaria
      // a equivocarse al que ya se dio cuenta.
      btn.disabled = !this.#pantalla.permiteVacio;
    }
  }

  /** @param {Element} chip */
  #toggleChip(chip) {
    const items = this.el.querySelector('[data-slot="items"]');
    if (items.dataset.cerrado === 'true') return;

    chip.dataset.elegido = chip.dataset.elegido === 'true' ? 'false' : 'true';
    const n = items.querySelectorAll('[data-elegido="true"]').length;
    this.#set('estado', n ? `${n} elegidas` : '');
    this.#estado[this.#index] = n ? 'elegido' : 'virgen';
    this.#syncBoton();
  }

  /**
   * Se confirma la eleccion. Las que quedaron afuera se encienden de a una:
   * el ritmo es el que hace notar cuantas eran, y todas juntas no se leen.
   */
  #confirmar() {
    const p = this.#pantalla;
    const items = this.el.querySelector('[data-slot="items"]');
    items.dataset.cerrado = 'true';
    const chips = [...items.querySelectorAll('.def__chip')];
    const elegidos = chips.filter((c) => c.dataset.elegido === 'true');
    const faltan = chips.filter((c) => c.dataset.elegido !== 'true');

    const estadoEl = this.el.querySelector('[data-slot="estado"]');
    estadoEl.dataset.fuerte = 'true';
    this.#estado[this.#index] = 'resuelto';

    // Pantalla invertida: la respuesta es "ninguno". Se apagan las marcadas de
    // a una, en vez de encenderse las que faltaban.
    if (p.invertida) {
      for (const chip of chips) chip.dataset.apagado = 'true';
      if (!elegidos.length) {
        this.#set('estado', p.vacio ?? p.completo);
        this.#mostrarRemate(0.55);
        return;
      }
      this.#set('estado', p.parcial);
      elegidos.forEach((chip, i) => {
        gsap.delayedCall(0.42 + i * 0.34, () => {
          chip.dataset.elegido = 'false';
          if (i === elegidos.length - 1) this.#mostrarRemate(0.5);
        });
      });
      this.#syncBoton();
      return;
    }

    for (const chip of elegidos) chip.dataset.revelado = 'true';

    if (!faltan.length) {
      this.#set('estado', p.completo);
      this.#mostrarRemate(0.55);
      return;
    }

    this.#set('estado', p.parcial);
    faltan.forEach((chip, i) => {
      gsap.delayedCall(0.5 + i * 0.42, () => {
        chip.dataset.revelado = 'true';
        if (i === faltan.length - 1) this.#mostrarRemate(0.55);
      });
    });
    this.#syncBoton();
  }

  /** @param {number} delay */
  #mostrarRemate(delay) {
    const remate = this.el.querySelector('[data-slot="remate"]');
    gsap.fromTo(
      remate,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.7, delay, ease: 'power2.out' },
    );
    gsap.delayedCall(delay + 0.2, () => {
      this.#estado[this.#index] = 'resuelto';
      this.#syncBoton();
    });
  }

  #avanzar() {
    const btn = this.el.querySelector('[data-act="avanzar"]');
    if (btn.dataset.modo === 'confirmar') {
      btn.disabled = true;
      this.#confirmar();
      return;
    }
    if (this.#index < this.#data.pantallas.length - 1) this.#goPantalla(this.#index + 1);
    else this.#finish();
  }

  #finish() {
    for (const li of this.el.querySelectorAll('.def__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }
}
