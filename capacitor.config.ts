import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.groumap.yamago',
  appName: 'YamaGo',
  webDir: 'out',
  server: {
    url: 'https://yama-go.vercel.app',
    cleartext: false
  },
  android: { backgroundColor: '#000000' },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'never'
  }
};

export default config;
