import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

// Firebase configuration for production
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

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
  // Check if required configuration is available
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration is incomplete. Please check your environment variables.');
    console.warn('Required variables: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    console.warn('For Netlify deployment, add these as environment variables in your Netlify dashboard.');
  } else {
    try {
      // Initialize Firebase app
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      console.log('Firebase app initialized successfully');

      // Initialize Firebase services
      auth = getAuth(app);
      db = getFirestore(app);
      functions = getFunctions(app);
      storage = getStorage(app);
      
      // Initialize Analytics only in browser environment
      analytics = getAnalytics(app);
      
      console.log('Firebase services initialized successfully');

      // Connect to emulators only if explicitly enabled
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
        try {
          // Connect to emulators without checking existing connections
          connectAuthEmulator(auth, 'http://localhost:9199', { disableWarnings: true });
          connectFirestoreEmulator(db, 'localhost', 8180);
          connectFunctionsEmulator(functions, 'localhost', 5101);
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
      // Don't throw error during build - just log it
    }
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
  if (!isFirebaseInitialized()) {
    throw new Error('Firebase is not initialized. Make sure you are running this code on the client side and environment variables are set.');
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
