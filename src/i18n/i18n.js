import es from '@/content/es/menu.json';
import en from '@/content/en/menu.json';
import { FORCED_LANG } from '@/config/debug.js';

export const LANGS = ['es', 'en'];

/**
 * Un archivo por idioma con la misma forma, no objetos {es, en} anidados:
 * asi el contenido en espanol se edita sin ver una sola clave en ingles.
 */
const BUNDLES = { es, en };
const DEFAULT_LANG = 'es';

/** @param {string|null} candidate */
function resolve(candidate) {
  return LANGS.includes(candidate) ? candidate : DEFAULT_LANG;
}

class I18n {
  #lang = resolve(FORCED_LANG);

  get current() {
    return this.#lang;
  }

  /** @param {string} lang */
  set(lang) {
    this.#lang = resolve(lang);
    document.documentElement.lang = this.#lang;
  }

  get bundle() {
    return BUNDLES[this.#lang];
  }

  /**
   * Texto de interfaz. Devuelve la clave si falta, para que el hueco se vea.
   * @param {string} key
   */
  t(key) {
    return this.bundle.ui[key] ?? `[${key}]`;
  }
}

export const i18n = new I18n();
