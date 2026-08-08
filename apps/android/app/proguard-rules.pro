# Add project specific ProGuard rules here.
# kotlinx.serialization needs the @Serializable classes preserved.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class org.spotfix.community.**$$serializer { *; }
-keepclassmembers class org.spotfix.community.** {
    *** Companion;
}
-keepclasseswithmembers class org.spotfix.community.** {
    kotlinx.serialization.KSerializer serializer(...);
}
