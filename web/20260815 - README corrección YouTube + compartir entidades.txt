ARCHIPIÉLAGO VIVO TV — corrección YouTube + compartir entidades

Correcciones:
1. Enlace de la ficha de información:
   - URL normal de YouTube:
     https://www.youtube.com/watch?v=<ID>
   - target="_blank"
   - rel="noopener noreferrer"
   - Se elimina autoplay=0, porque ese parámetro corresponde al reproductor
     embebido y no es necesario en la página normal de YouTube.

2. Compartir promos de entidad:
   - Si media.type == "entity" o es un bloque global de entidad,
     usa el nombre real de la entidad.
   - Texto:
     "Estoy viendo la presentación de {Entidad} en Archipiélago Vivo TV"
   - Ya no usa títulos técnicos como "AlmaX Ciudadana 1"
     ni frases como "sobre Archipiélago Vivo".

3. Para contenidos normales se mantiene:
   "Estoy viendo {emisión} sobre {programa} en Archipiélago Vivo TV"

Incluye también:
- pausa live
- compartir
- ficha de información
- enlace robusto a YouTube
- debug heartbeat cada 300 s
- cortinillas
- diagnóstico
