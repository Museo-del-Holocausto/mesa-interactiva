import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/quadrant.css';
import '@/styles/menu.css';
import '@/styles/debug.css';

import { DEBUG } from '@/config/debug';
import { Stage } from '@/core/Stage';
import { MarkerStore } from '@/core/MarkerStore';
import { SimulatedInput } from '@/core/inputs/SimulatedInput';
import { LayoutManager } from '@/layout/LayoutManager';
import { DebugOverlay } from '@/ui/DebugOverlay';
import { i18n } from '@/i18n/i18n';

function boot(): void {
  const stageEl = document.querySelector<HTMLElement>('#stage');
  if (!stageEl) throw new Error('Falta #stage en index.html');

  i18n.set(i18n.current);

  const stage = new Stage(stageEl);
  const store = new MarkerStore();
  store.startSweep();

  const layoutRoot = document.createElement('div');
  layoutRoot.className = 'layout';
  layoutRoot.dataset.layout = 'quadrants';
  stageEl.append(layoutRoot);

  const layout = new LayoutManager(store, layoutRoot);

  if (!DEBUG.simulator) {
    // Produccion: aca se engancha TangibleInput contra el relay.
    // const tangible = new TangibleInput(store);
    // tangible.start();
    return;
  }

  // El andamiaje visible se apaga solo (?debug=0) sin apagar el simulador,
  // asi se puede mostrar el proyecto con las teclas todavia andando.
  if (DEBUG.chrome) {
    const overlay = new DebugOverlay(store, layout);
    stageEl.append(overlay.el);
  }

  const ghostLayer = document.createElement('div');
  ghostLayer.className = 'ghosts';
  ghostLayer.dataset.chrome = String(DEBUG.chrome);
  stageEl.append(ghostLayer);

  const sim = new SimulatedInput(store, stage, ghostLayer);
  sim.start();
  sim.bus.on('nudge:step', ({ id, direction }) => layout.nudge(id, direction));

  sim.setCount(DEBUG.markerCount);
  if (DEBUG.guide) sim.toggleGuide();
}

boot();
