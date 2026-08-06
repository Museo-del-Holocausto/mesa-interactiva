export type MarkerId = number;

/**
 * Un marcador, en coordenadas de mesa (0..3840 x 0..2160).
 * Esta es la unica forma de dato que la UI conoce. Tanto el simulador
 * como Tangible Engine escriben marcadores con esta forma exacta.
 */
export interface Marker {
  id: MarkerId;
  x: number;
  y: number;
  /** Grados, continuo y acumulativo. No se normaliza a 0..360. */
  rotation: number;
  /** Origen del dato. La UI no deberia usarlo salvo para el ghost de debug. */
  source: 'simulated' | 'tangible';
  lastSeen: number;
}

/** Payload que envia una fuente de entrada. */
export interface MarkerFrame {
  id: MarkerId;
  x: number;
  y: number;
  rotation: number;
}

export interface Region {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 0 | 180;
}

export type LayoutMode = 'quadrants' | 'guide';

export type AxisMode = 'explorar' | 'recorrer' | 'decidir' | 'mixto';

export interface Axis {
  id: string;
  number: string;
  mode: AxisMode;
  title: string;
  subtitle: string;
  volume: string;
}

export interface ContentBundle {
  ui: Record<string, string>;
  modes: Record<AxisMode, string>;
  axes: Axis[];
}
