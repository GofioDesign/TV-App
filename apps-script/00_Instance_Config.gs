/**
 * TV App · INSTANCE CONFIGURATION
 *
 * This file is generated from app.config.json by scripts/build-instance.js.
 * The values below are safe generic defaults for the reusable engine.
 */

const TV_INSTANCE = Object.freeze({
  NAME: 'TV App',
  MENU_NAME: 'TV App',
  DATABASE_NAME: 'TV App — DB',
  TIMEZONE: 'UTC',
  PUBLIC_FEED_TARGET: '',

  DEFAULT_CHANNEL_ID: 'general',
  ENTITY_PROGRAM_ID: 'entities',
  DEFAULT_STATUS: 'Active',
  REQUEST_PENDING_STATUS: 'Pending',

  MEDIA_STATUS_ACTIVE: 'Active',
  MEDIA_STATUS_INACTIVE: 'Inactive',
  MEDIA_STATUS_RETIRED: 'Retired',
  MEDIA_STATUS_PENDING_REVIEW: 'Pending review',
  ORPHANED_RELATION_REASON: 'orphaned_entity_relation',

  ENTITY_RELATION_TYPE: 'entity_profile',
  ENTITY_MEDIA_SOURCE: 'entity-sync',
  ENTITY_MEDIA_SOURCES: Object.freeze(['entity-sync']),

  EXTERNAL_RIGHTS_ALLOWED: Object.freeze(['embed_only', 'authorized']),
  NEW_ENTITY_HOURS: 72,

  FRONTEND_SUPPORTED_PROVIDERS: Object.freeze([
    'youtube',
    'vimeo',
    'peertube',
    'direct'
  ])
});
