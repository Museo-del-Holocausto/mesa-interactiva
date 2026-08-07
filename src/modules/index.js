import { Fabricar } from '@/modules/Fabricar.js';
import { LineaTiempo } from '@/modules/LineaTiempo.js';
import { Decidir } from '@/modules/Decidir.js';
import { Combinar } from '@/modules/Combinar.js';
import { Recorrer } from '@/modules/Recorrer.js';
import { Explorar } from '@/modules/Explorar.js';
import { Lugares } from '@/modules/Lugares.js';
import { Vidas } from '@/modules/Vidas.js';
import { Espera } from '@/modules/Espera.js';
import eje1 from '@/content/es/eje1.json';
import eje3 from '@/content/es/eje3.json';
import eje4 from '@/content/es/eje4.json';
import eje7 from '@/content/es/eje7.json';
import eje8 from '@/content/es/eje8.json';
import eje8vidas from '@/content/es/eje8-vidas.json';
import eje8espera from '@/content/es/eje8-espera.json';
import eje9 from '@/content/es/eje9.json';

/**
 * Registro de piezas. Un nodo del menu con `module` se monta desde aca en vez
 * de abrir un submenu.
 *
 * Cada eje se trabaja de a uno: el resto todavia no tiene pieza propia.
 */
export const MODULES = {
  'eje-1': (onExit) => new Combinar(eje1, onExit),
  'eje-3-fabricar': (onExit) => new Fabricar(eje3.fabricar, onExit),
  'eje-3-linea': () => new LineaTiempo(eje3.linea),
  'eje-4': (onExit) => new Recorrer(eje4, onExit),
  'eje-7': (onExit) => new Decidir(eje7, onExit),
  'eje-8-lugares': (onExit) => new Lugares(eje8, onExit),
  'eje-8-vidas': (onExit) => new Vidas(eje8vidas, onExit),
  'eje-8-espera': (onExit) => new Espera(eje8espera, onExit),
  'eje-9': (onExit) => new Explorar(eje9, onExit),
};
