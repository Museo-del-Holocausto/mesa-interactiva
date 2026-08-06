/**
 * Geometria de la mesa. Todas las medidas en pixeles de mesa (1 px = 1 px de 4K).
 * Nada de esto se recalcula en runtime: el escalado lo resuelve Stage por transform.
 */

/** Panel 3M PCAP 65" a 3840x2160. */
export const TABLE_W = 3840;
export const TABLE_H = 2160;

/** Area activa del panel, en mm. Sirve para convertir px <-> mm reales. */
export const TABLE_MM_W = 1440;
export const PX_PER_MM = TABLE_W / TABLE_MM_W; // 2.667 px/mm

/** @param {number} v @returns {number} */
export const mm = (v) => v * PX_PER_MM;

/** Cuadrantes fijos: 4 de 1920x1080. */
export const QUADRANT_W = TABLE_W / 2;
export const QUADRANT_H = TABLE_H / 2;

/**
 * Los usuarios se paran de a dos por lado.
 * Los cuadrantes de la mitad superior se leen desde el borde de arriba: van rotados 180.
 * @type {readonly import('@/core/types.js').Region[]}
 */
export const QUADRANTS = [
  { index: 0, x: 0, y: 0, w: QUADRANT_W, h: QUADRANT_H, orientation: 180 },
  { index: 1, x: QUADRANT_W, y: 0, w: QUADRANT_W, h: QUADRANT_H, orientation: 180 },
  { index: 2, x: 0, y: QUADRANT_H, w: QUADRANT_W, h: QUADRANT_H, orientation: 0 },
  { index: 3, x: QUADRANT_W, y: QUADRANT_H, w: QUADRANT_W, h: QUADRANT_H, orientation: 0 },
];

/** Modo guia: una sola region que ocupa la mesa entera, legible desde el frente. */
export const GUIDE_REGION = {
  index: -1,
  x: 0,
  y: 0,
  w: TABLE_W,
  h: TABLE_H,
  orientation: 0,
};

/**
 * Marcador fisico. Diametro sin confirmar con proveedor: 110 mm es el supuesto de trabajo.
 * Toda la geometria de la corona depende de este numero.
 */
export const MARKER_DIAMETER_MM = 110;
export const MARKER_RADIUS = mm(MARKER_DIAMETER_MM) / 2; // ~147 px

/**
 * Corona: orbita de nueve puntos alrededor del marcador.
 * El radio esta atado al tamano fisico del objeto, asi que no escala con el modo:
 * en modo guia el marcador sigue midiendo lo mismo.
 */
export const CORONA_R = MARKER_RADIUS + 72;
export const CORONA_TRACK_GAP = 52;
export const CORONA_OUTER_R = CORONA_R + CORONA_TRACK_GAP;

/**
 * Radio libre que necesita la interfaz alrededor del marcador.
 * Si el marcador se acerca a un borde mas que esto, la corona se sale del cuadrante
 * y se dispara el aviso de proximidad.
 */
export const SAFE_RADIUS = CORONA_OUTER_R + 40;

/** Separacion entre la orbita y el panel de texto. */
export const PANEL_OFFSET = CORONA_OUTER_R + 88;
export const PANEL_MIN_W = 520;
export const PANEL_EDGE_PAD = 72;

/** Distancia minima entre dos marcadores antes de avisar. */
export const MARKER_MIN_DISTANCE = SAFE_RADIUS * 2;

/** Grados de giro del marcador que equivalen a un paso de seleccion. */
export const ROTATION_STEP_DEG = 40;

/** Un marcador se considera ausente si no se lo ve durante este tiempo. */
export const MARKER_TIMEOUT_MS = 400;

/**
 * Un cuadrante no se resetea apenas desaparece el marcador. La gente no arrastra:
 * levanta el objeto y lo vuelve a apoyar. Durante este tiempo el cuadrante queda
 * dormido y recupera su estado si vuelve un marcador.
 */
export const QUADRANT_GRACE_MS = 12000;

/** Columna reservada para el marcador cuando hay una pieza montada. */
export const MARKER_COLUMN_W = 680;

/** ID reservado para el marcador del guia. Confirmar contra los IDs reales de Tangible Engine. */
export const GUIDE_MARKER_ID = 99;
