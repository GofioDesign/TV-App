ARCHIPIÉLAGO VIVO TV — corrección enlace vídeo original

Corrección:
- infoMediaLink ya NO nace con href="#".
- Esto evita que analytics.js convierta el enlace provisional en la propia URL
  de tv.archipielagovivo.org con av_session / av_entry.
- app.js construye la URL original de YouTube a partir de:
  1. media.youtube_id
  2. currentVideoId
  3. player.getVideoData().video_id
- URL resultante:
  https://www.youtube.com/watch?v=<ID>&autoplay=0
- target="_blank"
- rel="noopener noreferrer"
- Si no existe un ID real, el título se muestra pero NO se convierte en enlace.
- Al entrar el reproductor en PLAYING se refresca también la ficha de información.

Incluye además todos los cambios anteriores:
- pausa live
- compartir
- ficha de información
- debug heartbeat 300 s
- cortinillas
- diagnóstico
