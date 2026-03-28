#!/bin/bash

# Script to add Mapbox Maven repository to Android build.gradle
# This runs after expo prebuild on EAS Build

BUILD_GRADLE="android/build.gradle"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "[add-mapbox-maven] build.gradle not found"
  exit 0
fi

# Check if already added
if grep -q "api.mapbox.com" "$BUILD_GRADLE"; then
  echo "[add-mapbox-maven] Mapbox Maven repository already exists"
  exit 0
fi

echo "[add-mapbox-maven] Adding Mapbox Maven repository..."

# Use awk to insert after jitpack line
awk '/maven \{ url .https:\/\/www\.jitpack\.io. \}/ {
    print
    print "    // Mapbox Maven Repository"
    print "    maven {"
    print "      url '\''https://api.mapbox.com/downloads/v2/releases/maven'\''"
    print "      authentication {"
    print "        basic(BasicAuthentication)"
    print "      }"
    print "      credentials {"
    print "        username = \"mapbox\""
    print "        password = System.getenv(\"MAPBOX_DOWNLOADS_TOKEN\") ?: \"\""
    print "      }"
    print "    }"
    next
}
{print}' "$BUILD_GRADLE" > "$BUILD_GRADLE.tmp" && mv "$BUILD_GRADLE.tmp" "$BUILD_GRADLE"

echo "[add-mapbox-maven] Done!"
cat "$BUILD_GRADLE"
