import { MARKER_MIN_DISTANCE, SAFE_RADIUS } from '@/config/table';
import type { Marker, Region } from '@/core/types';

export type ProximityIssue = 'none' | 'edge' | 'neighbour';

export interface ProximityResult {
  issue: ProximityIssue;
  /** Direccion hacia la que conviene mover el marcador, en coordenadas de mesa. */
  pushX: number;
  pushY: number;
}

/**
 * El aviso no es decorativo: si el marcador se arrima mas que SAFE_RADIUS a un borde,
 * la corona no entra en el cuadrante y se mete en el del vecino.
 */
export function evaluateProximity(
  marker: Marker,
  region: Region,
  others: Marker[],
): ProximityResult {
  const left = marker.x - region.x;
  const right = region.x + region.w - marker.x;
  const top = marker.y - region.y;
  const bottom = region.y + region.h - marker.y;

  const clearance = Math.min(left, right, top, bottom);

  if (clearance < SAFE_RADIUS) {
    let pushX = 0;
    let pushY = 0;
    if (left === clearance) pushX = 1;
    else if (right === clearance) pushX = -1;
    else if (top === clearance) pushY = 1;
    else pushY = -1;
    return { issue: 'edge', pushX, pushY };
  }

  for (const other of others) {
    if (other.id === marker.id) continue;
    const dx = marker.x - other.x;
    const dy = marker.y - other.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MARKER_MIN_DISTANCE && distance > 0) {
      return { issue: 'neighbour', pushX: dx / distance, pushY: dy / distance };
    }
  }

  return { issue: 'none', pushX: 0, pushY: 0 };
}
