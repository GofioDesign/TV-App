ARCHIPIÉLAGO VIVO TV — compartir + enlace de vídeo

Cambios incluidos:
- Botón "Compartir" propio en la esquina inferior izquierda,
  situado por encima del control visual de YouTube.
- Usa Web Share API cuando está disponible.
- Fallback: copia texto + enlace al portapapeles.
- El enlace compartido apunta al canal de Archipiélago Vivo TV:
  https://tv.archipielagovivo.org/?channel=<canal>
- Texto:
  "Estoy viendo {emisión} sobre {tema} en Archipiélago Vivo TV"
- {emisión} = título del contenido actual.
- {tema} = nombre del programa; si falta, nombre del canal.
- El título "Ahora" de la ficha de información abre el vídeo original
  en YouTube en una pestaña nueva.
- URL YouTube con autoplay=0.
- Evento analítico preparado: tv_share.

Archivos:
- app.js
- index.html
- tv-info.css

Sustituir los tres archivos en el repo TV.
