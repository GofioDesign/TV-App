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

class MainActivity : ComponentActivity() {

    private val requestedChannel = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedChannel.value = resolveChannel(intent)

        setContent {
            MaterialTheme {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                        .padding(48.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "TV App")
                    Text(text = "Native Android TV client foundation")
                    Text(
                        text = requestedChannel.value
                            ?.let { "Requested channel: $it" }
                            ?: "No channel selected yet"
                    )
                    Text(text = "Next: load app.config.json + feed.json and resolve the live broadcast.")
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
