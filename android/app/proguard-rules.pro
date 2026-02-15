# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep our custom native modules, receivers, and app classes
-keep class com.spense.app.** { *; }

# Keep React Native bridge classes (just in case)
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.common.** { *; }
-keep class com.facebook.react.module.annotations.** { *; }
