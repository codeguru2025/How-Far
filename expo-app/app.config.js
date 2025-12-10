/**
 * Expo App Configuration
 * Dynamic configuration based on environment variables
 * 
 * This file extends app.json with dynamic values from environment
 * See: https://docs.expo.dev/workflow/configuration/
 */

const IS_DEV = process.env.APP_ENV === 'development';
const IS_PREVIEW = process.env.APP_ENV === 'preview';
const IS_PROD = process.env.APP_ENV === 'production' || (!IS_DEV && !IS_PREVIEW);

// App identifiers per environment
const getAppConfig = () => {
  if (IS_DEV) {
    return {
      name: 'Ndeip-Zthin (Dev)',
      bundleIdentifier: 'com.ndeip.zthin.dev',
      package: 'com.ndeip.zthin.dev',
    };
  }
  if (IS_PREVIEW) {
    return {
      name: 'Ndeip-Zthin (Preview)',
      bundleIdentifier: 'com.ndeip.zthin.preview',
      package: 'com.ndeip.zthin.preview',
    };
  }
  return {
    name: 'Ndeip-Zthin',
    bundleIdentifier: 'com.ndeip.zthin',
    package: 'com.ndeip.zthin',
  };
};

const appConfig = getAppConfig();

module.exports = ({ config }) => {
  // Get Google Maps API key from environment
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  return {
    ...config,
    name: appConfig.name,
    slug: 'ndeip-zthin',
    version: process.env.APP_VERSION || config.version || '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    
    // Splash screen
    splash: {
      backgroundColor: '#E85A24',
      resizeMode: 'contain',
    },
    
    // iOS configuration
    ios: {
      ...config.ios,
      supportsTablet: true,
      bundleIdentifier: appConfig.bundleIdentifier,
      buildNumber: process.env.BUILD_NUMBER || '1',
      infoPlist: {
        LSApplicationQueriesSchemes: ['innbucks', 'schinn.wbpycode'],
        NSLocationWhenInUseUsageDescription: 
          'This app needs your location to show nearby places and calculate ride routes.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 
          'This app needs your location to track rides in progress.',
        NSCameraUsageDescription:
          'This app needs camera access to scan QR codes for payments.',
      },
      config: {
        googleMapsApiKey: googleMapsApiKey,
      },
    },
    
    // Android configuration
    android: {
      ...config.android,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#E85A24',
      },
      package: appConfig.package,
      versionCode: parseInt(process.env.VERSION_CODE || '1', 10),
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'CAMERA',
      ],
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    
    // Web configuration
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    
    // Plugins
    plugins: [
      'expo-secure-store',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 
            'Allow Ndeip-Zthin to use your location for ride tracking.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Ndeip-Zthin to use your camera to scan QR codes.',
        },
      ],
    ],
    
    // Extra runtime config (accessible in app)
    extra: {
      appEnv: process.env.APP_ENV || 'production',
      isDevBuild: IS_DEV,
      isPreviewBuild: IS_PREVIEW,
      buildDate: new Date().toISOString(),
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'your-eas-project-id',
      },
    },
    
    // Update configuration
    updates: {
      enabled: !IS_DEV,
      fallbackToCacheTimeout: 30000,
      url: 'https://u.expo.dev/your-project-id',
    },
    
    // Runtime version for OTA updates
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};

