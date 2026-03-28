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
      name: 'How Far (Dev)',
      bundleIdentifier: 'com.howfar.app.dev',
      package: 'com.howfar.app.dev',
    };
  }
  if (IS_PREVIEW) {
    return {
      name: 'How Far (Preview)',
      bundleIdentifier: 'com.howfar.app.preview',
      package: 'com.howfar.app.preview',
    };
  }
  return {
    name: 'How Far',
    bundleIdentifier: 'com.howfar.app',
    package: 'com.howfar.app',
  };
};

const appConfig = getAppConfig();

module.exports = ({ config }) => {
  // Get Google Maps API key from environment
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  return {
    ...config,
    name: appConfig.name,
    slug: 'how-far',
    version: process.env.APP_VERSION || config.version || '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    
    // Splash screen
    splash: {
      image: './assets/splash-icon.png',
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
        // Export compliance - app only uses standard HTTPS (encryption is server-side)
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: ['innbucks', 'schinn.wbpycode'],
        NSLocationWhenInUseUsageDescription: 
          'How Far needs your location to show nearby rides and calculate routes to your destination.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 
          'How Far uses your location to track rides in progress and provide accurate arrival times.',
        NSCameraUsageDescription:
          'How Far needs camera access to scan QR codes for secure payments between riders and drivers.',
        NSPhotoLibraryUsageDescription:
          'How Far may need access to your photos to upload profile pictures.',
        NSMicrophoneUsageDescription:
          'How Far may need microphone access for voice features.',
      },
      config: {
        googleMapsApiKey: googleMapsApiKey,
      },
      associatedDomains: [
        'applinks:howfar.app',
      ],
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
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'VIBRATE',
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
    
    // Plugins - use from app.json and add any dynamic ones
    plugins: [
      ...(config.plugins || []),
    ],
    
    // Extra runtime config (accessible in app)
    extra: {
      appEnv: process.env.APP_ENV || 'production',
      isDevBuild: IS_DEV,
      isPreviewBuild: IS_PREVIEW,
      buildDate: new Date().toISOString(),
      eas: {
        projectId: process.env.EAS_PROJECT_ID || '00b90bb5-eadd-443f-8c0d-3c93a41b2222',
      },
    },
    
    // Update configuration
    updates: {
      enabled: !IS_DEV,
      fallbackToCacheTimeout: 30000,
      url: 'https://u.expo.dev/00b90bb5-eadd-443f-8c0d-3c93a41b2222',
    },
    
    // Runtime version for OTA updates
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};
