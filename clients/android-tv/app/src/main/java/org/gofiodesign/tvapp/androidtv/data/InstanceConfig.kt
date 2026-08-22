package org.gofiodesign.tvapp.androidtv.data

import android.content.Context
import org.json.JSONObject

data class InstanceConfig(
    val schemaVersion: Int,
    val instanceId: String,
    val name: String,
    val shortName: String,
    val timezone: String,
    val defaultChannel: String,
    val feedUrl: String,
    val providers: List<String>
)

object InstanceConfigLoader {

    fun load(context: Context): InstanceConfig {
        val raw = context.assets.open("app.config.json")
            .bufferedReader()
            .use { it.readText() }
        val json = JSONObject(raw)
        val schemaVersion = json.optInt("schema_version", 0)
        require(schemaVersion >= 2) {
            "TV App Android client requires app.config.json schema_version >= 2"
        }

        val data = json.optJSONObject("data") ?: JSONObject()
        val providerArray = json.optJSONArray("providers")
        val providers = buildList {
            if (providerArray != null) {
                for (index in 0 until providerArray.length()) {
                    providerArray.optString(index)
                        .trim()
                        .takeIf { it.isNotEmpty() }
                        ?.let(::add)
                }
            }
        }

        val instanceId = json.optString("instance_id").trim()
        val name = json.optString("name", "TV App").trim().ifEmpty { "TV App" }
        val feedUrl = data.optString("feed_url").trim()

        require(instanceId.isNotEmpty()) { "instance_id is required" }
        require(feedUrl.isNotEmpty()) { "data.feed_url is required for the Android TV client" }

        return InstanceConfig(
            schemaVersion = schemaVersion,
            instanceId = instanceId,
            name = name,
            shortName = json.optString("short_name", name).trim().ifEmpty { name },
            timezone = json.optString("timezone", "UTC").trim().ifEmpty { "UTC" },
            defaultChannel = json.optString("default_channel", "general").trim().ifEmpty { "general" },
            feedUrl = feedUrl,
            providers = providers
        )
    }
}
