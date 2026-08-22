# Ajustes UI / continuidad

Implementado sobre la versión multicanal que ya estaba funcionando con el
endpoint estable de Apps Script.

## Cambios
- Navegación:
  - Qué es
  - Ver mapa
  - Agenda
  - Inscripción -> https://inscripcion.archipielagovivo.org
  - Contacto
- El logotipo del header usa `logo.svg`.
- El logotipo del header ya no es un enlace.
- Añadido `favicon.ico` y fallback SVG con `logo.svg`.
- Botón de sonido persistente:
  - Activar sonido
  - Desactivar sonido
- El desplegable de canales muestra:
  - thumbnail de lo que se está emitiendo;
  - número de canal;
  - nombre del canal;
  - programa actual;
  - título actual.
- Continuidad de 30 segundos corregida:
  - detecta los próximos START reales del schedule;
  - muestra el thumbnail del primer vídeo del programa entrante;
  - incluye tanto el canal actual como los otros canales;
  - se oculta durante bloques globales `entity_*`;
  - funciona también al cruzar medianoche.

## Endpoint
Se mantiene:
https://script.google.com/macros/s/AKfycbxcmJ4_kBZKJe9Npa7lQ4kcQzRdEN_j6Xc11zq2T6ak628dgi4VYcGZv3VNVyGr8KLc/exec?export=tv
