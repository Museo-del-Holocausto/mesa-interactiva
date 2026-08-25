import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';
import { MODULE_CANVAS_W } from '@/config/table.js';

/**
 * Contenedores: apoyar el marcador adentro de un circulo abre lo que ese
 * circulo contiene, y girarlo ahi adentro recorre sus items.
 *
 * Es el unico lugar del pliego donde el objeto se posa en vez de deslizarse o
 * girar sobre un riel. La posicion deja de ser un valor continuo y pasa a ser
 * una pertenencia: estas adentro o no estas.
 *
 * El circulo dibujado es del tamano fisico del marcador, asi que el objeto
 * entra justo. La zona sensible es un poco mas grande: apoyar un objeto a mano
 * no tiene la precision de un click.
 *
 * Todo funciona igual con el dedo. En un cuadrante el marcador puede no llegar
 * a los tres circulos, y la pieza no puede depender de eso.
 */
export class Contenedores {
  /** Acá el marcador sobre el contenido no estorba: es el gesto de la pieza. */
  aceptaMarcadorEncima = true;

  #data;
  #onExit;
  #rotary = new Rotary();
  #activo = null;
  #indices = {};

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    for (const c of data.contenedores) this.#indices[c.id] = 0;
    this.el = this.#build();
    this.#pintar();
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  /**
   * Se compara el punto del marcador contra el centro de cada circulo, los dos
   * medidos desde el mismo origen.
   *
   * El origen es el cuadrante, no el lienzo. La posicion que llega ya viene
   * dividida por la escala pero referida al cuadrante, asi que medir los
   * circulos contra el lienzo desplazaba el punto de contacto tanto como
   * distancia hubiera entre uno y otro.
   */
  applyPosition(x, y) {
    const canvas = this.el.closest('.modulo__canvas');
    const region = this.el.closest('.quadrant') ?? canvas;
    if (!canvas || !region) return;
    const escala = canvas.getBoundingClientRect().width / MODULE_CANVAS_W;
    if (!escala) return;
    const origen = region.getBoundingClientRect();

    let encontrado = null;
    for (const circulo of this.el.querySelectorAll('.con2__circulo')) {
      const r = circulo.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - origen.left) / escala;
      const cy = (r.top + r.height / 2 - origen.top) / escala;
      // Radio generoso: apoyar un objeto a mano no tiene la precision de un
      // click, y quedar afuera por veinte pixeles se siente roto.
      const radio = r.width / escala / 2 + 60;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radio ** 2) {
        encontrado = circulo.dataset.id;
        break;
      }
    }
    this.#activar(encontrado);
  }

  /** Girar recorre los items del contenedor donde esta apoyado el marcador. */
  applyRotation(rotation) {
    if (!this.#activo) return;
    const items = this.#contenedor(this.#activo).items;
    this.#rotary.feed(rotation, 40, (direction) => {
      const n = items.length;
      this.#indices[this.#activo] = (this.#indices[this.#activo] + direction + n) % n;
      this.#pintar();
    });
  }

  /** @param {string} id */
  #contenedor(id) {
    return this.#data.contenedores.find((c) => c.id === id);
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'con2';
    root.innerHTML = `
      <div class="con2__top">
        <h1 class="con2__h1">${this.#data.title}</h1>
        <p class="con2__lead">${this.#data.lead}</p>
      </div>

      <div class="con2__zonas">
        ${this.#data.contenedores
          .map(
            (c) => `
          <button class="con2__circulo" data-id="${c.id}" type="button">
            <span class="con2__anillo"></span>
            <span class="con2__rot">${c.rot}</span>
            <span class="con2__sub">${c.sub}</span>
          </button>`,
          )
          .join('')}
      </div>

      <div class="con2__panel">
        <p class="con2__reposo" data-slot="reposo">${this.#data.intro}</p>
        <p class="con2__ayuda" data-slot="ayuda">${t.rest}</p>

        <div class="con2__abierto" data-slot="abierto">
          <p class="con2__encab" data-slot="encabezado"></p>
          <p class="con2__cifra" data-slot="cifra"></p>
          <p class="con2__titulo" data-slot="titulo"></p>
          <p class="con2__texto" data-slot="texto"></p>
          <div class="con2__pie">
            <ol class="con2__pasos" data-slot="pasos"></ol>
            <p class="con2__spin">${t.spin}</p>
          </div>
        </div>
      </div>

      <p class="con2__cierre">${this.#data.cierre}</p>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const circulo = target.closest('.con2__circulo');
      if (!circulo) return;
      event.stopPropagation();
      // Tocar el circulo ya abierto lo cierra: sin marcador hace falta una
      // manera de salir.
      this.#activar(this.#activo === circulo.dataset.id ? null : circulo.dataset.id);
    });

    return root;
  }

  /** @param {string|null} id */
  #activar(id) {
    if (id === this.#activo) return;
    this.#activo = id;
    this.#rotary.reset();
    this.#pintar();
    if (id) {
      gsap.fromTo(
        this.el.querySelector('[data-slot="abierto"]'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      );
    }
  }

  /** @param {string} slot @param {string} value */
  #set(slot, value) {
    const el = this.el.querySelector(`[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = value ?? '';
    el.hidden = !value;
  }

  #pintar() {
    const abierto = Boolean(this.#activo);
    this.el.dataset.abierto = String(abierto);

    for (const c of this.el.querySelectorAll('.con2__circulo')) {
      c.dataset.on = String(c.dataset.id === this.#activo);
    }

    this.el.querySelector('[data-slot="reposo"]').hidden = abierto;
    this.el.querySelector('[data-slot="ayuda"]').hidden = abierto;
    this.el.querySelector('[data-slot="abierto"]').hidden = !abierto;
    if (!abierto) return;

    const c = this.#contenedor(this.#activo);
    const i = this.#indices[this.#activo];
    const item = c.items[i];

    this.#set('encabezado', c.encabezado ?? '');
    this.#set('cifra', item.cifra ?? '');
    this.#set('titulo', item.titulo ?? '');
    this.#set('texto', item.texto ?? '');

    const pasos = this.el.querySelector('[data-slot="pasos"]');
    pasos.replaceChildren();
    c.items.forEach((_, k) => {
      const li = document.createElement('li');
      li.dataset.on = String(k === i);
      pasos.append(li);
    });
  }
}
