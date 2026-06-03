module.exports = {
  expo: {
    name: 'SpendWise',
    slug: 'spendwise',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F172A',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.spendwise.app',
      infoPlist: {
        NSFaceIDUsageDescription: 'SpendWise uses Face ID to keep your financial data secure.',
        UIBackgroundModes: ['fetch'],
      },
    },
    android: {
      package: 'com.spendwise.app',
      adaptiveIcon: {
        backgroundColor: '#0F172A',
      },
      predictiveBackGestureEnabled: true,
    },
    plugins: ['expo-status-bar', 'expo-splash-screen'],
    extra: {
      // Set EXPO_PUBLIC_API_URL env var before building, e.g.:
      //   EXPO_PUBLIC_API_URL=https://your-api.railway.app/api eas build
      apiUrl: process.env.EXPO_PUBLIC_API_URL || null,
      eas: {
        projectId: '87bfe510-a2f7-45a6-847d-22e0b09f45c5',
      },
    },
  },
};
