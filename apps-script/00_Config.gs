/**
 * TV App · BACKEND CONFIGURATION AND SCHEMA
 *
 * Instance-specific values come from TV_INSTANCE, generated from the
 * selected app.config.json. This file contains the stable TV App schema
 * and engine-level defaults only.
 */

const TV = Object.freeze({
  NAME: TV_INSTANCE.NAME,
  MENU_NAME: TV_INSTANCE.MENU_NAME,
  DATABASE_NAME: TV_INSTANCE.DATABASE_NAME,
  SCHEMA_VERSION: 2,
  TIMEZONE: TV_INSTANCE.TIMEZONE,
  PUBLIC_FEED_TARGET: TV_INSTANCE.PUBLIC_FEED_TARGET,

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

  DEFAULT_CHANNEL_ID: TV_INSTANCE.DEFAULT_CHANNEL_ID,
  ENTITY_PROGRAM_ID: TV_INSTANCE.ENTITY_PROGRAM_ID,
  DEFAULT_STATUS: TV_INSTANCE.DEFAULT_STATUS,
  REQUEST_PENDING_STATUS: TV_INSTANCE.REQUEST_PENDING_STATUS,

  MEDIA_STATUS_ACTIVE: TV_INSTANCE.MEDIA_STATUS_ACTIVE,
  MEDIA_STATUS_INACTIVE: TV_INSTANCE.MEDIA_STATUS_INACTIVE,
  MEDIA_STATUS_RETIRED: TV_INSTANCE.MEDIA_STATUS_RETIRED,
  MEDIA_STATUS_PENDING_REVIEW: TV_INSTANCE.MEDIA_STATUS_PENDING_REVIEW,

  // Legacy constant names are kept temporarily for compatibility with the
  // imported entity-sync module. Their values are instance-configurable.
  REVIEW_REASON_ORPHANED_MAP_RELATION: TV_INSTANCE.ORPHANED_RELATION_REASON,
  MAP_RELATION_TYPE: TV_INSTANCE.ENTITY_RELATION_TYPE,
  MAP_MEDIA_SOURCE: TV_INSTANCE.ENTITY_MEDIA_SOURCE,
  MAP_MEDIA_SOURCES: TV_INSTANCE.ENTITY_MEDIA_SOURCES,

  FRONTEND_SUPPORTED_PROVIDERS: TV_INSTANCE.FRONTEND_SUPPORTED_PROVIDERS,
  PROVIDERS: Object.freeze(['youtube', 'vimeo', 'peertube', 'direct']),
  EXTERNAL_RIGHTS_ALLOWED: TV_INSTANCE.EXTERNAL_RIGHTS_ALLOWED,
  NEW_ENTITY_HOURS: TV_INSTANCE.NEW_ENTITY_HOURS,

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

  // Only these _tv_media fields may be modified by technical provider
  // adapters. Editorial fields remain deliberately outside this list.
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
