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

class MainActivity : ComponentActivity() {

    private val requestedChannel = mutableStateOf<String?>(null)
    private val instanceConfig = mutableStateOf<InstanceConfig?>(null)
    private val configurationError = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedChannel.value = resolveChannel(intent)

        runCatching { InstanceConfigLoader.load(this) }
            .onSuccess { instanceConfig.value = it }
            .onFailure { configurationError.value = it.message ?: it.toString() }

        setContent {
            val config = instanceConfig.value
            val selectedChannel = requestedChannel.value
                ?: config?.defaultChannel

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
                        Text(text = "Channel: ${selectedChannel ?: config.defaultChannel}")
                        Text(text = "Feed: ${config.feedUrl}")
                        Text(text = "Providers: ${config.providers.joinToString()}")
                        Text(text = "Next: fetch feed.json and resolve the current broadcast.")
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

    private fun resolveChannel(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme != "tvapp" || uri.host != "channel") return null
        return uri.pathSegments.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() }
    }
}
