import { Fabricar } from '@/modules/Fabricar.js';
import { LineaTiempo } from '@/modules/LineaTiempo.js';
import eje3 from '@/content/es/eje3.json';

/**
 * Eje 3. Dos secciones adentro del mismo eje.
 *
 * La navegacion entre las dos es por toque, con los dos rotulos arriba a la
 * derecha: el marcador fisico queda reservado para el menu de ejes.
 * Adentro del eje la rosca no hace nada.
 */
export class Eje3 {
  #onExit;
  #current = null;
  #section = null;

  /** @param {() => void} onExit */
  constructor(onExit) {
    this.#onExit = onExit;
    this.el = document.createElement('div');
    this.el.className = 'modulo';
    this.el.innerHTML = `
      <p class="modulo__eyebrow">Eje 3 · Mitos antisemitas</p>
      <nav class="modulo__tabs">
        <button class="modulo__tab" type="button" data-section="fabricar">${eje3.fabricar.title}</button>
        <button class="modulo__tab" type="button" data-section="linea">${eje3.linea.title}</button>
      </nav>
      <div class="modulo__body"></div>
      <button class="modulo__back" type="button">Volver al menú</button>`;

    this.body = this.el.querySelector('.modulo__body');
    this.el.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.modulo__back')) {
        event.stopPropagation();
        this.#onExit();
        return;
      }
      const tab = event.target.closest('[data-section]');
      if (!tab) return;
      event.stopPropagation();
      this.show(tab.dataset.section);
    });

    this.show('fabricar');
  }

  /** @param {'fabricar'|'linea'} section */
  show(section) {
    if (this.#section === section) return;
    this.#section = section;
    this.#current?.destroy();
    this.#current =
      section === 'fabricar'
        ? new Fabricar(eje3.fabricar, this.#onExit)
        : new LineaTiempo(eje3.linea);
    this.body.replaceChildren(this.#current.el);
    for (const tab of this.el.querySelectorAll('[data-section]')) {
      tab.dataset.on = String(tab.dataset.section === section);
    }
  }

  destroy() {
    this.#current?.destroy();
    this.el.remove();
  }
}

/** Registro de modulos por eje. Los que faltan todavia no tienen pieza propia. */
export const MODULES = {
  'eje-3': Eje3,
};
