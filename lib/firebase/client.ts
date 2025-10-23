import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

// Firebase configuration - use consistent config for all environments
// This ensures the same configuration is used regardless of environment variables
// Version: v2.0 - Fixed API key validation issue
const firebaseConfig = {
  apiKey: 'AIzaSyC00i-DxjmLQz82xiubMkpfotc-k6MBuEI',
  authDomain: 'yamago-2ae8d.firebaseapp.com',
  projectId: 'yamago-2ae8d',
  storageBucket: 'yamago-2ae8d.firebasestorage.app',
  messagingSenderId: '598692971255',
  appId: '1:598692971255:web:9f5977110f979b13e609f2',
  measurementId: 'G-NL6CP18NNK'
};

// Debug logging for Firebase configuration
console.log('=== FIREBASE CONFIG DEBUG v2.0 ===');
console.log('Environment:', process.env.NODE_ENV);
console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...${firebaseConfig.apiKey.substring(firebaseConfig.apiKey.length - 3)}` : 'undefined',
  projectId: firebaseConfig.projectId || 'undefined',
  authDomain: firebaseConfig.authDomain || 'undefined',
  storageBucket: firebaseConfig.storageBucket || 'undefined',
  appId: firebaseConfig.appId || 'undefined',
});
console.log('Full API Key (for debugging):', firebaseConfig.apiKey);
console.log('=== END DEBUG ===');

// Client-side only Firebase initialization
// This prevents build-time crashes during SSG when environment variables are missing
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let analytics: Analytics | null = null;
let storage: FirebaseStorage | null = null;

// Initialize Firebase only on the client side
if (typeof window !== 'undefined') {
  try {
    // Initialize Firebase app using the recommended pattern
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');

    // Initialize Firebase services
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
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
