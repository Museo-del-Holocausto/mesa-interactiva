import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/quadrant.css';
import '@/styles/menu.css';
import '@/styles/modulo.css';
import '@/styles/debug.css';

import { DEBUG } from '@/config/debug.js';
import { Stage } from '@/core/Stage.js';
import { MarkerStore } from '@/core/MarkerStore.js';
import { SimulatedInput } from '@/core/inputs/SimulatedInput.js';
import { LayoutManager } from '@/layout/LayoutManager.js';
import { DebugOverlay } from '@/ui/DebugOverlay.js';
import { i18n } from '@/i18n/i18n.js';

function boot() {
  const stageEl = document.querySelector('#stage');
  if (!stageEl) throw new Error('Falta #stage en index.html');

  i18n.set(i18n.current);

  console.log("init");

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
    stageEl.append(new DebugOverlay(store, layout).el);
  }

  const ghostLayer = document.createElement('div');
  ghostLayer.className = 'ghosts';
  ghostLayer.dataset.chrome = String(DEBUG.chrome);
  stageEl.append(ghostLayer);

  const sim = new SimulatedInput(store, stage, ghostLayer);
  sim.start();

  sim.setCount(DEBUG.markerCount);
  if (DEBUG.guide) sim.toggleGuide();
}

boot();
