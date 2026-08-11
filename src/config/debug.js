/**
 * Dos banderas distintas, porque son dos cosas distintas:
 *
 *   sim    el simulador de marcadores existe (teclas, drag, rueda)
 *   debug  el andamiaje visible: ghosts, guias de cuadrante, overlay
 *
 * Para mostrar el proyecto: ?debug=0&guide=1
 * El simulador sigue andando, pero no se ve nada de desarrollo.
 *
 * Parametros:
 *   ?debug=0    apaga el andamiaje visible
 *   ?sim=0      apaga el simulador entero
 *   ?marker=3   arranca con 3 marcadores (default 1)
 *   ?guide=1    arranca en modo guia
 *   ?lang=en    fuerza idioma
 */

const params = new URLSearchParams(window.location.search);

/** @param {string} name @param {boolean} fallback @returns {boolean} */
function flag(name, fallback) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  return raw !== '0' && raw !== 'false';
}

/** @param {string} name @param {number} fallback @param {number} min @param {number} max */
/** @param {string} name @param {number} fallback @param {number} min @param {number} max */
function num(name, fallback, min, max) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {string} name @param {number} fallback @param {number} min @param {number} max */
function int(name, fallback, min, max) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const DEBUG = {
  /** El simulador de marcadores. En produccion no se compila. */
  simulator: flag('sim', import.meta.env.DEV),
  /** Ghosts, guias de cuadrante y overlay de estado. */
  chrome: flag('debug', import.meta.env.DEV),
  markerCount: int('marker', 1, 0, 4),
  guide: flag('guide', false),
  /**
   * Escala del lienzo en modo guia. Provisorio hasta verlo en la mesa real:
   * ?gscale=1.5 para probar otro valor.
   *
   * Referencia: el panel tiene 68 ppi, o sea 0.375 mm por pixel. A escala 1.0
   * el cuerpo de texto de 27 px ya mide 10 mm, contra los 6-8 mm de una cartela
   * de museo. Escala 2.0 lo lleva a 20 mm, que es tamano de titulo de sala.
   */
  guideScale: num('gscale', 1.2, 1, 2.5),
};

export const FORCED_LANG = params.get('lang');
