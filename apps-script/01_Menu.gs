/** TV App · MENU */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(TV.MENU_NAME || TV.NAME || 'TV App')
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
    .addItem('Media · Actualizar metadatos marcados', 'refreshTvMediaMetadata')
    .addItem('Media · Diagnosticar YouTube no embebible', 'diagnoseTvYouTubeEmbeddability')
    .addSeparator()
    .addItem('Validar estructura y referencias', 'showTvValidation')
    .addItem('Export · Resumen', 'showTvExportSummary')
    .addItem('Export · Ver URLs', 'showTvExportUrls')
    .addToUi();
}
