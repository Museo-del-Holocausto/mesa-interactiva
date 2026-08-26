import { Definir } from '@/modules/Definir.js';
import { Trivia } from '@/modules/Trivia.js';
import { Mitos } from '@/modules/Mitos.js';
import { Contradicciones } from '@/modules/Contradicciones.js';
import { Decidir } from '@/modules/Decidir.js';
import { Combinar } from '@/modules/Combinar.js';
import { Estimar } from '@/modules/Estimar.js';
import { Alcance } from '@/modules/Alcance.js';
import { Desmentido } from '@/modules/Desmentido.js';
import { Recorrer } from '@/modules/Recorrer.js';
import { Explorar } from '@/modules/Explorar.js';
import { Lugares } from '@/modules/Lugares.js';
import { Vidas } from '@/modules/Vidas.js';
import { Cifras } from '@/modules/Cifras.js';
import { Contenedores } from '@/modules/Contenedores.js';
import { Reloj } from '@/modules/Reloj.js';
import { Espera } from '@/modules/Espera.js';
import eje1definir from '@/content/es/eje1-definir.json';
import eje1trivia from '@/content/es/eje1-trivia.json';
import eje2combinar from '@/content/es/eje2-combinar.json';
import eje2estimar from '@/content/es/eje2-estimar.json';
import eje2que from '@/content/es/eje2-que.json';
import eje2trivia from '@/content/es/eje2-trivia.json';
import eje3mitos from '@/content/es/eje3-mitos.json';
import eje3contra from '@/content/es/eje3-contradicciones.json';
import eje3trivia from '@/content/es/eje3-trivia.json';
import eje4 from '@/content/es/eje4.json';
import eje4linea from '@/content/es/eje4-linea.json';
import eje4trivia from '@/content/es/eje4-trivia.json';
import eje5escalada from '@/content/es/eje5-escalada.json';
import eje5frenar from '@/content/es/eje5-frenar.json';
import eje5trivia from '@/content/es/eje5-trivia.json';
import eje5desmentido from '@/content/es/eje5-desmentido.json';
import eje6defs from '@/content/es/eje6-definiciones.json';
import eje6afirm from '@/content/es/eje6-afirmaciones.json';
import eje6trivia from '@/content/es/eje6-trivia.json';
import eje7 from '@/content/es/eje7.json';
import eje7casos from '@/content/es/eje7-casos.json';
import eje8 from '@/content/es/eje8.json';
import eje8vidas from '@/content/es/eje8-vidas.json';
import eje8cifras from '@/content/es/eje8-cifras.json';
import eje8anti from '@/content/es/eje8-antisemitismo.json';
import eje8dia from '@/content/es/eje8-dia.json';
import eje8prop from '@/content/es/eje8-proposito.json';
import eje8nova from '@/content/es/eje8-nova.json';
import eje8novacif from '@/content/es/eje8-nova-cifras.json';
import eje8espera from '@/content/es/eje8-espera.json';
import eje9 from '@/content/es/eje9.json';

/**
 * Registro de piezas. Un nodo del menu con `module` se monta desde aca en vez
 * de abrir un submenu.
 *
 * La numeracion sigue la de los documentos de contenido. Cuando cambio esa
 * lista —el eje 1 paso a ser el 2, aparecio un eje nuevo al principio— lo que
 * se movio fueron las entradas del menu, no las piezas: una pieza no sabe en
 * que numero de eje esta montada.
 */
export const MODULES = {
  'eje-1-definir': (onExit) => new Definir(eje1definir, onExit),
  'eje-1-trivia': (onExit) => new Trivia(eje1trivia, onExit),
  'eje-2-que': (onExit) => new Contenedores(eje2que, onExit),
  'eje-2-combinar': (onExit) => new Combinar(eje2combinar, onExit),
  'eje-2-estimar': (onExit) => new Estimar(eje2estimar, onExit),
  'eje-2-trivia': (onExit) => new Trivia(eje2trivia, onExit),
  'eje-3-mitos': (onExit) => new Mitos(eje3mitos, onExit),
  'eje-3-contradicciones': (onExit) => new Contradicciones(eje3contra, onExit),
  'eje-3-trivia': (onExit) => new Trivia(eje3trivia, onExit),
  'eje-4-recorrer': (onExit) => new Recorrer(eje4, onExit),
  'eje-4-linea': (onExit) => new Mitos(eje4linea, onExit),
  'eje-4-trivia': (onExit) => new Trivia(eje4trivia, onExit),
  'eje-5-escalada': (onExit) => new Mitos(eje5escalada, onExit),
  'eje-5-alcance': (onExit) => new Alcance(eje5frenar, onExit),
  'eje-5-desmentido': (onExit) => new Desmentido(eje5desmentido, onExit),
  'eje-5-trivia': (onExit) => new Trivia(eje5trivia, onExit),
  'eje-6-definiciones': (onExit) => new Mitos(eje6defs, onExit),
  'eje-6-afirmaciones': (onExit) => new Mitos(eje6afirm, onExit),
  'eje-6-trivia': (onExit) => new Trivia(eje6trivia, onExit),
  'eje-7-decidir': (onExit) => new Decidir(eje7, onExit),
  'eje-7-casos': (onExit) => new Mitos(eje7casos, onExit),
  'eje-8-proposito': (onExit) => new Contenedores(eje8prop, onExit),
  'eje-8-dia': (onExit) => new Reloj(eje8dia, onExit),
  'eje-8-lugares': (onExit) => new Lugares(eje8, onExit),
  'eje-8-nova': (onExit) => new Reloj(eje8nova, onExit),
  'eje-8-nova-cifras': (onExit) => new Contenedores(eje8novacif, onExit),
  'eje-8-vidas': (onExit) => new Vidas(eje8vidas, onExit),
  'eje-8-cifras': (onExit) => new Cifras(eje8cifras, onExit),
  'eje-8-espera': (onExit) => new Espera(eje8espera, onExit),
  'eje-8-antisemitismo': (onExit) => new Contenedores(eje8anti, onExit),
  'eje-9': (onExit) => new Explorar(eje9, onExit),
};
