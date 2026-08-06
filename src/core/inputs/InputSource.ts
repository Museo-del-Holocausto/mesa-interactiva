/**
 * Contrato que cumplen tanto el simulador como el cliente de Tangible Engine.
 * Ambos escriben en el MarkerStore; nadie mas lo hace.
 */
export interface InputSource {
  start(): void;
  stop(): void;
}
