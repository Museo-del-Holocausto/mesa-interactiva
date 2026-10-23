/**
 * Fotos en color o en blanco y negro, para toda la mesa.
 *
 * Cada foto está exportada dos veces: la versión en blanco y negro en
 * .../mesa/ y la de color en .../mesa/color/. Este valor elige cuál se usa.
 * ?color=1 o ?color=0 en la URL lo pisa, para comparar las dos sin tocar código.
 */
export const COLOR = false;

const COLOR_PARAM = new URLSearchParams(window.location.search).get('color');
const USAR_COLOR = COLOR_PARAM === null ? COLOR : COLOR_PARAM !== '0' && COLOR_PARAM !== 'false';

/**
 * Ruta de la foto según el modo elegido.
 * @param {string} ruta ruta a la versión en blanco y negro (.../mesa/x.jpg)
 */
export const fotoDe = (ruta) => (USAR_COLOR ? ruta.replace('/mesa/', '/mesa/color/') : ruta);

/** Pide las fotos antes de que hagan falta, para que el cambio no parpadee. */
export const precargar = (rutas) => {
  for (const ruta of rutas) {
    if (!ruta) continue;
    const img = new Image();
    img.src = fotoDe(ruta);
  }
};
