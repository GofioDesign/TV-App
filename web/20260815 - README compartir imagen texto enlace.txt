ARCHIPIÉLAGO VIVO TV — compartir imagen + mensaje + enlace

Problema:
- El share estaba enviando URL separada.
- Algunos destinos priorizan la URL y muestran sólo el enlace.
- La versión anterior todavía no incluía un File real con la miniatura.

Solución:
1. Se obtiene media.thumbnail.
2. Fallback de miniatura:
   https://i.ytimg.com/vi/{youtube_id}/maxresdefault.jpg
3. La imagen se descarga como Blob y se convierte en File.
4. Se comprueba:
   navigator.canShare({ files: [file] })
5. Si está soportado se comparte:
   - files: [miniatura]
   - text: mensaje + salto de línea + enlace
   - title
6. NO se manda url como propiedad separada.
7. Si compartir archivos no está soportado:
   - comparte mensaje + enlace como text.
8. Últimos fallbacks:
   - portapapeles
   - prompt

Debug ?debug=1:
- share_image
- share_files_support
- share_files_error
- share_text_error

Nota:
La Web Share API y los destinos nativos pueden comportarse de forma distinta
según navegador, Android/iOS y aplicación receptora. La aplicación ahora
entrega conjuntamente imagen + cuerpo de texto siempre que el navegador
declare soporte para compartir archivos.
