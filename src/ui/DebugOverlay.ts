import { GUIDE_MARKER_ID, QUADRANTS } from '@/config/table';
import type { LayoutManager } from '@/layout/LayoutManager';
import type { MarkerStore } from '@/core/MarkerStore';

/** Guias de cuadrante y estado. Solo existe con debug encendido. */
export class DebugOverlay {
  readonly el: HTMLElement;
  private readout: HTMLElement;

  constructor(store: MarkerStore, layout: LayoutManager) {
    this.el = document.createElement('div');
    this.el.className = 'debug';

    for (const region of QUADRANTS) {
      const box = document.createElement('div');
      box.className = 'debug__region';
      box.style.left = `${region.x}px`;
      box.style.top = `${region.y}px`;
      box.style.width = `${region.w}px`;
      box.style.height = `${region.h}px`;
      box.dataset.orientation = String(region.orientation);
      box.innerHTML = `<span>Q${region.index} · ${region.w}×${region.h} · ${region.orientation}°</span>`;
      this.el.append(box);
    }

    this.readout = document.createElement('div');
    this.readout.className = 'debug__readout';
    this.el.append(this.readout);

    const help = document.createElement('div');
    help.className = 'debug__help';
    help.innerHTML = `
      <b>debug</b>
      <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> marcadores</span>
      <span><kbd>0</kbd> ninguno</span>
      <span><kbd>G</kbd> modo guía</span>
      <span><kbd>←</kbd><kbd>→</kbd> girar un paso</span>
      <span>arrastrar · mover</span>
      <span>rueda · girar</span>`;
    this.el.append(help);

    const update = (): void => {
      const markers = store.list();
      const visitors = markers.filter((m) => m.id !== GUIDE_MARKER_ID);
      this.readout.textContent = `${layout.currentMode} · ${visitors.length} marcador${
        visitors.length === 1 ? '' : 'es'
      }`;
    };
    store.bus.on('change', update);
    update();
  }
}
