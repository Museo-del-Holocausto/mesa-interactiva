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

function flag(name: string, fallback: boolean): boolean {
  const raw = params.get(name);
  if (raw === null) return fallback;
  return raw !== '0' && raw !== 'false';
}

const guide = flag('guide', false);

/**
 * El simulador viene apagado en produccion, pero sin el no hay marcadores, y
 * sin marcadores no hay modo guia ni nada que mostrar. Asi que `?guide=1` y
 * `?marker=` lo encienden solos: la misma URL funciona en local y publicada.
 * `?sim=0` siempre gana, para probar la pantalla sin ningun objeto.
 */
function simulador(): boolean {
  const raw = params.get('sim');
  if (raw !== null) return raw !== '0' && raw !== 'false';
  return import.meta.env.DEV || guide || params.get('marker') !== null;
}

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const DEBUG = {
  /** El simulador de marcadores. En produccion no se compila. */
  simulator: simulador(),
  /** Ghosts, guias de cuadrante y overlay de estado. */
  chrome: flag('debug', import.meta.env.DEV),
  markerCount: int('marker', 1, 0, 4),
  guide,
} as const;

export const FORCED_LANG = params.get('lang');
