import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the deployed Harmony web app in a native Android WebView.
 *
 * Because the frontend is a server-rendered Next.js app (not a static export),
 * the APK loads the app from a remote URL rather than bundling assets.
 *
 * Set the URL before syncing/building:
 *   - Production (works anywhere):  HARMONY_MOBILE_URL=https://your-app.vercel.app
 *   - Same Wi-Fi testing:          HARMONY_MOBILE_URL=http://192.168.1.20:3000
 *
 * Then run:  pnpm --filter @harmony/web cap:sync
 */
const serverUrl = process.env.HARMONY_MOBILE_URL?.trim() || '';
const isCleartext = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.harmony.music',
  appName: 'Harmony',
  // Placeholder local assets shown only if no remote URL is configured.
  webDir: 'mobile-shell',
  server: serverUrl
    ? {
        url: serverUrl,
        // Allow plain HTTP only for LAN testing; production should be HTTPS.
        cleartext: isCleartext,
        androidScheme: isCleartext ? 'http' : 'https',
      }
    : {
        androidScheme: 'https',
      },
  android: {
    // Keep the WebView background dark to match the app theme during load.
    backgroundColor: '#0a0a0c',
  },
};

export default config;
