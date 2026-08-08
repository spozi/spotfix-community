import groovy.json.JsonSlurper
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose.compiler)
}

abstract class ValidateReleaseSigningTask : DefaultTask() {
    @get:Input
    abstract val releaseSigningConfigured: Property<Boolean>

    @TaskAction
    fun validate() {
        if (!releaseSigningConfigured.get()) {
            throw GradleException(
                "Release signing is required. Set spotfixReleaseStoreFile, " +
                    "spotfixReleaseStorePassword, spotfixReleaseKeyAlias, and " +
                    "spotfixReleaseKeyPassword, or the matching SPOTFIX_RELEASE_* env vars."
            )
        }
    }
}

val releaseStoreFilePath = providers.gradleProperty("spotfixReleaseStoreFile").orNull
    ?: System.getenv("SPOTFIX_RELEASE_STORE_FILE")
    ?: "../spotfix-community-release.keystore"
val releaseStorePassword = providers.gradleProperty("spotfixReleaseStorePassword").orNull
    ?: System.getenv("SPOTFIX_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = providers.gradleProperty("spotfixReleaseKeyAlias").orNull
    ?: System.getenv("SPOTFIX_RELEASE_KEY_ALIAS")
val releaseKeyPassword = providers.gradleProperty("spotfixReleaseKeyPassword").orNull
    ?: System.getenv("SPOTFIX_RELEASE_KEY_PASSWORD")
val releaseKeystoreFile = file(releaseStoreFilePath)
val hasReleaseSigning = releaseKeystoreFile.exists() &&
    !releaseStorePassword.isNullOrBlank() &&
    !releaseKeyAlias.isNullOrBlank() &&
    !releaseKeyPassword.isNullOrBlank()
val validateReleaseSigning = tasks.register<ValidateReleaseSigningTask>("validateSpotFixReleaseSigning") {
    releaseSigningConfigured.set(hasReleaseSigning)
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseSigning)
}

fun googleServicesValue(key: String): String? {
    val googleServicesFile = file("google-services.json")
    if (!googleServicesFile.exists()) {
        return null
    }

    val root = JsonSlurper().parse(googleServicesFile) as? Map<*, *> ?: return null
    val projectInfo = root["project_info"] as? Map<*, *>
    val clients = root["client"] as? List<*> ?: emptyList<Any>()
    val client = clients
        .mapNotNull { it as? Map<*, *> }
        .firstOrNull {
            val clientInfo = it["client_info"] as? Map<*, *> ?: return@firstOrNull false
            val androidClientInfo = clientInfo["android_client_info"] as? Map<*, *> ?: return@firstOrNull false
            androidClientInfo["package_name"] == "org.spotfix.community"
        }
        ?: clients.firstOrNull() as? Map<*, *>
        ?: return null
    val clientInfo = client["client_info"] as? Map<*, *>
    val apiKey = (client["api_key"] as? List<*>)
        ?.mapNotNull { it as? Map<*, *> }
        ?.firstOrNull()
        ?.get("current_key") as? String

    return when (key) {
        "appId" -> clientInfo?.get("mobilesdk_app_id") as? String
        "apiKey" -> apiKey
        "projectId" -> projectInfo?.get("project_id") as? String
        "senderId" -> projectInfo?.get("project_number") as? String
        else -> null
    }
}

android {
    namespace = "org.spotfix.community"
    compileSdk = 36
    testBuildType = "debug"

    defaultConfig {
        applicationId = "org.spotfix.community"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        vectorDrawables {
            useSupportLibrary = true
        }

        // Manifest placeholders mirror iOS Info.plist keys.
        // Override per-build via -PspotfixApiBaseUrl=… etc.
        manifestPlaceholders["spotfixApiBaseUrl"] =
            providers.gradleProperty("spotfixApiBaseUrl").orNull
                ?: "http://10.0.2.2:5001/api/v1"
        manifestPlaceholders["spotfixTenantSlug"] =
            providers.gradleProperty("spotfixTenantSlug").orNull ?: "example-campus"
        manifestPlaceholders["spotfixGoogleClientId"] =
            providers.gradleProperty("SPOTFIX_GOOGLE_CLIENT_ID").orNull
                ?: providers.gradleProperty("spotfixGoogleClientId").orNull
                ?: ""
        manifestPlaceholders["spotfixFirebaseAppId"] =
            providers.gradleProperty("spotfixFirebaseAppId").orNull
                ?: googleServicesValue("appId")
                ?: ""
        manifestPlaceholders["spotfixFirebaseApiKey"] =
            providers.gradleProperty("spotfixFirebaseApiKey").orNull
                ?: googleServicesValue("apiKey")
                ?: ""
        manifestPlaceholders["spotfixFirebaseProjectId"] =
            providers.gradleProperty("spotfixFirebaseProjectId").orNull
                ?: googleServicesValue("projectId")
                ?: ""
        manifestPlaceholders["spotfixFirebaseSenderId"] =
            providers.gradleProperty("spotfixFirebaseSenderId").orNull
                ?: googleServicesValue("senderId")
                ?: ""
    }
    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseKeystoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs["release"]
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs = freeCompilerArgs + listOf(
            "-opt-in=kotlin.RequiresOptIn",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.security.crypto)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.coil.compose)
    implementation(libs.play.services.location)
    implementation(libs.osmdroid.android)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging.ktx)

    // Google Sign-In via AndroidX Credential Manager + Sign in with Google helper.
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)

    testImplementation(libs.junit)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
