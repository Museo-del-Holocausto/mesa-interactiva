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
export class TangibleInput {
  #socket = null;
  #reconnectTimer = null;

  /**
   * @param {import('@/core/MarkerStore.js').MarkerStore} store
   * @param {string} [url]
   */
  constructor(store, url = 'ws://127.0.0.1:8787') {
    this.store = store;
    this.url = url;
  }

  start() {
    this.#connect();
  }

  stop() {
    if (this.#reconnectTimer !== null) window.clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#socket?.close();
    this.#socket = null;
  }

  #connect() {
    const socket = new WebSocket(this.url);
    this.#socket = socket;

    socket.addEventListener('message', (event) => {
      try {
        const frames = JSON.parse(String(event.data));
        for (const frame of frames) this.store.upsert(frame, 'tangible');
      } catch {
        // Frame malformado: se descarta. El sweep del store da de baja lo que no llega.
      }
    });

    socket.addEventListener('close', () => {
      this.#reconnectTimer = window.setTimeout(() => this.#connect(), 1000);
    });

    socket.addEventListener('error', () => socket.close());
  }
}
