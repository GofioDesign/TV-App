package org.gofiodesign.tvapp.androidtv.data

import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class TvFeedRepository(
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
) {
    fun load(
        feedUrl: String,
        onSuccess: (TvFeed) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        executor.execute {
            runCatching { fetch(feedUrl) }
                .onSuccess(onSuccess)
                .onFailure(onError)
        }
    }

    fun close() {
        executor.shutdownNow()
    }

    private fun fetch(feedUrl: String): TvFeed {
        val url = URL(feedUrl)
        require(url.protocol == "https" || url.protocol == "http") {
            "Unsupported feed URL protocol: ${url.protocol}"
        }

        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "TV-App-Android-TV/0.1")
            useCaches = false
        }

        return try {
            val status = connection.responseCode
            require(status in 200..299) {
                "Feed request failed with HTTP $status"
            }
            val body = connection.inputStream
                .bufferedReader(Charsets.UTF_8)
                .use { it.readText() }
            require(body.isNotBlank()) { "Feed response is empty" }
            TvFeed.parse(body)
        } finally {
            connection.disconnect()
        }
    }
}
