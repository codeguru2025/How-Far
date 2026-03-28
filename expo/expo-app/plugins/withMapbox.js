const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Add Mapbox Maven repository to Android build.gradle
 */
const withMapboxMavenRepository = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const buildGradlePath = path.join(projectRoot, 'android', 'build.gradle');

      // Check if file exists
      if (!fs.existsSync(buildGradlePath)) {
        console.warn('[withMapbox] android/build.gradle not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(buildGradlePath, 'utf-8');

      // Check if already added
      if (contents.includes('api.mapbox.com')) {
        console.log('[withMapbox] Mapbox Maven repository already exists');
        return config;
      }

      console.log('[withMapbox] Adding Mapbox Maven repository...');

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
        console.log('[withMapbox] Added after jitpack');
      } else if (contents.includes('mavenCentral()')) {
        // Find allprojects block and add after mavenCentral
        const regex = /(allprojects\s*\{[\s\S]*?)(mavenCentral\(\))/;
        contents = contents.replace(regex, `$1$2${mapboxRepo}`);
        console.log('[withMapbox] Added after mavenCentral');
      }

      fs.writeFileSync(buildGradlePath, contents, 'utf-8');
      console.log('[withMapbox] Successfully updated build.gradle');

      return config;
    },
  ]);
};

module.exports = (config) => {
  return withPlugins(config, [withMapboxMavenRepository]);
};
