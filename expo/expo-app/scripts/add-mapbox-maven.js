#!/usr/bin/env node

/**
 * Script to add Mapbox Maven repository to Android build.gradle
 * This runs after expo prebuild on EAS Build
 */

const fs = require('fs');
const path = require('path');

const BUILD_GRADLE = path.join(__dirname, '..', 'android', 'build.gradle');

console.log('[add-mapbox-maven] Checking for build.gradle...');

if (!fs.existsSync(BUILD_GRADLE)) {
  console.log('[add-mapbox-maven] build.gradle not found, skipping');
  process.exit(0);
}

let contents = fs.readFileSync(BUILD_GRADLE, 'utf-8');

// Check if already added
if (contents.includes('api.mapbox.com')) {
  console.log('[add-mapbox-maven] Mapbox Maven repository already exists');
  process.exit(0);
}

console.log('[add-mapbox-maven] Adding Mapbox Maven repository...');

const mapboxRepo = `
    // Mapbox Maven Repository
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication {
        basic(BasicAuthentication)
      }
      credentials {
        username = "mapbox"
        password = System.getenv("MAPBOX_DOWNLOADS_TOKEN") ?: ""
      }
    }`;

// Add after jitpack
if (contents.includes("maven { url 'https://www.jitpack.io' }")) {
  contents = contents.replace(
    "maven { url 'https://www.jitpack.io' }",
    `maven { url 'https://www.jitpack.io' }${mapboxRepo}`
  );
  console.log('[add-mapbox-maven] Added after jitpack');
} else if (contents.includes('mavenCentral()')) {
  // Find mavenCentral in allprojects and add after it
  const allprojectsMatch = contents.match(/allprojects\s*\{[\s\S]*?mavenCentral\(\)/);
  if (allprojectsMatch) {
    const matchEnd = contents.indexOf(allprojectsMatch[0]) + allprojectsMatch[0].length;
    contents = contents.slice(0, matchEnd) + mapboxRepo + contents.slice(matchEnd);
    console.log('[add-mapbox-maven] Added after mavenCentral');
  }
}

fs.writeFileSync(BUILD_GRADLE, contents, 'utf-8');
console.log('[add-mapbox-maven] Successfully updated build.gradle');
console.log('[add-mapbox-maven] Contents:');
console.log(contents);

