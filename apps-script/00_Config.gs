/**
 * ARCHIPIÉLAGO VIVO TV · CONFIGURACIÓN
 *
 * Proyecto independiente vinculado exclusivamente a
 * "Archipiélago Vivo TV — DB".
 *
 * IMPORTANTE:
 * - No contiene el ID de la BD del Mapa.
 * - No abre ni consulta directamente la hoja del Mapa.
 * - La integración opcional con entidades se hace por una URL pública JSON
 *   guardada en Script Properties (TV_ENTITIES_SOURCE_URL).
 */

const TV = Object.freeze({
  NAME: 'Archipiélago Vivo TV',
  SCHEMA_VERSION: 2,
  TIMEZONE: 'Atlantic/Canary',

  SHEETS: Object.freeze({
    FORM_RESPONSES: 'Form_Responses',
    REQUESTS: '_tv_requests',
    CHANNELS: '_tv_channels',
    PROGRAMS: '_tv_programs',
    MEDIA: '_tv_media',
    ENTITIES: '_tv_entities',
    ENTITY_MEDIA: '_tv_entity_media',
    SCHEDULE: '_tv_schedule'
  }),

  PROPERTIES: Object.freeze({
    SPREADSHEET_ID: 'TV_SPREADSHEET_ID',
    ENTITIES_SOURCE_URL: 'TV_ENTITIES_SOURCE_URL'
  }),

  DEFAULT_CHANNEL_ID: 'general',
  ENTITY_PROGRAM_ID: 'archipielago-vivo',
  DEFAULT_STATUS: 'Activo',
  REQUEST_PENDING_STATUS: 'Pendiente',

  MEDIA_STATUS_ACTIVE: 'Activo',
  MEDIA_STATUS_INACTIVE: 'Inactivo',
  MEDIA_STATUS_RETIRED: 'Retirado',
  MEDIA_STATUS_PENDING_REVIEW: 'Pending review',
  REVIEW_REASON_ORPHANED_MAP_RELATION: 'orphaned_map_relation',
  MAP_RELATION_TYPE: 'map_profile',
  MAP_MEDIA_SOURCE: 'map-sync',
  MAP_MEDIA_SOURCES: Object.freeze(['map-sync', 'entity-sync', 'map']),

  // El frontend actual sigue reproduciendo mediante YouTube IFrame API.
  // Vimeo/PeerTube/direct se exportan, pero no se programan hasta que
  // el frontend incorpore adaptadores de reproducción para esos proveedores.
  FRONTEND_SUPPORTED_PROVIDERS: Object.freeze(['youtube']),

  PROVIDERS: Object.freeze(['youtube', 'vimeo', 'peertube', 'direct']),

  EXTERNAL_RIGHTS_ALLOWED: Object.freeze(['embed_only', 'authorized']),

  NEW_ENTITY_HOURS: 72,

  ROTATION_TIERS: Object.freeze([
    Object.freeze({ max_minutes: 10, full_cycle_hours: 2 }),
    Object.freeze({ max_minutes: 20, full_cycle_hours: 6 }),
    Object.freeze({ max_minutes: 40, full_cycle_hours: 12 }),
    Object.freeze({ max_minutes: 80, full_cycle_hours: 24 }),
    Object.freeze({ max_minutes: 160, full_cycle_hours: 48 }),
    Object.freeze({ max_minutes: 240, full_cycle_hours: 72 }),
    Object.freeze({ max_minutes: 480, full_cycle_hours: 168 }),
    Object.freeze({ max_minutes: 960, full_cycle_hours: 336 }),
    Object.freeze({ max_minutes: null, full_cycle_hours: 720 })
  ]),

  PRESENTATION: Object.freeze({
    program_change_teasers: Object.freeze({
      enabled: true,
      lead_seconds: 30,
      position: 'right',
      show_thumbnail: true,
      show_channel_number: true,
      show_channel_name: true,
      show_program_name: true,
      show_countdown: true,
      suppress_during_global_entity_blocks: true
    })
  }),

  VALID_SELECTION_RULES: Object.freeze([
    'program_rotation',
    'entity_rotation',
    'entity_new',
    'entity_deadline'
  ]),

  REQUEST_FORM_HEADERS: Object.freeze([
    'Timestamp',
    'privacy_acknowledged',
    'request_type',
    'url',
    'provider',
    'title',
    'proposed_program',
    'proposed_channels',
    'territory',
    'submit_reason',
    'proposer_name',
    'proposer_email',
    'removal_reason',
    'removal_relation',
    'removal_requester',
    'removal_email',
    'correction_reason'
  ]),

  REQUEST_HEADERS: Object.freeze([
    'Timestamp',
    'privacy_acknowledged',
    'request_type',
    'url',
    'provider',
    'title',
    'proposed_program',
    'proposed_channels',
    'territory',
    'submit_reason',
    'proposer_name',
    'proposer_email',
    'removal_reason',
    'removal_relation',
    'removal_requester',
    'removal_email',
    'correction_reason',
    'request_id',
    'request_status',
    'reviewed_at',
    'reviewed_by',
    'review_notes',
    'result_media_id',
    'resolved_at'
  ]),

  CHANNEL_HEADERS: Object.freeze([
    'channel_id',
    'channel_number',
    'slug',
    'name',
    'overlay_label',
    'description',
    'status'
  ]),

  PROGRAM_HEADERS: Object.freeze([
    'program_id',
    'name',
    'description',
    'status'
  ]),

  MEDIA_HEADERS: Object.freeze([
    'media_id',
    'provider',
    'provider_id',
    'provider_url',
    'embed_url',
    'title',
    'type',
    'program_id',
    'tv_description',
    'tags',
    'channels',
    'rights_status',
    'source',
    'status',
    'embeddable',
    'privacy_status',
    'description',
    'channel_title',
    'thumbnail',
    'published_at',
    'youtube_tags',
    'duration_seconds',
    'youtube_license',
    'metadata_updated_at',
    'review_note',
    'review_reason',
    'review_requested_at',
    'reviewed_at',
    'reviewed_by',
    'refresh_metadata',
    'metadata_refresh_error'
  ]),

  MEDIA_REVIEW_HEADERS: Object.freeze([
    'review_note',
    'review_reason',
    'review_requested_at',
    'reviewed_at',
    'reviewed_by'
  ]),

  ENTITY_HEADERS: Object.freeze([
    'entity_id',
    'name',
    'map_url',
    'island',
    'municipality',
    'img',
    'status',
    'source_updated_at',
    'synced_at'
  ]),

  ENTITY_MEDIA_HEADERS: Object.freeze([
    'entity_id',
    'media_id',
    'relation_type',
    'is_primary',
    'status'
  ]),

  SCHEDULE_HEADERS: Object.freeze([
    'schedule_id',
    'channel_id',
    'days',
    'start',
    'end',
    'program_id',
    'media_id',
    'selection_rule',
    'max_duration_minutes',
    'priority',
    'valid_from',
    'valid_to',
    'status'
  ]),

  // Únicas columnas de _tv_media que un adaptador técnico puede modificar.
  // Los campos curatoriales quedan fuera deliberadamente.
  MEDIA_TECHNICAL_PATCH_FIELDS: Object.freeze([
    'provider',
    'provider_id',
    'provider_url',
    'embed_url',
    'title',
    'embeddable',
    'privacy_status',
    'description',
    'channel_title',
    'thumbnail',
    'published_at',
    'youtube_tags',
    'duration_seconds',
    'youtube_license',
    'metadata_updated_at',
    'refresh_metadata',
    'metadata_refresh_error'
  ])
});
