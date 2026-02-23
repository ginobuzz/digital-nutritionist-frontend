import type { CapacitorConfig } from '@capacitor/cli';

const HOSTED_WEB_URL = 'https://glockstock.github.io/digital-nutritionist-frontend';
const serverUrlOverride = process.env.CAPACITOR_SERVER_URL?.trim();
const useBundledWeb = process.env.CAPACITOR_USE_BUNDLED_WEB === 'true';

const config: CapacitorConfig = {
  appId: 'com.sundaymornings.app',
  appName: 'Sunday Mornings',
  webDir: 'build',
  ...(useBundledWeb
    ? {}
    : {
        // Default iOS app behavior: load the hosted frontend so FE deploys apply without reinstalling the app.
        server: {
          url: serverUrlOverride || HOSTED_WEB_URL,
          cleartext: false,
        },
      }),
};

export default config;
