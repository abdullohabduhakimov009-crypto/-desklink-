import { v4 as uuidv4 } from 'uuid';
import { localDb } from './services/localDb';

// Mock Firebase-like functions using localStorage via localDb
export const db = {
  collection: (name: string) => ({
    name,
    add: (data: any) => localDb.addDoc(name, data),
    doc: (id: string) => ({
      id,
      update: (data: any) => localDb.updateDoc(name, id, data),
      delete: () => localDb.deleteDoc(name, id)
    })
  })
};

export const auth = {
  currentUser: null as any,
  onAuthStateChanged: (callback: (user: any) => void) => {
    const check = () => {
      const user = localDb.getCurrentUser();
      auth.currentUser = user;
      callback(user);
    };
    check();
    return localDb.onSnapshot('users', check);
  },
  signOut: async () => {
    localDb.signOut();
    auth.currentUser = null;
  }
};

export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void): (() => void) => {
  const check = () => {
    const user = localDb.getCurrentUser();
    auth.currentUser = user;
    callback(user);
  };
  check();
  return localDb.onSnapshot('users', check);
};

export const signOut = async (authInstance: any) => {
  localDb.signOut();
  auth.currentUser = null;
};

export const serverTimestamp = () => new Date().toISOString();

export const doc = (dbInstance: any, collectionName?: string, id?: string) => {
  if (typeof dbInstance === "string") {
    // doc(collectionRef, id)
    return { collection: dbInstance, id: collectionName || uuidv4() };
  }
  // doc(db, collection, id)
  return { collection: collectionName || "", id: id || uuidv4() };
};

export const collection = (dbInstance: any, ...pathSegments: string[]) => {
  if (typeof dbInstance === "string") {
    return [dbInstance, ...pathSegments].join("/");
  }
  return pathSegments.join("/");
};

export const query = (collectionName: string, ...constraints: any[]) => {
  return { collectionName, constraints };
};

export const where = (field: string, op: string, value: any) => ({ type: 'where', args: [field, op, value] });
export const orderBy = (field: string, direction: string = "asc") => ({ type: 'orderBy', args: [field, direction] });
export const limit = (n: number) => ({ type: 'limit', args: [n] });

export const onSnapshot = (q: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void): (() => void) => {
  const collectionName = typeof q === "string" ? q : (q.collectionName || q.collection);
  const constraints = q.constraints || [];
  const isDoc = q && q.id && !q.collectionName;

  const wrapData = (item: any) => {
    if (!item) return null;
    const wrapped = { ...item };
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    
    for (const key in wrapped) {
      const value = wrapped[key];
      if (typeof value === 'string' && 
          (key.endsWith('At') || key.toLowerCase().includes('date')) &&
          isoDateRegex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          wrapped[key] = {
            toDate: () => date,
            toISOString: () => value,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          };
        }
      }
    }
    return wrapped;
  };

  return localDb.onSnapshot(collectionName, (items) => {
    if (isDoc) {
      const item = items.find(i => i.id === q.id || i.uid === q.id);
      callback({
        id: q.id,
        exists: () => !!item,
        data: () => wrapData(item),
        metadata: { hasPendingWrites: false }
      });
    } else {
      callback({
        docs: items.map((item: any) => ({
          id: item.id || item.uid,
          data: () => wrapData(item),
          exists: () => true,
          metadata: { hasPendingWrites: false }
        })),
        docChanges: () => []
      });
    }
  }, constraints);
};

export const addDoc = (collectionName: string, data: any) => localDb.addDoc(collectionName, data);
export const updateDoc = (docRef: any, data: any) => localDb.updateDoc(docRef.collection, docRef.id, data);
export const deleteDoc = (docRef: any) => localDb.deleteDoc(docRef.collection, docRef.id);

export const writeBatch = (dbInstance: any) => {
  const updates: { collection: string, id: string, data: any }[] = [];
  return {
    update: (docRef: any, data: any) => {
      updates.push({ collection: docRef.collection, id: docRef.id, data });
    },
    commit: async () => {
      // Group by collection to use updateDocs
      const collections = Array.from(new Set(updates.map(u => u.collection)));
      for (const col of collections) {
        const colUpdates = updates
          .filter(u => u.collection === col)
          .map(u => ({ id: u.id, data: u.data }));
        await localDb.updateDocs(col, colUpdates);
      }
    }
  };
};

export const getDocs = async (q: any) => {
  const collectionName = typeof q === "string" ? q : (q.collectionName || q.collection);
  const constraints = q.constraints || [];
  const items = await localDb.getDocs(collectionName, constraints);

  const wrapData = (item: any) => {
    if (!item) return null;
    const wrapped = { ...item };
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    
    for (const key in wrapped) {
      const value = wrapped[key];
      if (typeof value === 'string' && 
          (key.endsWith('At') || key.toLowerCase().includes('date')) &&
          isoDateRegex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          wrapped[key] = {
            toDate: () => date,
            toISOString: () => value,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          };
        }
      }
    }
    return wrapped;
  };

  return {
    docs: items.map((item: any) => ({
      id: item.id || item.uid,
      data: () => wrapData(item),
      exists: () => true,
      metadata: { hasPendingWrites: false }
    }))
  };
};

export const getDoc = async (docRef: any) => {
  const result = await localDb.getDoc(docRef.collection, docRef.id);
  const item = result.data();

  const wrapData = (item: any) => {
    if (!item) return null;
    const wrapped = { ...item };
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    
    for (const key in wrapped) {
      const value = wrapped[key];
      if (typeof value === 'string' && 
          (key.endsWith('At') || key.toLowerCase().includes('date')) &&
          isoDateRegex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          wrapped[key] = {
            toDate: () => date,
            toISOString: () => value,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          };
        }
      }
    }
    return wrapped;
  };

  return {
    exists: () => result.exists(),
    data: () => wrapData(item),
    metadata: { hasPendingWrites: false }
  };
};

export const setDoc = (docRef: any, data: any, options?: any) => 
  localDb.setDoc(docRef.collection, docRef.id, data, options);

export const signInWithEmailAndPassword = async (authInstance: any, email: string, pass: string) => {
  try {
    const user = await localDb.signIn(email, pass);
    auth.currentUser = user;
    return { user };
  } catch (err: any) {
    const error: any = new Error(err.message);
    if (err.message === 'auth/user-not-found') {
      error.code = 'auth/invalid-credential';
    }
    throw error;
  }
};

export const createUserWithEmailAndPassword = async (authInstance: any, email: string, pass: string, role?: string, name?: string, uid?: string) => {
  try {
    const user = await localDb.signUp(email, pass, role || 'client');
    if (name) {
      await localDb.updateDoc('users', user.uid, { displayName: name, name });
    }
    auth.currentUser = { ...user, displayName: name, name };
    return { user: auth.currentUser };
  } catch (err: any) {
    throw new Error(err.message);
  }
};

export const isFirebaseConfigured = true;

export const firebaseConfig = {
  apiKey: "localstorage",
  authDomain: "localstorage",
  projectId: "localstorage",
  storageBucket: "localstorage",
  messagingSenderId: "localstorage",
  appId: "localstorage"
};

export const handleFirestoreError = (err: any, op: any, path: any) => {
  console.error(`Error in ${op} at ${path}:`, err);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
