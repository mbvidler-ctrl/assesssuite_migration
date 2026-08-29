const DB_NAME = 'assesssuite-persistent-transcription';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const CHUNK_STORE = 'chunks';

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not provide IndexedDB recovery storage.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Transcription recovery storage could not be opened.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' });
        sessions.createIndex('ownerKey', 'ownerKey', { unique: false });
        sessions.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: 'key' });
        chunks.createIndex('sessionId', 'sessionId', { unique: false });
        chunks.createIndex('sessionPart', ['sessionId', 'partIndex'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction(storeNames, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Transcription recovery storage failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Transcription recovery storage was aborted.')); };
    try { result = operation(tx); } catch (error) { tx.abort(); reject(error); }
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Transcription recovery read failed.'));
  });
}

export async function saveLocalTranscriptionSession(session) {
  const value = { ...session, updatedAt: new Date().toISOString() };
  await transaction([SESSION_STORE], 'readwrite', (tx) => tx.objectStore(SESSION_STORE).put(value));
  return value;
}

export async function getLocalTranscriptionSession(sessionId) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([SESSION_STORE], 'readonly');
    return await requestValue(tx.objectStore(SESSION_STORE).get(sessionId));
  } finally {
    db.close();
  }
}

export async function findLatestLocalTranscriptionSession(ownerKey) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([SESSION_STORE], 'readonly');
    const values = await requestValue(tx.objectStore(SESSION_STORE).index('ownerKey').getAll(ownerKey));
    return (Array.isArray(values) ? values : [])
      .filter((entry) => entry.status !== 'discarded')
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  } finally {
    db.close();
  }
}

export async function saveLocalTranscriptionChunk({
  sessionId,
  partIndex,
  chunkIndex,
  blob,
  mimeType,
}) {
  if (!(blob instanceof Blob) || blob.size <= 0) return null;
  const value = {
    key: `${sessionId}:${partIndex}:${chunkIndex}`,
    sessionId,
    partIndex,
    chunkIndex,
    blob,
    mimeType,
    byteSize: blob.size,
    createdAt: new Date().toISOString(),
  };
  await transaction([CHUNK_STORE], 'readwrite', (tx) => tx.objectStore(CHUNK_STORE).put(value));
  return value;
}

export async function listLocalTranscriptionChunks(sessionId, partIndex = null) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([CHUNK_STORE], 'readonly');
    const index = tx.objectStore(CHUNK_STORE).index(partIndex == null ? 'sessionId' : 'sessionPart');
    const values = await requestValue(index.getAll(partIndex == null ? sessionId : [sessionId, partIndex]));
    return (Array.isArray(values) ? values : []).sort((a, b) => (
      a.partIndex - b.partIndex || a.chunkIndex - b.chunkIndex
    ));
  } finally {
    db.close();
  }
}

export async function deleteLocalTranscriptionPart(sessionId, partIndex) {
  const chunks = await listLocalTranscriptionChunks(sessionId, partIndex);
  if (chunks.length === 0) return;
  await transaction([CHUNK_STORE], 'readwrite', (tx) => {
    const store = tx.objectStore(CHUNK_STORE);
    chunks.forEach((chunk) => store.delete(chunk.key));
  });
}

export async function deleteLocalTranscriptionSession(sessionId) {
  const chunks = await listLocalTranscriptionChunks(sessionId);
  await transaction([SESSION_STORE, CHUNK_STORE], 'readwrite', (tx) => {
    tx.objectStore(SESSION_STORE).delete(sessionId);
    const store = tx.objectStore(CHUNK_STORE);
    chunks.forEach((chunk) => store.delete(chunk.key));
  });
}

export function groupLocalTranscriptionParts(chunks) {
  const groups = new Map();
  for (const chunk of chunks || []) {
    if (!groups.has(chunk.partIndex)) groups.set(chunk.partIndex, []);
    groups.get(chunk.partIndex).push(chunk);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([partIndex, values]) => ({
      partIndex,
      chunks: values.sort((a, b) => a.chunkIndex - b.chunkIndex),
    }));
}
