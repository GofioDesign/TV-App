plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val tvAppConfig = providers.gradleProperty("tvAppConfig")
    .orElse("../../web/config.json")
val generatedTvAppAssets = layout.buildDirectory.dir("generated/tvapp/assets")

val generateTvAppInstanceConfig by tasks.registering(Copy::class) {
    from(rootProject.file(tvAppConfig.get()))
    into(generatedTvAppAssets)
    rename { "app.config.json" }
}

android {
    namespace = "org.gofiodesign.tvapp.androidtv"
    compileSdk = 37

    defaultConfig {
        applicationId = "org.gofiodesign.tvapp.androidtv"
        minSdk = 21
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    sourceSets.getByName("main").assets.srcDir(generatedTvAppAssets)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.named("preBuild").configure {
    dependsOn(generateTvAppInstanceConfig)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.08.00")
    implementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.tv:tv-material:1.1.0")

    val media3Version = "1.11.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")

    implementation("androidx.tvprovider:tvprovider:1.1.0")
}
