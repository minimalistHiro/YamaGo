import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

// Firebase configuration - read from environment variables provided by Next.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

type FirebaseClientConfig = typeof firebaseConfig;

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseClientConfig;
  }
}

// Validate Firebase configuration to fail fast if env vars are missing
const requiredKeys: Array<keyof typeof firebaseConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('Firebase configuration is missing required keys:', missingKeys);
  console.error(
    'Please ensure NEXT_PUBLIC_FIREBASE_* environment variables are configured correctly.'
  );
}

const isConfigValid = missingKeys.length === 0;

// Expose config for debugging so DevTools から確認できる
if (typeof window !== 'undefined') {
  window.__FIREBASE_CONFIG__ = firebaseConfig;
  if (process.env.NODE_ENV === 'development') {
    console.log('[YamaGo] Firebase API Key:', firebaseConfig.apiKey);
  }
}

// Client-side only Firebase initialization
// This prevents build-time crashes during SSG when environment variables are missing
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let analytics: Analytics | null = null;
let storage: FirebaseStorage | null = null;

// Initialize Firebase only on the client side
if (typeof window !== 'undefined' && isConfigValid) {
  try {
    // Initialize Firebase app using the recommended pattern
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');

    // Initialize Firebase services
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, 'us-central1');
    storage = getStorage(app);

    // Initialize Analytics only if measurementId is available
    if (firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }

    console.log('Firebase services initialized successfully');

    // Connect to emulators only if explicitly enabled
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
      try {
        // Connect to emulators without checking existing connections
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectFunctionsEmulator(functions, 'localhost', 5001);
        // Storage is using production environment
        console.log('Firebase emulators connected successfully (Storage using production)');
      } catch (error) {
        // Emulators already connected or connection failed
        console.log('Firebase emulators connection:', (error as Error).message || 'Already connected');
      }
    } else {
      console.log('Firebase connected to production environment');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    console.error('This is likely due to invalid Firebase configuration or API key.');
    // Don't throw error during build - just log it
  }
}

// Export services (will be null if not initialized)
export { auth, db, functions, analytics, storage };

// Export app
export default app;

// Helper function to check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => {
  return app !== null && auth !== null && db !== null;
};

// Helper function to get Firebase services with error handling
export const getFirebaseServices = () => {
  if (typeof window === 'undefined') {
    throw new Error('Firebase services can only be accessed on the client side.');
  }
  
  if (!isFirebaseInitialized()) {
    console.error('Firebase initialization check failed:', {
      app: !!app,
      auth: !!auth,
      db: !!db,
      functions: !!functions,
      analytics: !!analytics,
      storage: !!storage,
    });
    throw new Error('Firebase is not initialized. Make sure you are running this code on the client side.');
  }
  
  return {
    auth: auth!,
    db: db!,
    functions: functions!,
    analytics: analytics!,
    storage: storage!,
    app: app!
  };
};
