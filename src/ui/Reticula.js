import { TABLE_H, TABLE_W } from '@/config/table.js';

/**
 * Fondo de mesa: una retícula fija y unos pocos puntos que viajan por sus líneas.
 * Todo en gris: tiene que sentirse, no leerse. El cyan queda para lo que se toca.
 *
 * Son dos lienzos. La retícula se dibuja una sola vez y no se toca más.
 * Los puntos viven en un segundo lienzo que se redibuja en cada cuadro,
 * así el costo por cuadro es solo el de los puntos y sus estelas.
 *
 * La retícula es una sola para toda la mesa y nace en el centro: así las dos
 * divisiones de cuadrante (x = 1920, y = 1080) caen siempre sobre una línea,
 * sea cual sea el tamaño de celda. Los bordes de la mesa cortan celdas, no importa.
 */

const CELL = 200;               // 75 mm reales sobre el panel
const MAJOR_EVERY = 4;          // una línea un poco más marcada cada 4 celdas, contando desde el centro
const CX = TABLE_W / 2;
const CY = TABLE_H / 2;

// Gris neutro. La cruz del cruce apenas por encima de la línea: se intuye, no salta.
const LINE = 'rgba(200, 214, 222, 0.022)';
const LINE_MAJOR = 'rgba(200, 214, 222, 0.04)';
const NODE = 'rgba(200, 214, 222, 0.045)';
const NODE_ARM = 6;             // largo de cada brazo de la cruz, en px

const DOTS = 4;
const SPEED_MIN = 50;           // px de mesa por segundo
const SPEED_MAX = 110;
const HEAD = 5;                 // lado del cuadrado que va adelante, en px
const HEAD_ALPHA = 0.4;
const TRAIL = 90;               // largo de la estela, en px
const TRAIL_ALPHA = 0.12;       // brillo de la estela en su arranque
const LIFE_MIN = 8;             // segundos
const LIFE_MAX = 18;
const FADE = 1.5;               // segundos de aparición y desaparición

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

/** Posiciones de las líneas de un eje, desde el centro hacia los bordes. */
function lines(center, size) {
  const out = [];
  for (let v = center % CELL; v < size; v += CELL) if (v > 0) out.push(v);
  return out;
}

const XS = lines(CX, TABLE_W);
const YS = lines(CY, TABLE_H);

/** Índice de una línea contado desde el centro, para saber si es mayor. */
const isMajor = (v, center) => Math.round(Math.abs(v - center) / CELL) % MAJOR_EVERY === 0;

/**
 * Un punto elige una línea y una dirección y no la cambia nunca:
 * o va vertical o va horizontal, en línea recta, hasta apagarse o salir.
 */
class Punto {
  constructor() {
    this.reset(true);
  }

  /** @param {boolean} first */
  reset(first = false) {
    this.vertical = Math.random() < 0.5;
    this.sign = Math.random() < 0.5 ? 1 : -1;
    if (this.vertical) {
      this.x = XS[randInt(0, XS.length - 1)];
      this.y = rand(0, TABLE_H);
    } else {
      this.x = rand(0, TABLE_W);
      this.y = YS[randInt(0, YS.length - 1)];
    }
    this.speed = rand(SPEED_MIN, SPEED_MAX);
    this.life = rand(LIFE_MIN, LIFE_MAX);
    // Al arrancar, cada punto ya va por algún momento de su vida: no aparecen todos juntos.
    this.age = first ? rand(0, this.life) : 0;
  }

  /** @param {number} dt */
  step(dt) {
    this.age += dt;
    const d = this.speed * dt * this.sign;
    if (this.vertical) this.y += d;
    else this.x += d;

    const out = this.x < -TRAIL || this.x > TABLE_W + TRAIL || this.y < -TRAIL || this.y > TABLE_H + TRAIL;
    if (this.age >= this.life || out) this.reset();
  }

  get alpha() {
    const fadeIn = Math.min(1, this.age / FADE);
    const fadeOut = Math.min(1, (this.life - this.age) / FADE);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }
}

export class Reticula {
  #dots = [];
  #raf = 0;
  #last = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'reticula';

    this.grid = this.#canvas();
    this.live = this.#canvas();
    this.el.append(this.grid, this.live);
    this.ctx = this.live.getContext('2d');

    this.#drawGrid();
    for (let i = 0; i < DOTS; i += 1) this.#dots.push(new Punto());
  }

  #canvas() {
    const c = document.createElement('canvas');
    c.width = TABLE_W;
    c.height = TABLE_H;
    return c;
  }

  #drawGrid() {
    const g = this.grid.getContext('2d');

    // Las líneas como rectángulos de 1 px: nítidas, sin el medio píxel del stroke.
    for (const x of XS) {
      g.fillStyle = isMajor(x, CX) ? LINE_MAJOR : LINE;
      g.fillRect(x, 0, 1, TABLE_H);
    }
    for (const y of YS) {
      g.fillStyle = isMajor(y, CY) ? LINE_MAJOR : LINE;
      g.fillRect(0, y, TABLE_W, 1);
    }

    // Cruces: una marca chica en cada intersección.
    g.fillStyle = NODE;
    for (const x of XS) {
      for (const y of YS) {
        g.fillRect(x - NODE_ARM, y, NODE_ARM * 2 + 1, 1);
        g.fillRect(x, y - NODE_ARM, 1, NODE_ARM * 2 + 1);
      }
    }
  }

  start() {
    if (this.#raf) return;
    this.#last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - this.#last) / 1000);
      this.#last = now;
      this.#frame(dt);
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  /** @param {number} dt */
  #frame(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, TABLE_W, TABLE_H);

    for (const p of this.#dots) {
      p.step(dt);
      const a = p.alpha;
      if (a <= 0) continue;

      // Estela: recta, hacia atrás de la dirección de avance.
      const tx = p.vertical ? p.x : p.x - TRAIL * p.sign;
      const ty = p.vertical ? p.y - TRAIL * p.sign : p.y;
      const grad = ctx.createLinearGradient(p.x, p.y, tx, ty);
      grad.addColorStop(0, `rgba(200, 214, 222, ${TRAIL_ALPHA * a})`);
      grad.addColorStop(1, 'rgba(200, 214, 222, 0)');
      ctx.fillStyle = grad;
      if (p.vertical) ctx.fillRect(p.x, Math.min(p.y, ty), 1, TRAIL);
      else ctx.fillRect(Math.min(p.x, tx), p.y, TRAIL, 1);

      // Cabeza: un cuadrado chico, centrado sobre la línea.
      ctx.fillStyle = `rgba(225, 233, 238, ${HEAD_ALPHA * a})`;
      ctx.fillRect(Math.round(p.x - HEAD / 2 + 0.5), Math.round(p.y - HEAD / 2 + 0.5), HEAD, HEAD);
    }
  }
}
