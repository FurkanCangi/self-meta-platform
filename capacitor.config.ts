import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "https://self-meta-platform.vercel.app";

const config: CapacitorConfig = {
  appId: "com.dnaintelligence.app",
  appName: "DNA Intelligence",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
