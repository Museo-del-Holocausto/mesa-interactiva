import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Estimar: el visitante da un numero girando el marcador y despues ve el real.
 *
 * Es la unica pieza donde el marcador hace lo que un dial hace bien —elegir una
 * cantidad— en vez de cambiar de pantalla. Y es la unica donde el visitante
 * deja algo suyo en la mesa antes de que la mesa le conteste: la distancia
 * entre los dos numeros es el contenido, no el dato solo.
 *
 * El numero elegido NO va adentro del anillo. El marcador fisico se apoya
 * justo ahi y taparia lo unico que hay que mirar mientras se gira. El anillo
 * queda hueco y el numero vive afuera, en la columna de texto.
 *
 * Dos tipos de pregunta:
 * - porcentaje: 0 a `max`.
 * - `anio`: de `min` a `max`. Si `real` es null, la respuesta es que nunca
 *   ocurrio: se gire lo que se gire no hay año correcto, y ese es el punto.
 */
export class Estimar {
  #data;
  #onExit;
  #rotary = new Rotary();
  #index = 0;
  /** 0..1 sobre el recorrido de la pregunta actual. */
  #t = 0;
  #cerrado = false;
  #respuestas = [];

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

  /**
   * Un paso de giro vale una unidad. Los años necesitan pasos mas cortos: hay
   * 160 de recorrido contra 100 de un porcentaje.
   */
  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'ask' || this.#cerrado) return;
    const p = this.#pregunta;
    const span = (p.max ?? 100) - (p.min ?? 0);
    this.#rotary.feed(rotation, span > 120 ? 3 : 6, (direction) => {
      this.#t = Math.min(1, Math.max(0, this.#t + (direction * 1) / span));
      this.#pintar();
    });
  }

  get #pregunta() {
    return this.#data.preguntas[this.#index];
  }

  get #valor() {
    const p = this.#pregunta;
    const min = p.min ?? 0;
    return Math.round(min + this.#t * ((p.max ?? 100) - min));
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'est';
    root.dataset.scene = 'intro';
    root.innerHTML = `
      <ol class="est__steps">${this.#data.preguntas.map(() => '<li></li>').join('')}</ol>

      <section class="est__scene" data-scene="intro">
        <div>
          <h1 class="est__h1">${this.#data.title}</h1>
          <p class="est__lead">${this.#data.lead}</p>
        </div>
        <div class="est__acts">
          <button class="est__btn est__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="est__scene" data-scene="ask">
        <div class="est__dial">
          <svg viewBox="0 0 340 340" aria-hidden="true">
            <circle class="est__aro" cx="170" cy="170" r="150"></circle>
            <path class="est__arco" data-slot="arco"></path>
            <circle class="est__tope" data-slot="tope" cx="170" cy="20" r="8"></circle>
          </svg>
        </div>
        <div class="est__col">
          <p class="est__kicker" data-slot="counter"></p>
          <p class="est__q" data-slot="enunciado"></p>
          <div class="est__lectura">
            <span class="est__cifra" data-slot="cifra">0</span>
            <span class="est__unidad" data-slot="unidad"></span>
          </div>
          <p class="est__spin" data-slot="spin">${t.spin}</p>
          <div class="est__comp" data-slot="comp"></div>
          <p class="est__fuente" data-slot="fuente"></p>
        </div>
        <div class="est__foot">
          <button class="est__btn est__btn--go" data-act="avanzar"></button>
        </div>
      </section>

      <section class="est__scene" data-scene="fin">
        <div>
          <p class="est__k">${this.#data.closing.label}</p>
          <p class="est__close">${this.#data.closing.text}</p>
          <p class="est__close2">${this.#data.closing.sub}</p>
        </div>
        <ul class="est__resumen" data-slot="resumen"></ul>
        <div class="est__acts">
          <button class="est__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();
      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#ask(0);
      else if (act === 'avanzar') this.#avanzar();
      else if (act === 'again') this.#reiniciar();
    });

    // Alternativa tactil: arrastrar sobre el anillo. El giro del marcador y el
    // dedo escriben el mismo valor; ninguno de los dos es el modo principal.
    const dial = root.querySelector('.est__dial');
    let drag = false;
    const desde = (event) => {
      if (this.#cerrado) return;
      const r = dial.getBoundingClientRect();
      let ang =
        Math.atan2(event.clientY - (r.top + r.height / 2), event.clientX - (r.left + r.width / 2)) +
        Math.PI / 2;
      if (ang < 0) ang += Math.PI * 2;
      this.#t = Math.min(1, ang / (Math.PI * 2));
      this.#pintar();
    };
    dial.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      drag = true;
      dial.setPointerCapture(event.pointerId);
      desde(event);
    });
    dial.addEventListener('pointermove', (event) => {
      if (drag) desde(event);
    });
    dial.addEventListener('pointerup', () => {
      drag = false;
    });

    return root;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.est__scene')];
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

  #pintar() {
    this.#set('cifra', String(this.#valor));
    const arco = this.el.querySelector('[data-slot="arco"]');
    const tope = this.el.querySelector('[data-slot="tope"]');
    const a = this.#t * Math.PI * 2 - Math.PI / 2;
    const r = 150;
    const x = 170 + r * Math.cos(a);
    const y = 170 + r * Math.sin(a);
    arco.setAttribute(
      'd',
      this.#t === 0 ? '' : `M 170 ${170 - r} A ${r} ${r} 0 ${this.#t > 0.5 ? 1 : 0} 1 ${x} ${y}`,
    );
    tope.setAttribute('cx', String(x));
    tope.setAttribute('cy', String(y));
  }

  /** @param {number} index */
  #ask(index) {
    const t = this.#data.ui;
    this.#index = index;
    this.#t = 0;
    this.#cerrado = false;
    this.#rotary.reset();

    const p = this.#pregunta;
    this.#set(
      'counter',
      t.counter
        .replace('{n}', String(index + 1))
        .replace('{total}', String(this.#data.preguntas.length)),
    );
    this.#set('enunciado', p.enunciado);
    this.#set('unidad', p.unidad);
    this.#set('spin', t.spin);
    this.#set('fuente', '');

    const comp = this.el.querySelector('[data-slot="comp"]');
    comp.replaceChildren();
    comp.dataset.on = 'false';

    this.el.querySelector('.est__lectura').dataset.cerrado = 'false';
    this.#pintar();

    const btn = this.el.querySelector('[data-act="avanzar"]');
    btn.textContent = t.confirm;
    btn.dataset.modo = 'confirmar';

    [...this.el.querySelectorAll('.est__steps li')].forEach((li, i) => {
      li.dataset.done = String(i < index);
      li.dataset.on = String(i === index);
    });

    this.#showScene('ask');
  }

  #confirmar() {
    const t = this.#data.ui;
    const p = this.#pregunta;
    const v = this.#valor;
    this.#cerrado = true;
    this.#respuestas.push({ tuyo: v, corto: p.corto, enunciado: p.enunciado });

    this.el.querySelector('.est__lectura').dataset.cerrado = 'true';
    this.#set('spin', '');

    const comp = this.el.querySelector('[data-slot="comp"]');
    comp.dataset.on = 'true';

    // El año que nunca llego: no hay barra que comparar, hay dos poblaciones.
    if (p.tipo === 'anio' && p.real === null) {
      comp.innerHTML = `
        <p class="est__brecha"><span class="est__veredicto"></span><span class="est__detalle"></span></p>
        <div class="est__dosnum">
          <div><p class="est__rot"></p><p class="est__gran"></p></div>
          <div class="est__hoy"><p class="est__rot"></p><p class="est__gran"></p></div>
        </div>`;
      comp.querySelector('.est__veredicto').textContent = p.veredicto;
      comp.querySelector('.est__detalle').textContent = p.detalle;
      const cajas = comp.querySelectorAll('.est__dosnum > div');
      cajas[0].querySelector('.est__rot').textContent = p.antes.rot;
      cajas[0].querySelector('.est__gran').textContent = p.antes.val;
      cajas[1].querySelector('.est__rot').textContent = p.ahora.rot;
      cajas[1].querySelector('.est__gran').textContent = p.ahora.val;
    } else if (p.tipo === 'anio') {
      const dif = Math.abs(v - p.real);
      comp.innerHTML = `
        <div class="est__dosnum">
          <div><p class="est__rot"></p><p class="est__gran"></p></div>
          <div class="est__hoy"><p class="est__rot"></p><p class="est__gran"></p></div>
        </div>
        <p class="est__brecha"><span class="est__veredicto"></span><span class="est__detalle"></span></p>`;
      const cajas = comp.querySelectorAll('.est__dosnum > div');
      cajas[0].querySelector('.est__rot').textContent = t.yours;
      cajas[0].querySelector('.est__gran').textContent = String(v);
      cajas[1].querySelector('.est__rot').textContent = t.real;
      cajas[1].querySelector('.est__gran').textContent = String(p.real);
      comp.querySelector('.est__veredicto').textContent =
        dif <= 5 ? 'Muy cerca.' : `Te alejaste ${dif} años.`;
      comp.querySelector('.est__detalle').textContent =
        dif <= 5 ? 'Casi nadie lo ubica bien.' : v > p.real ? p.alto : p.bajo;
    } else {
      const dif = Math.abs(v - p.real);
      comp.innerHTML = `
        <div class="est__fila" data-quien="vos">
          <p class="est__rot"></p>
          <div class="est__barra"><div class="est__relleno"></div><span class="est__val"></span></div>
        </div>
        <div class="est__fila" data-quien="real">
          <p class="est__rot"></p>
          <div class="est__barra"><div class="est__relleno"></div><span class="est__val"></span></div>
        </div>
        <p class="est__brecha"><span class="est__veredicto"></span><span class="est__detalle"></span></p>`;
      const filas = comp.querySelectorAll('.est__fila');
      filas[0].querySelector('.est__rot').textContent = t.yours;
      filas[1].querySelector('.est__rot').textContent = t.real;
      filas[0].querySelector('.est__val').textContent = String(v);
      filas[1].querySelector('.est__val').textContent = String(p.real);
      comp.querySelector('.est__veredicto').textContent =
        dif <= 3 ? 'Acertaste.' : `Te alejaste ${dif} puntos.`;
      comp.querySelector('.est__detalle').textContent =
        dif <= 3 ? 'Sos de los pocos.' : v > p.real ? p.alto : p.bajo;

      // Un dato de 2 sobre 100 sin ancho minimo no se ve: queda una barra vacia
      // al lado de un numero, y parece un error de dibujo.
      const anchos = [v, Math.max(p.real, 0.8)];
      gsap.delayedCall(0.12, () => {
        filas.forEach((fila, i) => {
          fila.querySelector('.est__relleno').style.width = `${anchos[i]}%`;
          fila.querySelector('.est__val').style.setProperty('--x', `${anchos[i]}%`);
        });
      });
    }

    gsap.fromTo(comp, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    this.#set('fuente', p.fuente);

    const btn = this.el.querySelector('[data-act="avanzar"]');
    btn.textContent = this.#index === this.#data.preguntas.length - 1 ? t.last : t.next;
    btn.dataset.modo = 'seguir';
  }

  #avanzar() {
    const btn = this.el.querySelector('[data-act="avanzar"]');
    if (btn.dataset.modo === 'confirmar') return this.#confirmar();
    if (this.#index < this.#data.preguntas.length - 1) return this.#ask(this.#index + 1);
    this.#final();
  }

  #final() {
    const ul = this.el.querySelector('[data-slot="resumen"]');
    ul.replaceChildren();
    for (const r of this.#respuestas) {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = `${r.tuyo} → ${r.corto}`;
      li.querySelector('span').textContent = r.enunciado;
      ul.append(li);
    }
    for (const li of this.el.querySelectorAll('.est__steps li')) li.dataset.done = 'true';
    this.#showScene('fin');
  }

  #reiniciar() {
    this.#respuestas = [];
    this.#ask(0);
  }
}
