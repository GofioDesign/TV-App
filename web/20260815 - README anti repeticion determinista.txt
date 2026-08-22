ARCHIPIÉLAGO VIVO TV — anti repetición consecutiva determinista

Problema encontrado:
resolveSequence() baraja la lista al comenzar cada nueva vuelta.

Ejemplo posible:
  vuelta 0: A B C
  vuelta 1: C A B

En el límite se emitía:
  ... C -> C ...

aunque existieran otros contenidos.

Corrección:
- Se deduplican candidatos por youtube_id.
- La parrilla sigue siendo completamente determinista.
- No se guarda estado mutable del último vídeo.
- Al generar una nueva vuelta:
  si el primer vídeo coincide con el último de la vuelta anterior,
  se intercambia por el primer candidato diferente.
- Si sólo existe un único vídeo real en el programa, no existe una
  alternativa editorial dentro de ese programa; este fix no inventa
  contenido ajeno ni falsea el nombre del programa.

Ventajas:
- evita repetición consecutiva por frontera de ciclos;
- resolve() sigue siendo puro/determinista;
- abrir menús, calcular continuidad o llamar varias veces a resolve()
  no altera la parrilla;
- duplicados del mismo vídeo bajo media_id distintos tampoco se repiten.

Incluye los fixes previos de la versión base:
- audio persistente entre canales;
- franjas que terminan a medianoche;
- runtime vigente.
