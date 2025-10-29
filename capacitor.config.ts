import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.groumap.yamago',
  appName: 'YamaGo',
  webDir: 'out',
  server: {
    url: 'https://yama-go.vercel.app',
    cleartext: false
  },
  android: { backgroundColor: '#000000' }
};

export default config;
