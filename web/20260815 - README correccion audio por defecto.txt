ARCHIPIÉLAGO VIVO TV — corrección real del audio por defecto

Problema encontrado en la versión actual:
- soundEnabled empezaba en true.
- Pero onReady() ejecutaba inmediatamente:
    soundEnabled = false;
    player.mute();
- Por eso el canal siempre aparecía silenciado.

Corrección:
- onReady() mantiene soundEnabled = true.
- Ejecuta player.unMute() y player.setVolume(100).
- ensureAutoplay() vuelve a aplicar el estado de audio antes de intentar playVideo().
- El botón muestra "Silenciar" cuando el audio está activado.

Limitación del navegador:
Algunos navegadores pueden bloquear el AUTOPLAY inicial con audio por política propia.
Eso es distinto de que la aplicación lo silencie. Esta versión ya no fuerza el mute.
