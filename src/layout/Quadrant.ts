import gsap from 'gsap';
import { AxisMenu } from '@/ui/AxisMenu';
import { evaluateProximity } from '@/layout/ProximityGuard';
import { i18n } from '@/i18n/i18n';
import type { Marker, Region } from '@/core/types';

/**
 * Una region de la mesa asignada a un usuario.
 * Los cuadrantes son fijos: no se recalculan segun cuanta gente haya.
 * Un layout que se reacomoda al llegar alguien le rompe la lectura al que ya estaba.
 */
export class Quadrant {
  readonly el: HTMLElement;
  readonly region: Region;

  private idleEl: HTMLElement;
  private warningEl: HTMLElement;
  private menu: AxisMenu | null = null;
  private markerId: number | null = null;

  constructor(region: Region) {
    this.region = region;

    this.el = document.createElement('section');
    this.el.className = 'quadrant';
    this.el.dataset.index = String(region.index);
    this.el.dataset.state = 'idle';
    this.el.style.left = `${region.x}px`;
    this.el.style.top = `${region.y}px`;
    this.el.style.width = `${region.w}px`;
    this.el.style.height = `${region.h}px`;
    // Los usuarios de la mitad de arriba leen desde el borde opuesto.
    this.el.style.transform = `rotate(${region.orientation}deg)`;

    this.idleEl = document.createElement('div');
    this.idleEl.className = 'idle';
    this.idleEl.innerHTML = `
      <div class="idle__pulse"></div>
      <p class="idle__prompt">${i18n.t('idlePrompt')}</p>
      <p class="idle__hint">${i18n.t('idleHint')}</p>`;
    this.el.append(this.idleEl);

    this.warningEl = document.createElement('div');
    this.warningEl.className = 'warning';
    this.warningEl.dataset.visible = 'false';
    this.el.append(this.warningEl);
  }

  get isBusy(): boolean {
    return this.markerId !== null;
  }

  get claimedBy(): number | null {
    return this.markerId;
  }

  contains(marker: Marker): boolean {
    return (
      marker.x >= this.region.x &&
      marker.x < this.region.x + this.region.w &&
      marker.y >= this.region.y &&
      marker.y < this.region.y + this.region.h
    );
  }

  /** Coordenadas de mesa -> coordenadas locales, contemplando la rotacion de 180. */
  toLocal(x: number, y: number): { x: number; y: number } {
    const dx = x - this.region.x;
    const dy = y - this.region.y;
    if (this.region.orientation === 180) {
      return { x: this.region.w - dx, y: this.region.h - dy };
    }
    return { x: dx, y: dy };
  }

  attach(marker: Marker, menuFactory: () => AxisMenu): void {
    if (this.markerId === marker.id && this.menu) return;
    this.markerId = marker.id;
    if (!this.menu) {
      this.menu = menuFactory();
      this.el.append(this.menu.el);
      gsap.fromTo(
        this.menu.el,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' },
      );
    }
    this.el.dataset.state = 'active';
  }

  detach(): void {
    this.markerId = null;
    this.menu?.detach();
    this.menu?.destroy();
    this.menu = null;
    this.el.dataset.state = 'idle';
    this.warningEl.dataset.visible = 'false';
  }

  update(marker: Marker, others: Marker[]): void {
    if (!this.menu) return;

    const local = this.toLocal(marker.x, marker.y);
    this.menu.place(local.x, local.y, this.region.w);
    this.menu.applyRotation(marker.rotation);

    const proximity = evaluateProximity(marker, this.region, others);
    if (proximity.issue === 'none') {
      this.warningEl.dataset.visible = 'false';
    } else {
      this.warningEl.textContent =
        proximity.issue === 'edge' ? i18n.t('warnEdge') : i18n.t('warnNeighbour');
      this.warningEl.dataset.visible = 'true';
      this.warningEl.style.transform = `translate(${local.x}px, ${local.y}px)`;
    }
    this.el.dataset.warning = proximity.issue;
  }

  /** Paso de seleccion pedido por teclado, no por giro. */
  nudge(direction: 1 | -1): void {
    this.menu?.step(direction);
  }
}
