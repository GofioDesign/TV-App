package org.gofiodesign.tvapp.androidtv.data

import org.json.JSONArray
import org.json.JSONObject

data class TvChannel(
    val id: String,
    val number: Int?,
    val slug: String,
    val name: String,
    val status: String
)

data class TvProgram(
    val id: String,
    val name: String,
    val status: String
)

data class TvMedia(
    val id: String,
    val provider: String,
    val providerId: String,
    val providerUrl: String,
    val embedUrl: String,
    val title: String,
    val programId: String,
    val channels: List<String>,
    val durationSeconds: Double?,
    val status: String,
    val embeddable: Boolean?
)

data class TvScheduleRow(
    val id: String,
    val channelId: String,
    val days: List<String>,
    val start: String,
    val end: String,
    val programId: String,
    val mediaId: String,
    val selectionRule: String,
    val priority: Int,
    val status: String
)

data class TvFeed(
    val schemaVersion: Int,
    val generatedAt: String,
    val channels: List<TvChannel>,
    val programs: List<TvProgram>,
    val media: List<TvMedia>,
    val schedule: List<TvScheduleRow>
) {
    fun channel(value: String?): TvChannel? {
        val key = value?.trim().orEmpty()
        if (key.isEmpty()) return null
        return channels.firstOrNull {
            it.id.equals(key, ignoreCase = true) ||
                it.slug.equals(key, ignoreCase = true) ||
                it.number?.toString() == key
        }
    }

    companion object {
        fun parse(raw: String): TvFeed {
            val json = JSONObject(raw)
            val schemaVersion = json.optInt("schema_version", 0)
            require(schemaVersion >= 2) {
                "TV App Android client requires feed schema_version >= 2"
            }

            val channelsJson = json.optJSONArray("channels")
                ?: error("feed.channels must be an array")
            val programsJson = json.optJSONArray("programs")
                ?: error("feed.programs must be an array")
            val mediaJson = json.optJSONArray("media")
                ?: error("feed.media must be an array")
            val scheduleJson = json.optJSONArray("schedule")
                ?: error("feed.schedule must be an array")

            val channels = channelsJson.objects().map { item ->
                val id = item.optString("channel_id").trim()
                require(id.isNotEmpty()) { "channel_id is required" }
                TvChannel(
                    id = id,
                    number = item.opt("channel_number")
                        ?.toString()
                        ?.trim()
                        ?.toIntOrNull(),
                    slug = item.optString("slug", id).trim().ifEmpty { id },
                    name = item.optString("name", id).trim().ifEmpty { id },
                    status = item.optString("status").trim()
                )
            }

            val programs = programsJson.objects().map { item ->
                val id = item.optString("program_id").trim()
                require(id.isNotEmpty()) { "program_id is required" }
                TvProgram(
                    id = id,
                    name = item.optString("name", id).trim().ifEmpty { id },
                    status = item.optString("status").trim()
                )
            }

            val media = mediaJson.objects().map { item ->
                val id = item.optString("media_id").trim()
                require(id.isNotEmpty()) { "media_id is required" }
                TvMedia(
                    id = id,
                    provider = item.optString("provider").trim().lowercase(),
                    providerId = item.optString("provider_id").trim(),
                    providerUrl = item.optString("provider_url").trim(),
                    embedUrl = item.optString("embed_url").trim(),
                    title = item.optString("title", id).trim().ifEmpty { id },
                    programId = item.optString("program_id").trim(),
                    channels = splitList(item.opt("channels")),
                    durationSeconds = item.opt("duration_seconds")
                        ?.toString()
                        ?.trim()
                        ?.toDoubleOrNull(),
                    status = item.optString("status").trim(),
                    embeddable = item.opt("embeddable").toNullableBoolean()
                )
            }

            val schedule = scheduleJson.objects().map { item ->
                val id = item.optString("schedule_id").trim()
                require(id.isNotEmpty()) { "schedule_id is required" }
                TvScheduleRow(
                    id = id,
                    channelId = item.optString("channel_id").trim(),
                    days = splitList(item.opt("days")),
                    start = item.optString("start").trim(),
                    end = item.optString("end").trim(),
                    programId = item.optString("program_id").trim(),
                    mediaId = item.optString("media_id").trim(),
                    selectionRule = item.optString("selection_rule").trim(),
                    priority = item.optInt("priority", 0),
                    status = item.optString("status").trim()
                )
            }

            return TvFeed(
                schemaVersion = schemaVersion,
                generatedAt = json.optString("generated_at").trim(),
                channels = channels,
                programs = programs,
                media = media,
                schedule = schedule
            )
        }
    }
}

private fun JSONArray.objects(): List<JSONObject> = buildList {
    for (index in 0 until length()) {
        optJSONObject(index)?.let(::add)
    }
}

private fun splitList(value: Any?): List<String> {
    if (value == null || value == JSONObject.NULL) return emptyList()
    if (value is JSONArray) {
        return buildList {
            for (index in 0 until value.length()) {
                value.optString(index)
                    .trim()
                    .takeIf { it.isNotEmpty() }
                    ?.let(::add)
            }
        }
    }
    return value.toString()
        .split(',', ';', '|')
        .map(String::trim)
        .filter(String::isNotEmpty)
}

private fun Any?.toNullableBoolean(): Boolean? = when (this) {
    null, JSONObject.NULL -> null
    is Boolean -> this
    is Number -> toInt() != 0
    else -> when (toString().trim().lowercase()) {
        "true", "1", "yes", "si", "sí" -> true
        "false", "0", "no" -> false
        else -> null
    }
}
