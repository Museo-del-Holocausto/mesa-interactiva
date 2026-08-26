import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';
import { MODULE_CANVAS_W } from '@/config/table.js';

/** Pasos de giro hasta llegar a un extremo. */
const TOPE = 2;

/**
 * Contradicciones: seis pares de acusaciones opuestas sobre las mismas personas.
 *
 * El objeto tiene la forma del problema. Un dial gira para los dos lados y una
 * contradiccion tiene dos extremos: se gira a la izquierda y aparece una
 * acusacion, se gira a la derecha y aparece la contraria. Es el mismo objeto,
 * en el mismo lugar, dando respuestas opuestas.
 *
 * Recien cuando el visitante estuvo en los dos extremos aparece la pregunta.
 * Antes no: la contradiccion tiene que haberla producido el, no leerla.
 *
 * El par se elige apoyando el marcador en un circulo, no deslizando por un
 * riel. Con riel esta pieza y la linea de tiempo del mismo eje se veian
 * iguales, y una es una cronologia y la otra son seis casos sueltos. Apoyar
 * para elegir el tema y girar para ver las dos caras: dos gestos, dos piezas
 * distintas.
 */
export class Contradicciones {
  /** Aca el marcador sobre el contenido no estorba: es el gesto de la pieza. */
  aceptaMarcadorEncima = true;

  #data;
  #onExit;
  #rotary = new Rotary();
  #index = -1;
  /** -TOPE..TOPE. El signo es el lado; el valor absoluto, cuanto se giro. */
  #pos = 0;
  /** Extremos ya visitados en el par actual. */
  #vistos = new Set();
  #respondido = false;

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.el = this.#build();
    this.#select(0, true);
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /**
   * Apoyar el marcador adentro de un circulo elige el par. Se compara contra el
   * centro de cada uno, los dos medidos desde el mismo origen: el cuadrante.
   */
  applyPosition(x, y) {
    const canvas = this.el.closest('.modulo__canvas');
    const region = this.el.closest('.quadrant') ?? canvas;
    if (!canvas || !region) return;
    const escala = canvas.getBoundingClientRect().width / MODULE_CANVAS_W;
    if (!escala) return;
    const origen = region.getBoundingClientRect();

    for (const circulo of this.el.querySelectorAll('.con__zona')) {
      const r = circulo.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - origen.left) / escala;
      const cy = (r.top + r.height / 2 - origen.top) / escala;
      const radio = r.width / escala / 2 + 50;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radio ** 2) {
        this.#select(Number.parseInt(circulo.dataset.index, 10));
        return;
      }
    }
  }

  /** Girar: la aguja se corre hacia un lado o hacia el otro. */
  applyRotation(rotation) {
    this.#rotary.feed(rotation, 18, (direction) => {
      this.#mover(this.#pos + direction);
    });
  }

  get #par() {
    return this.#data.pares[this.#index];
  }

  #build() {
    const t = this.#data.ui;
    const n = this.#data.pares.length;
    const root = document.createElement('div');
    root.className = 'con';
    root.innerHTML = `
      <div class="con__zonas">
        ${this.#data.pares
          .map(
            (p, i) => `
          <button class="con__zona" data-index="${i}" type="button">
            <span class="con__anillo"></span>
            <span class="con__zrot">${p.eje}</span>
          </button>`,
          )
          .join('')}
      </div>
      <p class="con__hint">${t.hint}</p>

      <article class="con__card">
        <p class="con__eje" data-slot="eje"></p>

        <div class="con__aguja">
          <button class="con__lado" data-lado="a" data-act="ir-a">
            <span class="con__flecha">‹</span>
            <span class="con__lado-tx" data-slot="rot-a"></span>
          </button>
          <div class="con__barra"><i data-slot="aguja"></i></div>
          <button class="con__lado" data-lado="b" data-act="ir-b">
            <span class="con__lado-tx" data-slot="rot-b"></span>
            <span class="con__flecha">›</span>
          </button>
        </div>

        <div class="con__dicho" data-slot="dicho">
          <p class="con__frase" data-slot="frase"></p>
          <p class="con__cuando" data-slot="cuando"></p>
          <p class="con__quien" data-slot="quien"></p>
          <p class="con__choque" data-slot="choque"></p>
        </div>

        <p class="con__espera" data-slot="espera">${t.spin}</p>

        <div class="con__pregunta" data-slot="pregunta">
          <p class="con__ask">${t.ask}</p>
          <div class="con__ops">
            <button class="con__op" data-resp="si">${t.yes}</button>
            <button class="con__op" data-resp="no">${t.no}</button>
          </div>
        </div>

        <div class="con__cara" data-slot="cara">
          <div class="con__cara-col">
            <p class="con__cara-frase" data-slot="cara-a"></p>
            <p class="con__cara-cuando" data-slot="cara-a-cuando"></p>
          </div>
          <div class="con__cara-vs">×</div>
          <div class="con__cara-col">
            <p class="con__cara-frase" data-slot="cara-b"></p>
            <p class="con__cara-cuando" data-slot="cara-b-cuando"></p>
          </div>
        </div>

        <p class="con__cierre" data-slot="cierre"></p>
      </article>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(event.target instanceof Element)) return;

      const zona = target.closest('.con__zona');
      if (zona?.dataset.index) {
        event.stopPropagation();
        this.#select(Number.parseInt(zona.dataset.index, 10));
        return;
      }
      const lado = target.closest('.con__lado');
      if (lado) {
        event.stopPropagation();
        this.#mover(lado.dataset.lado === 'a' ? -TOPE : TOPE);
        return;
      }
      const op = target.closest('[data-resp]');
      if (op) {
        event.stopPropagation();
        this.#responder();
      }
    });

    return root;
  }

  /** @param {string} slot @param {string} value */
  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = value ?? '';
  }

  /** @param {number} index @param {boolean} [immediate] */
  #select(index, immediate = false) {
    if (index === this.#index) return;
    this.#index = index;
    this.#pos = 0;
    this.#vistos = new Set();
    this.#respondido = false;
    this.#rotary.reset();

    const p = this.#par;
    // El objeto se apoya sobre el circulo elegido y lo tapa: el nombre del par
    // se repite acá abajo, donde la mano no llega.
    this.#set('eje', p.eje);
    this.#set('rot-a', p.a.corto);
    this.#set('rot-b', p.b.corto);
    this.#set('cara-a', p.a.frase);
    this.#set('cara-a-cuando', p.a.cuando);
    this.#set('cara-b', p.b.frase);
    this.#set('cara-b-cuando', p.b.cuando);
    this.#set('cierre', p.cierre);

    for (const zona of this.el.querySelectorAll('.con__zona')) {
      zona.dataset.on = String(Number(zona.dataset.index) === index);
    }

    this.#pintar(immediate);
    if (!immediate) {
      gsap.fromTo(
        this.el.querySelector('.con__card'),
        { opacity: 0.35, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true },
      );
    }
  }

  /** @param {number} next */
  #mover(next) {
    const antes = this.#pos;
    this.#pos = Math.max(-TOPE, Math.min(TOPE, next));
    if (this.#pos === antes) return;
    if (this.#pos === -TOPE) this.#vistos.add('a');
    if (this.#pos === TOPE) this.#vistos.add('b');
    this.#pintar();
  }

  /** @param {boolean} [immediate] */
  #pintar(immediate = false) {
    const p = this.#par;
    const card = this.el.querySelector('.con__card');
    const lado = this.#pos <= -TOPE ? 'a' : this.#pos >= TOPE ? 'b' : null;

    // La aguja: -1 a la izquierda, 1 a la derecha.
    const aguja = this.el.querySelector('[data-slot="aguja"]');
    aguja.style.left = `${((this.#pos / TOPE + 1) / 2) * 100}%`;
    card.dataset.polo = lado ?? 'medio';

    for (const b of this.el.querySelectorAll('.con__lado')) {
      b.dataset.on = String(b.dataset.lado === lado);
      b.dataset.visto = String(this.#vistos.has(b.dataset.lado));
    }

    const dicho = this.el.querySelector('[data-slot="dicho"]');
    if (lado) {
      this.#set('frase', p[lado].frase);
      this.#set('cuando', p[lado].cuando);
      this.#set('quien', p[lado].nota);
      // La contradicción se lee en el mismo momento en que se llega al polo.
      // Guardada para el final, el visitante ya se había ido con el dato suelto.
      this.#set('choque', p[lado].choque);
      dicho.dataset.on = 'true';
      if (!immediate) {
        gsap.fromTo(dicho, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
      }
    } else {
      dicho.dataset.on = 'false';
    }

    // La pregunta recien cuando el visitante estuvo en los dos extremos: la
    // contradiccion tiene que haberla producido el, no leerla.
    const completo = this.#vistos.size === 2;
    this.el.querySelector('[data-slot="espera"]').dataset.on = String(!lado && !completo);
    this.el.querySelector('[data-slot="pregunta"]').dataset.on = String(
      completo && !this.#respondido,
    );
    this.el.querySelector('[data-slot="cara"]').dataset.on = String(this.#respondido);
    this.el.querySelector('[data-slot="cierre"]').dataset.on = String(this.#respondido);
  }

  /** Se conteste lo que se conteste, las dos quedan a la vista con sus fechas. */
  #responder() {
    this.#respondido = true;
    this.#pintar();
    gsap.fromTo(
      this.el.querySelector('[data-slot="cara"]'),
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' },
    );
    gsap.fromTo(
      this.el.querySelector('[data-slot="cierre"]'),
      { opacity: 0 },
      { opacity: 1, duration: 0.5, delay: 0.3 },
    );
  }
}
