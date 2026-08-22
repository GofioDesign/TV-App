package org.gofiodesign.tvapp.androidtv.home

import android.content.Context
import android.net.Uri
import android.os.Build
import androidx.tvprovider.media.tv.PreviewChannel
import androidx.tvprovider.media.tv.PreviewChannelHelper

/**
 * Publishes TV App discovery channels to the Android TV home screen.
 *
 * This surface is available from API 26. TV App's own channels/feed remain the
 * source of truth; Android home channels are a derived discovery view only.
 * Call these methods from a worker thread.
 */
class HomeChannelPublisher(context: Context) {

    private val appContext = context.applicationContext

    fun publishDefaultChannel(
        channelId: String,
        displayName: String,
        description: String = ""
    ): Long? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null

        val channel = PreviewChannel.Builder()
            .setDisplayName(displayName)
            .setDescription(description)
            .setInternalProviderId(channelId)
            .setAppLinkIntentUri(channelDeepLink(channelId))
            .build()

        return PreviewChannelHelper(appContext).publishDefaultChannel(channel)
    }

    private fun channelDeepLink(channelId: String): Uri =
        Uri.parse("tvapp://channel/${Uri.encode(channelId)}")
}
