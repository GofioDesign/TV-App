package org.gofiodesign.tvapp.androidtv.playback

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession

/**
 * Native playback foundation for direct/HLS-compatible media.
 *
 * Provider-specific playback policy stays outside this class. The TV App feed
 * decides what should be on air; this class only owns the Android player/session.
 */
class PlaybackSession(context: Context) {

    val player: ExoPlayer = ExoPlayer.Builder(context).build()
    val mediaSession: MediaSession = MediaSession.Builder(context, player).build()

    fun play(url: String, startPositionMs: Long = 0L) {
        val item = MediaItem.fromUri(url)
        player.setMediaItem(item, startPositionMs)
        player.prepare()
        player.playWhenReady = true
    }

    fun pause() {
        player.pause()
    }

    fun release() {
        mediaSession.release()
        player.release()
    }
}
