ARCHIPIÉLAGO VIVO TV — audio activado al cargar canal

Cambio:
- soundEnabled inicia en true.
- El botón inicial pasa a "Silenciar".
- Al seleccionar/cargar un canal se intenta:
    player.unMute()
    player.setVolume(100)
- Al entrar el vídeo en PLAYING se vuelve a asegurar el audio si soundEnabled=true.
- Si existía playerVars.mute=1, pasa a mute=0.

Nota importante:
Algunos navegadores, WebViews y políticas de autoplay pueden impedir que un vídeo
con audio arranque automáticamente sin interacción previa del usuario.
El código ahora pide audio activado por defecto, pero la política del navegador
puede forzar silencio en el primer arranque. En cuanto el entorno permita audio,
la TV lo mantiene activado.

Incluye además:
- pausa live
- compartir
- compartir específico de entidades
- ficha de información
- enlace al vídeo original
- debug heartbeat 300 s
- cortinillas
- diagnóstico
