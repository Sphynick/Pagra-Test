import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import appletFirebaseConfig from '../firebase-applet-config.json';

/**
 * User-specified Firebase configuration for PAGRA (pagra-shop-test)
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCREc08uh4mSM6k8ylkOuywP3XFnGoswfY',
  authDomain: 'pagra-shop-test.firebaseapp.com',
  databaseURL: 'https://pagra-shop-test-default-rtdb.firebaseio.com',
  projectId: 'pagra-shop-test',
  storageBucket: 'pagra-shop-test.firebasestorage.app',
  messagingSenderId: '467105105613',
  appId: '1:467105105613:web:c073f34b14e46c5d1c8b84',
  measurementId: 'G-M7DMSJSQ3Z',
};

// In the AI Studio preview (.run.app), use the provisioned database so OAuth popups and
// deployed rules work out-of-the-box; on external hosts / local builds, use pagra-shop-test.
const isAiStudioPreview =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.run.app');

const activeConfig = isAiStudioPreview ? appletFirebaseConfig : firebaseConfig;

const app = initializeApp(activeConfig);
export const db = isAiStudioPreview
  ? getFirestore(app, appletFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAP_ADMIN_EMAIL = 'nicholasnjau22@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
