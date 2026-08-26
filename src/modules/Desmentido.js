import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/** Columnas de la grilla. */
const COLS = 20;

/**
 * Desmentido: la misma grilla, girada hacia los dos lados.
 *
 * Hacia un lado se enciende la mentira y no para hasta llenar las trescientas
 * veinte figuras. Hacia el otro se enciende el desmentido y se frena a las
 * dieciocho. El paso de giro es el mismo para los dos: la asimetria no esta en
 * el esfuerzo, esta en hasta donde llega cada uno.
 *
 * La parte que hace el trabajo es la que no pasa nada: se sigue girando hacia
 * el desmentido y la grilla ya no avanza. El objeto se queda sin recorrido
 * antes que la pantalla, y eso se siente en la mano.
 *
 * Las cifras del caso son un ejemplo; la proporcion no. Sale del estudio de
 * Vosoughi, Roy y Aral publicado en Science en 2018, y la pieza lo cita.
 */
export class Desmentido {
  #data;
  #onExit;
  #rotary = new Rotary();
  /** Figuras encendidas. Negativo es desmentido, positivo es mentira. */
  #pos = 0;
  #figuras = [];
  #tope = { mentira: 0, desmentido: 0 };

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    const f = data.porFigura;
    this.#tope = {
      mentira: Math.round(data.lados.mentira.techo / f),
      desmentido: Math.round(data.lados.desmentido.techo / f),
    };
    this.el = this.#build();
    this.#empezar();
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'girar') return;
    this.#rotary.feed(rotation, 20, (direction) => {
      // Un paso vale una fraccion del recorrido del lado hacia donde se va, no
      // una cantidad fija de figuras: asi los dos topes se alcanzan con la
      // misma vuelta. Lo que cambia no es cuanto hay que girar, es cuanta
      // gente se enciende.
      const hacia = this.#pos + direction > 0 ? 'mentira' : 'desmentido';
      const paso = Math.max(1, Math.round(this.#tope[hacia] / this.#data.pasos));
      this.#mover(this.#pos + direction * paso);
    });
  }

  /** @param {number} n */
  #num(n) {
    return n.toLocaleString('es-AR');
  }

  #build() {
    const t = this.#data.ui;
    const total = this.#tope.mentira;
    const root = document.createElement('div');
    root.className = 'des';
    root.dataset.scene = 'intro';
    root.dataset.lado = 'centro';
    root.innerHTML = `
      <section class="des__scene" data-scene="girar">
        <div class="des__col">
          <div class="des__lados">
            <button class="des__lado" data-lado="desmentido">
              <span class="des__flecha">‹</span>
              <span>${this.#data.lados.desmentido.rot}</span>
            </button>
            <div class="des__barra"><i data-slot="aguja"></i></div>
            <button class="des__lado" data-lado="mentira">
              <span>${this.#data.lados.mentira.rot}</span>
              <span class="des__flecha">›</span>
            </button>
          </div>

          <p class="des__rest" data-slot="rest">${t.rest}</p>
          <div class="des__dicho" data-slot="dicho">
            <p class="des__tit" data-slot="titulo"></p>
            <p class="des__nota" data-slot="nota"></p>
            <p class="des__remate" data-slot="remate"></p>
          </div>
        </div>

        <div class="des__gente">
          <p class="des__cuenta">
            <span class="des__cifra" data-slot="cifra">0</span>
            <span class="des__unidad">${t.reach}</span>
          </p>
          ${this.#grilla(total)}
          <p class="des__escala">${t.scale}</p>
        </div>

        <div class="des__foot">
          <button class="des__btn des__btn--go" data-act="fin">${t.end}</button>
        </div>
      </section>

      <section class="des__scene" data-scene="fin">
        <div>
          <p class="des__k">${this.#data.closing.label}</p>
          <p class="des__close">${this.#data.closing.text}</p>
          <p class="des__close2">${this.#data.closing.sub}</p>
        </div>
        <div class="des__fuente">
          <p class="des__k">${this.#data.fuente.label}</p>
          <p class="des__ftext">${this.#data.fuente.text}</p>
          <p class="des__cita">${this.#data.fuente.cita}</p>
          <button class="des__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const lado = target.closest('.des__lado');
      if (lado) {
        const l = lado.dataset.lado;
        return this.#mover(l === 'mentira' ? this.#tope.mentira : -this.#tope.desmentido);
      }
      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'fin') this.#showScene('fin');
      else if (act === 'again') this.#empezar();
    });

    this.#figuras = [...root.querySelectorAll('.des__fig')];
    return root;
  }

  /** @param {number} total */
  #grilla(total) {
    const w = 13;
    const h = 21;
    const gapX = 6;
    const gapY = 7;
    const rows = Math.ceil(total / COLS);
    const usos = [];
    for (let i = 0; i < total; i += 1) {
      const x = (i % COLS) * (w + gapX);
      const y = Math.floor(i / COLS) * (h + gapY);
      usos.push(
        `<use class="des__fig" href="#des-fig" x="${x}" y="${y}" width="${w}" height="${h}"/>`,
      );
    }
    return `
      <svg class="des__grid" viewBox="0 0 ${COLS * (w + gapX) - gapX} ${rows * (h + gapY) - gapY}" aria-hidden="true">
        <defs>
          <symbol id="des-fig" viewBox="0 0 13 21">
            <circle cx="6.5" cy="3.2" r="2.9"/>
            <rect x="2.7" y="6.8" width="7.6" height="7.8" rx="3.3"/>
            <rect x="3.8" y="13" width="2.1" height="7.6" rx="1.05"/>
            <rect x="7.1" y="13" width="2.1" height="7.6" rx="1.05"/>
          </symbol>
        </defs>
        ${usos.join('')}
      </svg>`;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.des__scene')];
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
  }

  #empezar() {
    this.#pos = 0;
    this.#rotary.reset();
    for (const f of this.#figuras) f.dataset.on = 'false';
    this.#pintar();
    this.#showScene('girar');
  }

  /** @param {number} next */
  #mover(next) {
    const limitado = Math.max(-this.#tope.desmentido, Math.min(this.#tope.mentira, next));
    const topeado = limitado !== next;
    if (limitado === this.#pos && !topeado) return;
    this.#pos = limitado;
    this.#pintar(topeado);
  }

  /** @param {boolean} [topeado] */
  #pintar(topeado = false) {
    const abs = Math.abs(this.#pos);
    const lado = this.#pos === 0 ? null : this.#pos > 0 ? 'mentira' : 'desmentido';
    this.el.dataset.lado = lado ?? 'centro';

    for (const b of this.el.querySelectorAll('.des__lado')) {
      b.dataset.on = String(b.dataset.lado === lado);
    }

    const rango = lado === 'desmentido' ? this.#tope.desmentido : this.#tope.mentira;
    const aguja = this.el.querySelector('[data-slot="aguja"]');
    const t = this.#pos >= 0 ? this.#pos / this.#tope.mentira : this.#pos / this.#tope.desmentido;
    aguja.style.left = `${((t + 1) / 2) * 100}%`;

    this.#figuras.forEach((f, i) => {
      f.dataset.on = String(i < abs);
    });

    this.el.querySelector('[data-slot="rest"]').dataset.on = String(lado === null);
    const dicho = this.el.querySelector('[data-slot="dicho"]');
    dicho.dataset.on = String(lado !== null);

    if (lado) {
      const l = this.#data.lados[lado];
      this.#set('titulo', l.titulo);
      this.#set('nota', l.nota);
      // El remate aparece cuando la grilla llego a su tope. Es redundante a
      // proposito: cierra la idea sin que haga falta un guia al lado.
      const remate = this.el.querySelector('[data-slot="remate"]');
      const enTope = abs >= rango;
      remate.textContent = enTope ? l.remate : '';
      remate.dataset.on = String(enTope);

    }

    this.#contarHasta(abs * this.#data.porFigura);
  }

  /** @param {number} valor */
  #contarHasta(valor) {
    const el = this.el.querySelector('[data-slot="cifra"]');
    const obj = { v: Number.parseInt(el.textContent.replace(/\D/g, ''), 10) || 0 };
    gsap.to(obj, {
      v: valor,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = this.#num(Math.round(obj.v));
      },
    });
  }
}
