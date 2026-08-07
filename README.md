# Mesa interactiva · Museo del Holocausto de Buenos Aires

Instalación de mesa táctil de 65" sobre panel 3M PCAP, 3840×2160 por DisplayPort,
cuatro usuarios simultáneos con marcadores fiduciales.

**Capa actual: menú de 9 ejes navegable con marcador simulado. Sin contenido.**

## Arrancar

```bash
npm install
npm run dev
```

JavaScript puro con clases y campos privados (`#`). Vite solo compila y sirve;
no hay paso de tipos. Los tipos están documentados en JSDoc en `src/core/types.js`
para que el editor autocomplete sin meter TypeScript en el build.

## Atajos de debug

| Tecla | Acción |
|---|---|
| `1` `2` `3` `4` | Cantidad de marcadores en pantalla |
| `0` | Sacar todos |
| `G` | Marcador de guía → pantalla completa |
| `←` `→` | Girar un paso el marcador con foco |
| arrastrar | Mover el marcador |
| rueda | Girar el marcador |

Parámetros de URL: `?marker=3` · `?guide=1` · `?lang=en` · `?debug=0` · `?sim=0`

El marcador se dibuja siempre que corre el simulador: representa el objeto físico, no
es andamiaje. Lo que `?debug=0` saca son las marcas de desarrollo — número, aro de foco,
guías de cuadrante, overlay de ayuda.

`debug` y `sim` son cosas distintas. `?debug=0` apaga el andamiaje visible (ghosts,
guías de cuadrante, overlay) pero deja el simulador andando, así que las teclas siguen
funcionando. Para mostrar el proyecto: **`?debug=0&guide=1`**. `?sim=0` apaga el
simulador entero.

## Decisiones de arquitectura

**Escalado.** `#stage` mide siempre 3840×2160. `Stage` lo encaja en el viewport por
`transform: scale()`. Ningún componente sabe que el escalado existe: todos trabajan en
px de mesa. Para convertir eventos de puntero, `Stage.toTable()`.

**Cuadrantes fijos.** Cuatro regiones de 1920×1080, siempre las cuatro. No se
recalculan según cuánta gente haya: un layout que se reacomoda cuando llega alguien le
rompe la lectura al que ya estaba, y el tipográfico está calibrado contra milímetros
reales, no contra proporciones. Los cuadrantes de la mitad superior van rotados 180°
porque se leen desde el borde opuesto.

**Modo guía.** No se infiere de la cantidad de marcadores: lo activa un marcador
dedicado (`GUIDE_MARKER_ID`) que el museo guarda aparte. La intención es física y
explícita, no adivinada. Al entrar en modo guía salen los marcadores de visitante.

**Qué escala y qué no.** La órbita está atada al tamaño físico del marcador, que en modo
guía sigue midiendo lo mismo: si la agrandáramos se despegaría del objeto. Lo que sí
escala es el texto (`--panel-scale`, 1.75 en guía), porque se lee desde varios metros y
no desde 60 cm.

**Entrada.** `MarkerStore` es la única fuente de verdad. `SimulatedInput` y
`TangibleInput` escriben con la misma forma de dato (`MarkerFrame`), así que enchufar
Tangible Engine no toca nada río abajo. En `main.ts` está el punto de conexión.

**Selección.** El índice del menú es la fuente de verdad; el giro del marcador lo
avanza de a pasos acumulados, nunca por ángulo absoluto (un objeto físico se apoya en
cualquier orientación). El toque replica todo lo que hace el marcador: tocar un punto
selecciona, tocar el panel entra. El giro es mejora, no requisito.

**Posición de lectura.** No está a las 12 sino a las 3, del lado del panel. Un aro fijo
marca la ranura y una hairline la ata al texto; los puntos giran y el elegido entra en
la ranura. Cuando el panel flipea a la izquierda, la ranura y la línea giran a las 9
junto con él.

**Gramática de entrada: una sola regla.** *La rosca recorre hermanos, el toque entra y
opera.* En una hoja (nodo sin hijos) la rosca queda inerte: ahí las acciones son
distintas en cada modo y forzar una rotación sobre las tres le daría tres significados
al mismo gesto. Como el toque es un superset completo, la rosca es siempre opcional.

**Árbol de profundidad libre.** `Corona` no sabe cuántos niveles hay: apila un cuadro
por nivel. Los ejes 1, 2 y 4 a 9 son `eje → ítems`. El eje 3 es
`eje → submódulo → ítem`, porque adentro tiene dos piezas (Fábrica de mitos y Dos mil
años). Agregar profundidad es agregar `children` en el JSON, no tocar código.

**Cómo se muestran los hijos.** Cada nodo lo declara con `display`:

| `display` | Vista | Cuándo |
|---|---|---|
| `destacado` | uno por vez, con bajada | pocos hijos, cada uno pide explicación |
| `lista` | selector vertical | muchos hijos, se recorren |

Una hoja siempre usa la vista de contenido. La lista se comporta como un dial: la fila
elegida entra en la línea de lectura y el resto pasa por arriba y por abajo,
enmascarada. Es la misma lógica que la órbita, en vertical.

**Aviso de proximidad.** No es decorativo: si el marcador se arrima a un borde más que
`SAFE_RADIUS`, la corona no entra en el cuadrante y se mete en el del vecino.

**i18n.** El idioma hoy es global (`?lang=`) y cambia los cuatro cuadrantes a la vez.
Cuando se ataque multilingüe tiene que pasar a ser por marcador: cada usuario elige el
suyo. Implica mover `i18n` de singleton a instancia por `AxisMenu`.

Un archivo por idioma con la misma forma (`content/es/`, `content/en/`), no
objetos `{es, en}` anidados: el contenido en español se edita sin ver una sola clave en
inglés. El inglés está con la estructura armada y los textos marcados
`PENDING TRANSLATION`.

## Estructura

```
src/
  config/     geometría de la mesa y flags de debug
  core/       Stage, MarkerStore, EventBus, fuentes de entrada
  layout/     LayoutManager, Quadrant, ProximityGuard
  ui/         AxisMenu (la corona), DebugOverlay
  content/    JSON por idioma
  styles/     tokens y hojas por capa
```

## Producción

`DEBUG.simulator` sale de `import.meta.env.DEV`: en el build de producción el simulador,
el overlay y los atajos no existen. Antes del deploy hay que descomentar el bloque de
`TangibleInput` en `main.ts`.

Fuentes autoalojadas vía `@fontsource-variable`: la mesa no depende de red.

## Pendientes que bloquean

- Versión de DisplayPort de la mesa Ideum → define si el refresh es 30 Hz o 60 Hz.
- Electron vs. relay Node + WebSocket → pendiente de soporte de Ideum (dependencia de
  DOM de los bindings de Node para registrar puntos de contacto).
- Diámetro real del marcador (`MARKER_DIAMETER_MM`, hoy 110 mm de supuesto). Toda la
  geometría de la corona depende de ese número.
- IDs reales de fiduciales en Tangible Engine, incluido el del guía.
- Escalado de Windows fijo en 100%.

## Numeración: los documentos no coinciden con los ejes

Los documentos de Bruno están numerados como *módulos* y no coinciden con la numeración
de ejes del pliego. Vale la pena tenerlo a mano:

| Documento | Eje en la app |
|---|---|
| Módulo 1 · Qué es el antisemitismo | *sin eje asignado* |
| Módulo 2 · Quiénes son los judíos | eje 1 |
| Módulo 3 · Mitos antisemitas | eje 3 |
| Módulo 4 · Políticas estatales | eje 4 |
| Módulo 5 · Antisemitismo en redes | eje 6 *(documento vacío)* |
| Módulo 6 · Antisionismo | eje 5 |
| Módulo 7 · Negacionismo | eje 7 |
| Módulo 8 · 7 de octubre | eje 8 |

El eje 2 (Orígenes y evolución) y el eje 9 (Aportes judíos) del pliego no tienen
documento propio.

## Contenido

Los nueve ejes y sus modos salen del pliego. Los textos de bajada son propuestas de
diseño para que Bruno valide, no decisiones curatoriales.

El **eje 3** tiene sus dos piezas montadas, con el contenido de `eje3.html`:
`src/modules/Fabricar.js` y `src/modules/LineaTiempo.js`, con los datos en
`src/content/es/eje3.json` (4 crisis × 9 combinaciones, 9 mitos).

Las dos secciones son hijos del eje en el submenú de la corona, no pestañas adentro de
la pieza. Un nodo que lleva `"module"` en el JSON no abre submenú: monta la pieza que
esté registrada con ese id en `src/modules/index.js`. Adentro de la pieza el marcador no
hace nada; se sale con Volver.

**El marcador define un lado, no un punto.** La pieza ocupa el lado opuesto al marcador,
con una columna reservada de 680 px (`MARKER_COLUMN_W`) para el objeto y su Volver. Son
dos estados espejados —`data-marker-side` en el cuadrante— y no un layout distinto por
cada posición posible. Hay una banda muerta entre el 42% y el 58% del ancho para que no
salte solo. Área útil resultante: 1088 × 880.

Si el marcador queda parado en el medio, el contenido se atenúa y aparece *Corré el
marcador a un costado*. Es lo que enseña dónde va el objeto sin ponerle un cartel de
instrucciones.

**Dormancia.** La gente no arrastra: levanta el objeto y lo vuelve a apoyar. Perder el
recorrido por eso sería un castigo absurdo, así que un cuadrante que se queda sin
marcador no se resetea: queda dormido durante `QUADRANT_GRACE_MS` (12 s) con el estado
guardado, y lo retoma si vuelve un marcador. Recién después se libera.

El **eje 1** usa `src/modules/Combinar.js` con los datos en
`src/content/es/eje1.json`: cinco preguntas, 2.304 personas posibles. La cuenta sale de
multiplicar las opciones reales del contenido, así que si Bruno cambia las listas el
número se ajusta solo.

Es la única pieza donde el marcador trabaja adentro del contenido, y es coherente con la
gramática: las opciones de un eje son hermanas, y la rosca recorre hermanas. `Quadrant`
le reenvía el giro a la pieza cuando la pieza expone `applyRotation`; si no lo expone, el
giro se descarta y la corona oculta no lo consume. Al desmontar la pieza, la corona
rebasa su acumulador para no pegar un salto.

Las listas de **corriente**, **origen** y **cómo lo vive** son de Bruno, textuales. Las de
**lengua** y **política** las escribí yo y están marcadas con `"propuesta": true` en el
JSON: son diez palabras que tiene que definir él.

El **eje 9** usa `src/modules/Explorar.js` con los datos en
`src/content/es/eje9.json`: ocho personas con bio corta y hueco de imagen. **No hay
documento de Bruno para este eje**: las ocho biografías las escribí yo y necesitan su
verificación antes de cualquier presentación.

Es la única pieza donde el marcador se usa como **posición** y no como giro: el objeto se
desliza por un riel vertical en su propia columna y arrastra la selección. Se eligió el
eje vertical porque el horizontal ya está ocupado —la posición en X decide de qué lado va
el contenido—; a lo alto quedan ~735 px libres, una parada cada 105 px. El riel se ancla
contra `--marker-x` con los mismos offsets que `.modulo__body`, así cae exactamente sobre
el objeto.

Una pieza puede exponer `applyRotation` y/o `applyPosition`; `Quadrant` llama las que
existan. Girar y tocar hacen lo mismo que deslizar: el gesto nuevo es una mejora, no un
requisito.

El **eje 4** usa `src/modules/Recorrer.js` con los datos en
`src/content/es/eje4.json`: cuatro pasos, veinte medidas. Los cuatro tiempos son los que
nombra el propio documento —*primero identifican, luego restringen, lo separan del resto
de la sociedad y finalmente facilitan formas más extremas*—, no una cronología. El
documento tiene dos fechas en todo el texto, así que no da para una línea de tiempo; las
dos que hay (1933 y Núremberg, 15/09/1935) van colgadas de las medidas donde él las
pone.

Lo que hace el módulo es no dejar que lo anterior se vaya: la pila de la derecha crece
con cada paso, lo recién sumado entra escalonado y a opacidad plena, lo viejo se atenúa
pero queda. Al final la pila entera ocupa la pantalla. Ir para atrás des-apila, porque
el mecanismo tiene que poder verse en los dos sentidos.

El **eje 7** usa `src/modules/Decidir.js` con los datos en `src/content/es/eje7.json`:
ocho afirmaciones para clasificar en Negación, Distorsión o Banalización, cada una con
el caso que la origina y su devolución, todo tomado del documento de Bruno.

`Decidir` es el modo del pliego y no sabe de qué eje se trata: recibe categorías y casos.
Los ejes 1, 2 y 6 también arrancan con opción múltiple y lo van a reutilizar.

El caso aparece recién en la devolución, no antes de responder: si se mostrara primero,
la respuesta vendría servida. No hay puntaje ni felicitación — qué elegiste, cuál era, y
por qué.

El **eje 8** usa `src/modules/Lugares.js` con los datos en
`src/content/es/eje8.json`: seis lugares con sus tres capas —antes, durante, después—,
todo del documento, más las cuatro historias personales que él incluye. Abre con la
advertencia de contenido que el propio documento pide, y con salida.

Dos gestos sobre el mismo objeto. **Vertical**: elegir el lugar, con freno — la ficha se
abre recién cuando el marcador se queda quieto y el aro alrededor completa la vuelta, así
que no se pueden pasar seis lugares de un tirón. **Horizontal**: con la ficha abierta, el
marcador es el mango de una cortina que revela el antes y el después del mismo lugar, y
el texto sigue al lado que ocupe más de la mitad.

Es la única pieza que declara `layout = 'full'`: necesita el ancho completo y que el
contenido no se reacomode cuando el marcador cruza el centro. `Quadrant` lo lee, congela
`data-marker-side` y desactiva el aviso de *corré el marcador a un costado*.

`src/modules/Vidas.js` (`eje8-vidas.json`) es *Detrás de cada cifra*: mosaico de
retratos, seis personas nombradas en el documento, con los campos que él pide. Los que
faltan se muestran vacíos en vez de ocultarse — el hueco es lo que hay que ir a buscar a
las familias.

`src/modules/Espera.js` (`eje8-espera.json`) es *La incertidumbre de las familias*, y es
el único módulo que **resta**. En el resto avanzar suma; acá el tiempo pasa y la pantalla
tiene cada vez menos. Los siete canales para averiguar algo se apagan uno por uno —las
filas colapsan a cero, no quedan tachadas— y las preguntas sin respuesta ocupan el lugar
que dejan. Se termina con un canal y ocho preguntas.

La cronología del día y *Cómo sabemos lo que sabemos* quedan pendientes.

**Ejes en desarrollo.** Los ejes 2, 5 y 6 llevan `"estado": "pendiente"` en el JSON:
no tienen submenú ni módulo, el punto de la órbita se ve apagado, el panel va atenuado y
el botón dice *En desarrollo* y no entra. De un vistazo se distingue lo terminado de lo
que falta. Sacar el flag es lo único que hace falta cuando la pieza esté lista. Los ejes 5, 7 y 8 están con
placeholders: el 5 y el 7 esperan definición editorial, y el 8 son historias de personas
reales, así que no se inventan nombres.
