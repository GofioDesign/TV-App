ARCHIPIÉLAGO VIVO TV — FIX FRANJAS QUE TERMINAN A 00:00

Problema encontrado:
- timeToSeconds("00:00") devuelve 0, correctamente para el INICIO del día.
- Pero el motor usaba también ese 0 cuando "00:00" era el FIN de una franja.
- Por tanto una franja como 22:00 -> 00:00 se evaluaba como 79200 -> 0
  y nunca podía estar activa.
- Esto provocaba "Programación en preparación" en los canales cuya última
  franja del día terminaba a medianoche.

Corrección:
- Nueva función scheduleEndToSeconds(start, end).
- Si end == "00:00" y start > "00:00", el final se interpreta como 86400
  segundos, equivalente a 24:00.
- "00:00" como hora de INICIO sigue siendo 0 y no cambia.
- También se aplica la misma normalización a los intervalos globales.

Ejemplos:
- 00:00 -> 04:00 = 0 -> 14400
- 21:00 -> 00:00 = 75600 -> 86400
- 22:00 -> 00:00 = 79200 -> 86400
- 23:00 -> 00:00 = 82800 -> 86400
