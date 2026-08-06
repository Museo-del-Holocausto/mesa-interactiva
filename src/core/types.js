/**
 * Tipos del proyecto, en JSDoc. No hay codigo acá: el archivo existe para que
 * el editor entienda las formas de dato sin meter TypeScript en el build.
 */

/**
 * Un marcador, en coordenadas de mesa (0..3840 x 0..2160).
 * Es la unica forma de dato que la UI conoce. Tanto el simulador como
 * Tangible Engine escriben marcadores con esta forma exacta.
 *
 * @typedef {Object} Marker
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} rotation  Grados, continuo y acumulativo. No se normaliza a 0..360.
 * @property {'simulated'|'tangible'} source
 * @property {number} lastSeen
 */

/**
 * @typedef {Object} MarkerFrame
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} rotation
 */

/**
 * @typedef {Object} Region
 * @property {number} index
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {0|180} orientation
 */

/**
 * @typedef {Object} Axis
 * @property {string} id
 * @property {string} number
 * @property {'explorar'|'recorrer'|'decidir'|'mixto'} mode
 * @property {string} title
 * @property {string} subtitle
 * @property {string} volume
 */

export {};
