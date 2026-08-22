ARCHIPIÉLAGO VIVO TV — compartir definitivo

Comportamiento:
- Comparte texto contextual + URL de Archipiélago Vivo TV.
- Conserva el canal mediante ?channel=...
- No comparte enlaces a YouTube.
- No adjunta miniaturas ni archivos.
- No usa la propiedad url separada en navigator.share().
- La imagen social proviene de Open Graph:
  https://tv.archipielagovivo.org/logo-social-1200x630.png

Ejemplo:
Estoy viendo [contenido] sobre [programa] en Archipiélago Vivo TV
https://tv.archipielagovivo.org/?channel=general

Las promociones de entidad mantienen:
Estoy viendo la presentación de [Entidad] en Archipiélago Vivo TV
https://tv.archipielagovivo.org/?channel=...

Fallback:
1. Web Share API
2. portapapeles
3. prompt

El paquete conserva:
- fix de medianoche
- sonido inicial ON y persistente al cambiar de canal
- anti-repetición consecutiva
- index SEO definitivo
- robots.txt
- sitemap.xml
- structured-data.jsonld
