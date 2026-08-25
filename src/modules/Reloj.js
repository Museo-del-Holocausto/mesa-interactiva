import gsap from 'gsap';
import { Rotary } from '@/core/Rotary.js';

/**
 * Reloj: girar el marcador adelanta la hora del 7 de octubre.
 *
 * El dial es un reloj. Es la unica pieza donde el giro no elige entre opciones
 * ni abre bloques: mueve el tiempo, que es lo que el objeto hace naturalmente
 * cuando uno lo agarra.
 *
 * Lo que cuenta el documento de este dia no son cinco hechos: es una demora.
 * Las familias encerradas horas, el rescate que no llega, el dia que termina
 * sin que nadie sepa cuantos faltan. Por eso hay un contador de horas
 * encerradas que crece con el reloj y no se detiene, y por eso entre las 10 de
 * la manana y las 11 de la noche se puede seguir girando sin que aparezca nada
 * nuevo. Ese tramo vacio es el contenido.
 */
export class Reloj {
  #data;
  #onExit;
  #rotary = new Rotary();
  #min = 0;
  #pos = 0;
  #anclas = [];

  /**
   * @param {any} data
   * @param {() => void} onExit
   */
  constructor(data, onExit) {
    this.#data = data;
    this.#onExit = onExit;
    this.#min = data.desde;
    this.#calcularAnclas();
    this.el = this.#build();
    this.#showScene('intro');
  }

  destroy() {
    gsap.killTweensOf(this.el.querySelectorAll('*'));
    this.el.remove();
  }

  applyRotation(rotation) {
    if (this.el.dataset.scene !== 'dia') return;
    // El giro avanza sobre la banda y no sobre el reloj. Avanzar de a minutos
    // hacia que catorce horas fueran ciento setenta pasos: se giraba diez
    // vueltas y no llegaba nunca. Asi, la banda entera son cuarenta pasos y el
    // recorrido se siente parejo en todo el dia.
    this.#rotary.feed(rotation, 12, (direction) => {
      this.#moverPos(this.#pos + direction * 4);
    });
  }

  /** @param {number} min */
  #hhmm(min) {
    const h = Math.floor(min / 60) % 24;
    const m = Math.floor(min % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  #build() {
    const t = this.#data.ui;
    const root = document.createElement('div');
    root.className = 'rel';
    root.dataset.scene = 'intro';
    root.innerHTML = `
      <section class="rel__scene" data-scene="intro">
        <div>
          <h1 class="rel__h1">${this.#data.title}</h1>
          <p class="rel__lead">${this.#data.lead}</p>
        </div>
        <div class="rel__acts">
          <button class="rel__btn rel__btn--go" data-act="start">${t.start}</button>
        </div>
      </section>

      <section class="rel__scene" data-scene="dia">
        <div class="rel__cab">
          <p class="rel__hora" data-slot="hora"></p>
          ${
            this.#data.contador
              ? `<div class="rel__espera" data-slot="espera">
                   <p class="rel__k">${this.#data.contador.label}</p>
                   <p class="rel__hs"><span data-slot="hs"></span> ${this.#data.contador.unidad}</p>
                 </div>`
              : ''
          }
        </div>

        <div class="rel__banda">
          <div class="rel__pista"><i data-slot="avance"></i></div>
          <ol class="rel__marcas">
            ${this.#data.eventos
              .map(
                (e) =>
                  `<li data-min="${e.min}" data-fila="${this.#data.eventos.indexOf(e) % 2}" style="left:${this.#pct(e.min)}%"><span>${e.hora}</span></li>`,
              )
              .join('')}
          </ol>
        </div>

        <div class="rel__cuerpo" data-slot="cuerpo">
          <figure class="rel__figura" data-slot="figura">
            <div class="rel__foto"><span data-slot="fotoEstado"></span></div>
            <figcaption>
              <span data-slot="epigrafe"></span>
              <span class="rel__credito" data-slot="credito"></span>
            </figcaption>
          </figure>
          <div class="rel__visor" data-slot="visor">
            <ol class="rel__lista" data-slot="lista"></ol>
          </div>
        </div>

        <div class="rel__foot">
          <p class="rel__hint">${t.hint}</p>
          <button class="rel__btn rel__btn--go" data-act="fin">${t.fin}</button>
        </div>
      </section>

      <section class="rel__scene" data-scene="fin">
        <div>
          <p class="rel__k">${this.#data.closing.label}</p>
          <p class="rel__close">${this.#data.closing.text}</p>
          <p class="rel__close2">${this.#data.closing.sub}</p>
        </div>
        <div class="rel__acts">
          <button class="rel__btn" data-act="again">${t.again}</button>
        </div>
      </section>`;

    root.addEventListener('pointerdown', (event) => {
      // Solo el boton principal. El secundario tiene que llegar al navegador.
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.stopPropagation();

      const marca = target.closest('.rel__marcas li');
      if (marca?.dataset.min) return this.#mover(Number.parseInt(marca.dataset.min, 10));

      const act = target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#empezar();
      else if (act === 'fin') this.#showScene('fin');
      else if (act === 'again') this.#empezar();
    });

    return root;
  }

  /**
   * Posiciones de las marcas sobre la banda.
   *
   * Empiezan proporcionales al reloj y despues se separan hasta una distancia
   * minima. Entre las 6:29 y las 6:35 hay seis minutos sobre una banda de
   * catorce horas: proporcional exacto es medio pixel y los rotulos se montan.
   * Lo que tiene que percibirse es que una cosa pasó cerca de la otra, no
   * cuantos pixeles hay entre las dos.
   */
  #calcularAnclas() {
    const { desde, hasta, eventos } = this.#data;
    const span = hasta - desde;
    const SEP = 12;
    // Proporcional puro dejaba la noche del festival ocupando el 60% de la
    // banda sin nada adentro: llegar de las 22:00 a las 6:29 eran tres cuartos
    // de vuelta. Se mezcla con un reparto parejo, asi la noche sigue viendose
    // mas larga que los seis minutos entre cohetes y evacuacion, pero cruzarla
    // no cuesta lo mismo que vivirla.
    const MEZCLA = 0.3;
    const n = eventos.length;
    const pcts = eventos.map((e, i) => {
      const prop = ((e.min - desde) / span) * 100;
      const parejo = n > 1 ? (i / (n - 1)) * 100 : 0;
      return MEZCLA * prop + (1 - MEZCLA) * parejo;
    });

    // Una pasada hacia adelante y otra hacia atras: empujar solo en un sentido
    // amontona todo contra el borde.
    for (let i = 1; i < pcts.length; i += 1) {
      if (pcts[i] - pcts[i - 1] < SEP) pcts[i] = pcts[i - 1] + SEP;
    }
    for (let i = pcts.length - 2; i >= 0; i -= 1) {
      if (pcts[i + 1] - pcts[i] < SEP) pcts[i] = pcts[i + 1] - SEP;
    }
    const min = Math.min(...pcts, 0);
    const max = Math.max(...pcts, 100);
    const norm = (v) => ((v - min) / (max - min)) * 100;

    this.#anclas = [
      { min: desde, pct: norm(0) },
      ...eventos.map((e, i) => ({ min: e.min, pct: norm(pcts[i]) })),
      { min: hasta, pct: norm(100) },
    ].sort((a, b) => a.min - b.min);
  }

  /** Del reloj a la banda, interpolando entre anclas. @param {number} min */
  #pct(min) {
    const a = this.#anclas;
    for (let i = 0; i < a.length - 1; i += 1) {
      if (min <= a[i + 1].min) {
        const k = (min - a[i].min) / (a[i + 1].min - a[i].min || 1);
        return a[i].pct + k * (a[i + 1].pct - a[i].pct);
      }
    }
    return 100;
  }

  /** De la banda al reloj. @param {number} pct */
  #minEn(pct) {
    const a = this.#anclas;
    for (let i = 0; i < a.length - 1; i += 1) {
      if (pct <= a[i + 1].pct) {
        const k = (pct - a[i].pct) / (a[i + 1].pct - a[i].pct || 1);
        return Math.round(a[i].min + k * (a[i + 1].min - a[i].min));
      }
    }
    return this.#data.hasta;
  }

  /** @param {string} name */
  #showScene(name) {
    this.el.dataset.scene = name;
    const scenes = [...this.el.querySelectorAll('.rel__scene')];
    for (const scene of scenes) scene.dataset.on = String(scene.dataset.scene === name);
    gsap.killTweensOf(scenes);
    gsap.set(scenes, { opacity: 0 });
    gsap.to(this.el.querySelector(`[data-scene="${name}"]`), {
      opacity: 1,
      duration: 0.34,
      ease: 'power2.out',
    });
  }

  #empezar() {
    this.#pos = 0;
    this.#min = this.#data.desde;
    this.#rotary.reset();
    this.#pintar();
    this.#showScene('dia');
  }

  /** @param {number} pct */
  #moverPos(pct) {
    const v = Math.max(0, Math.min(100, pct));
    if (v === this.#pos) return;
    this.#pos = v;
    this.#min = this.#minEn(v);
    this.#pintar();
  }

  /** Tocar una marca: se salta a su hora. @param {number} min */
  #mover(min) {
    const v = Math.max(this.#data.desde, Math.min(this.#data.hasta, min));
    this.#pos = this.#pct(v);
    this.#min = v;
    this.#pintar();
  }

  #pintar() {
    const t = this.#data.ui;
    this.el.querySelector('[data-slot="hora"]').textContent = this.#hhmm(this.#min);
    this.el.querySelector('[data-slot="avance"]').style.width = `${this.#pos}%`;

    for (const li of this.el.querySelectorAll('.rel__marcas li')) {
      li.dataset.on = String(this.#min >= Number(li.dataset.min));
    }

    // El contador de horas encerradas arranca cuando entran a las comunidades
    // y ya no para. Es el unico numero de la pieza y no deja de subir. No todas
    // las lineas lo necesitan, asi que es opcional.
    const espera = this.el.querySelector('[data-slot="espera"]');
    if (espera) {
      const horas = Math.floor((this.#min - this.#data.contador.desde) / 60);
      espera.dataset.on = String(horas >= 1);
      if (horas >= 1) this.el.querySelector('[data-slot="hs"]').textContent = String(horas);
    }

    const lista = this.el.querySelector('[data-slot="lista"]');
    const visibles = this.#data.eventos.filter((e) => this.#min >= e.min);
    this.#pintarFigura(visibles);
    if (lista.children.length !== visibles.length) {
      lista.replaceChildren();
      for (const e of visibles) {
        const li = document.createElement('li');
        li.className = 'rel__ev';
        li.innerHTML = '<p class="rel__evhora"></p><div><p class="rel__evtit"></p><p class="rel__evtx"></p></div>';
        li.querySelector('.rel__evhora').textContent = e.hora;
        li.querySelector('.rel__evtit').textContent = e.titulo;
        li.querySelector('.rel__evtx').textContent = e.texto;
        lista.append(li);
      }
      const ultimo = lista.lastElementChild;
      if (ultimo) {
        gsap.fromTo(ultimo, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      }
      this.#acomodarLista();
    }
  }

  /**
   * Los hechos se apilan en una sola columna y el ultimo queda siempre abajo a
   * la vista. Cuando ya no entran, la pila se corre hacia arriba: lo viejo se
   * va por el borde superior en vez de partirse en columnas.
   *
   * Dos columnas obligaban a leer en zigzag y a adivinar cual era el hecho
   * nuevo. Con una sola, el nuevo siempre esta en el mismo lugar.
   */
  #acomodarLista() {
    const visor = this.el.querySelector('[data-slot="visor"]');
    const lista = this.el.querySelector('[data-slot="lista"]');
    if (!visor || !lista) return;
    requestAnimationFrame(() => {
      const sobra = lista.scrollHeight - visor.clientHeight;
      gsap.to(lista, {
        y: sobra > 0 ? -sobra : 0,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: true,
      });
    });
  }

  /**
   * La imagen del ultimo hito alcanzado que tenga una. Nova es sobre todo
   * visual —jovenes bailando la noche anterior— y esas fotos no ilustran el
   * ataque: muestran lo que habia antes.
   * @param {any[]} visibles
   */
  #pintarFigura(visibles) {
    const figura = this.el.querySelector('[data-slot="figura"]');
    const cuerpo = this.el.querySelector('[data-slot="cuerpo"]');
    if (!figura || !cuerpo) return;

    const hay = this.#data.eventos.some((e) => e.imagen);
    cuerpo.dataset.confoto = String(hay);
    if (!hay) return;

    const conFoto = [...visibles].reverse().find((e) => e.imagen);
    figura.dataset.on = String(Boolean(conFoto));
    if (!conFoto || figura.dataset.actual === conFoto.hora) return;
    figura.dataset.actual = conFoto.hora;

    const t = this.#data.ui;
    this.el.querySelector('[data-slot="fotoEstado"]').textContent =
      conFoto.imagen.alt ?? t.imagePending;
    this.el.querySelector('[data-slot="epigrafe"]').textContent = conFoto.imagen.epigrafe ?? '';
    this.el.querySelector('[data-slot="credito"]').textContent =
      conFoto.imagen.credito ?? t.creditPending;
    gsap.fromTo(figura, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  }
}
