ARCHIPIÉLAGO VIVO TV — información de emisión + pausa live

Archivos:
- app.js
- index.html
- tv-info.css

Implementación:
1. Sustituir app.js por el incluido.
2. Sustituir index.html por el incluido.
3. Añadir tv-info.css a la raíz del repositorio TV.

index.html ya carga:
<link rel="stylesheet" href="tv-info.css">

El botón ⓘ:
- aparece junto a pantalla completa y sonido;
- está deshabilitado cuando no existe una emisión válida;
- muestra canal, programa y título actual;
- muestra descripción si feed.json la proporciona;
- muestra entidad y territorio cuando esos datos existen;
- ofrece "Ver ficha en el mapa" cuando la entidad tiene map_url.

Analítica:
- abrir información: tv_program_info_open
- abrir ficha de entidad desde información:
  tv_entity_open + action_from=program_info

La versión mantiene:
- cortinilla de resincronización;
- buffering y diagnóstico;
- recuperación de fullscreen;
- pausa bloqueada:
  playVideo() inmediato y retorno al live si la pausa persiste.
