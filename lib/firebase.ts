import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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

// Validate required configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is missing. Please check your .env.local file.');
  throw new Error('Firebase configuration is incomplete');
}

// Initialize Firebase
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase app:', error);
  throw error;
}

// Initialize Firebase services
let auth, db, functions, analytics, storage;
try {
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app);
  
  // Initialize Analytics only in browser environment
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
  
  console.log('Firebase services initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase services:', error);
  throw error;
}

// Debug logging
console.log('Firebase initialized:', {
  app: !!app,
  auth: !!auth,
  db: !!db,
  functions: !!functions,
  analytics: !!analytics,
  storage: !!storage,
  config: firebaseConfig
});

// Export services
export { auth, db, functions, analytics, storage };

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
    console.log('Firebase emulators connection:', error.message || 'Already connected');
  }
} else {
  console.log('Firebase connected to production environment');
}

export default app;
