import gsap from 'gsap';

/**
 * Reglas de movimiento de toda la mesa. Un solo lugar para duraciones y curvas:
 * si algo se siente lento o brusco, se ajusta acá y cambia en todas las piezas.
 *
 * Los mismos valores viven en tokens.css (--dur-*) para las transiciones de CSS.
 *
 * Duraciones en segundos, por función y no por número:
 *   paso     cambiar un ítem dentro de la misma pantalla (siguiente frase, otro mito)
 *   escena   cambiar de pantalla dentro de una pieza (de la pregunta al resultado)
 *   giro     el menú gira hacia el ítem elegido
 *   entrada  aparece algo nuevo que hay que leer (una respuesta, una pieza entera)
 *   largo    algo que crece o cuenta, y se tiene que ver crecer (barras, cifras)
 *
 * Curvas:
 *   sale     arranca rápido y frena suave. La de casi todo.
 *   firme    igual pero frena más marcado. Para el giro del menú.
 *   lineal   sin aceleración. Para parpadeos y apariciones al azar.
 */
export const MOTION = {
  dur: {
    paso: 0.3,
    escena: 0.34,
    giro: 0.44,
    entrada: 0.5,
    largo: 0.9,
  },
  ease: {
    sale: 'power2.out',
    firme: 'power3.out',
    lineal: 'none',
  },
};

/**
 * ?lento=3 pone toda la mesa en cámara lenta (3 veces más lenta), para revisar
 * animaciones. Afecta a GSAP entero (duraciones y demoras) y a las transiciones
 * de CSS que usan --dur-*. No toca la retícula del fondo.
 */
export function aplicarLento() {
  const raw = Number.parseFloat(new URLSearchParams(window.location.search).get('lento') ?? '');
  if (!Number.isFinite(raw) || raw <= 0 || raw === 1) return;
  const lento = Math.min(10, Math.max(0.1, raw));
  gsap.globalTimeline.timeScale(1 / lento);
  document.documentElement.style.setProperty('--lento', String(lento));
}
