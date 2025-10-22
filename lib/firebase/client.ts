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
  // measurementId is optional for Analytics
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID && {
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  })
};

// Debug logging for environment variables
console.log('Firebase config debug:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'undefined',
  authDomain: firebaseConfig.authDomain || 'undefined',
  projectId: firebaseConfig.projectId || 'undefined',
  storageBucket: firebaseConfig.storageBucket || 'undefined',
  messagingSenderId: firebaseConfig.messagingSenderId || 'undefined',
  appId: firebaseConfig.appId || 'undefined',
  measurementId: firebaseConfig.measurementId || 'undefined',
});

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
    console.error('Firebase configuration is incomplete. Please check your environment variables.');
    console.error('Required variables: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    console.error('For Vercel deployment, add these as environment variables in your Vercel project settings.');
    console.error('Current config:', firebaseConfig);
    
    // Try to use fallback values for development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using fallback Firebase configuration for development...');
      const fallbackConfig = {
        apiKey: "AIzaSyC00i-DxjmLQz82xiubMkpfotc-k6MBuEI",
        authDomain: "yamago-2ae8d.firebaseapp.com",
        projectId: "yamago-2ae8d",
        storageBucket: "yamago-2ae8d.firebasestorage.app",
        messagingSenderId: "598692971255",
        appId: "1:598692971255:web:9f5977110f979b13e609f2",
        measurementId: "G-NL6CP18NNK"
      };
      
      try {
        app = getApps().length ? getApps()[0] : initializeApp(fallbackConfig);
        console.log('Firebase app initialized with fallback config');

        // Initialize Firebase services
        auth = getAuth(app);
        db = getFirestore(app);
        functions = getFunctions(app);
        storage = getStorage(app);
        
        // Initialize Analytics only if measurementId is available
        if (firebaseConfig.measurementId) {
          analytics = getAnalytics(app);
        }
        
        // Connect to emulators for fallback config too
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
          try {
            connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectFunctionsEmulator(functions, 'localhost', 5001);
            console.log('Firebase emulators connected successfully with fallback config');
          } catch (error) {
            console.log('Firebase emulators connection (fallback):', (error as Error).message || 'Already connected');
          }
        }
        
        console.log('Firebase services initialized successfully with fallback config');
      } catch (error) {
        console.error('Failed to initialize Firebase with fallback config:', error);
      }
    }
  } else {
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
      config: {
        apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: !!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      }
    });
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
