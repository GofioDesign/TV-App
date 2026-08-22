ARCHIPIÉLAGO VIVO TV — estado de sonido persistente entre canales

Comportamiento:
- Al cargar la TV por primera vez:
  soundEnabled = true
  player.unMute()
  player.setVolume(100)

- Si el usuario pulsa "Silenciar":
  soundEnabled = false

- Al cambiar de canal:
  NO se modifica soundEnabled.
  Si estaba true -> nuevo canal sigue con sonido.
  Si estaba false -> nuevo canal sigue silenciado.

- ensureAutoplay() y PLAYING respetan siempre soundEnabled.

- Se mantiene además el fix de franjas que terminan a medianoche.
