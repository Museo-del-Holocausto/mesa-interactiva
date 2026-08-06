import type { InputSource } from '@/core/inputs/InputSource';
import type { MarkerStore } from '@/core/MarkerStore';
import type { MarkerFrame } from '@/core/types';

/**
 * Cliente del relay de Tangible Engine. Todavia no esta conectado.
 *
 * Arquitectura prevista: TE 3.1 corre como servicio de Windows y habla TCP.
 * Un relay local en Node traduce ese TCP a WebSocket y este cliente lo consume.
 * Pendiente de confirmar con soporte de Ideum si los bindings de Node pueden
 * registrar puntos de contacto sin DOM.
 *
 * Nota critica de coordenadas: TE reporta en pixeles de dispositivo.
 * Este cliente ya recibe px de mesa; el escalado CSS -> dispositivo se resuelve
 * en el relay, y el escalado de Windows tiene que estar fijo en 100%.
 */
export class TangibleInput implements InputSource {
  private store: MarkerStore;
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  constructor(store: MarkerStore, url = 'ws://127.0.0.1:8787') {
    this.store = store;
    this.url = url;
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('message', (event) => {
      try {
        const frames = JSON.parse(String(event.data)) as MarkerFrame[];
        for (const frame of frames) this.store.upsert(frame, 'tangible');
      } catch {
        // Frame malformado: se descarta. El sweep del store da de baja lo que no llega.
      }
    });

    socket.addEventListener('close', () => {
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1000);
    });

    socket.addEventListener('error', () => socket.close());
  }
}
