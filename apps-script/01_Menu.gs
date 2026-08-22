/** ARCHIPIÉLAGO VIVO TV · MENÚ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Archipiélago Vivo TV')
    .addItem('Configurar / validar proyecto', 'setupTvProject')
    .addItem('Instalar / actualizar activadores', 'installTvTriggers')
    .addSeparator()
    .addItem('Solicitudes · Sincronizar Form_Responses', 'syncTvRequests')
    .addItem('Solicitudes · Crear media desde propuesta seleccionada', 'createMediaFromSelectedTvProposal')
    .addItem('Solicitudes · Marcar seleccionada en revisión', 'markSelectedTvRequestInReview')
    .addItem('Solicitudes · Marcar seleccionada resuelta', 'markSelectedTvRequestResolved')
    .addSeparator()
    .addItem('Entidades · Sincronizar fuente pública', 'syncTvEntities')
    .addItem('Entidades · Configurar URL de origen', 'promptTvEntitiesSourceUrl')
    .addSeparator()
    .addItem('Media · Normalizar identidades y URLs', 'normalizeTvMediaProviders')
    .addItem('Media · Actualizar metadatos', 'refreshTvMediaMetadata')
    .addItem('Media · Actualizar solo YouTube', 'refreshTvMediaYouTubeMetadata')
    .addItem('Media · Diagnosticar YouTube no embebible', 'diagnoseTvYouTubeEmbeddability')
    .addSeparator()
    .addItem('Validar estructura y referencias', 'showTvValidation')
    .addItem('Export · Resumen', 'showTvExportSummary')
    .addItem('Export · Ver URLs', 'showTvExportUrls')
    .addToUi();
}
