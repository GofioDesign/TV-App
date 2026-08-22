package org.gofiodesign.tvapp.androidtv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import org.gofiodesign.tvapp.androidtv.data.InstanceConfig
import org.gofiodesign.tvapp.androidtv.data.InstanceConfigLoader
import org.gofiodesign.tvapp.androidtv.data.TvFeed
import org.gofiodesign.tvapp.androidtv.data.TvFeedRepository

class MainActivity : ComponentActivity() {

    private val requestedChannel = mutableStateOf<String?>(null)
    private val instanceConfig = mutableStateOf<InstanceConfig?>(null)
    private val configurationError = mutableStateOf<String?>(null)
    private val feed = mutableStateOf<TvFeed?>(null)
    private val feedError = mutableStateOf<String?>(null)
    private val feedLoading = mutableStateOf(false)
    private val feedRepository = TvFeedRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedChannel.value = resolveChannel(intent)

        runCatching { InstanceConfigLoader.load(this) }
            .onSuccess { config ->
                instanceConfig.value = config
                loadFeed(config)
            }
            .onFailure { configurationError.value = it.message ?: it.toString() }

        setContent {
            val config = instanceConfig.value
            val currentFeed = feed.value
            val requested = requestedChannel.value
            val selectedChannel = currentFeed?.channel(requested ?: config?.defaultChannel)

            MaterialTheme {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                        .padding(48.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = config?.name ?: "TV App")
                    Text(text = "Native Android TV client")

                    configurationError.value?.let { error ->
                        Text(text = "Configuration error: $error")
                    }

                    if (config != null) {
                        Text(text = "Instance: ${config.instanceId}")
                        Text(text = "Feed: ${config.feedUrl}")
                        Text(text = "Providers: ${config.providers.joinToString()}")
                    }

                    if (feedLoading.value) {
                        Text(text = "Loading TV feed…")
                    }

                    feedError.value?.let { error ->
                        Text(text = "Feed error: $error")
                    }

                    if (currentFeed != null) {
                        Text(text = "Feed schema: ${currentFeed.schemaVersion}")
                        Text(
                            text = "Channels ${currentFeed.channels.size} · " +
                                "Programs ${currentFeed.programs.size} · " +
                                "Media ${currentFeed.media.size} · " +
                                "Schedule ${currentFeed.schedule.size}"
                        )

                        if (selectedChannel != null) {
                            Text(
                                text = buildString {
                                    append("Channel: ")
                                    selectedChannel.number?.let { append("$it · ") }
                                    append(selectedChannel.name)
                                }
                            )
                            Text(text = "Next: resolve the current broadcast for this channel.")
                        } else {
                            Text(
                                text = "Requested channel not found: " +
                                    (requested ?: config?.defaultChannel.orEmpty())
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        requestedChannel.value = resolveChannel(intent)
    }

    override fun onDestroy() {
        feedRepository.close()
        super.onDestroy()
    }

    private fun loadFeed(config: InstanceConfig) {
        feedLoading.value = true
        feedError.value = null
        feedRepository.load(
            feedUrl = config.feedUrl,
            onSuccess = { loaded ->
                runOnUiThread {
                    feed.value = loaded
                    feedLoading.value = false
                }
            },
            onError = { error ->
                runOnUiThread {
                    feedError.value = error.message ?: error.toString()
                    feedLoading.value = false
                }
            }
        )
    }

    private fun resolveChannel(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme != "tvapp" || uri.host != "channel") return null
        return uri.pathSegments.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() }
    }
}
