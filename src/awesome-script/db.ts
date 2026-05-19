if (navigator.storage && navigator.storage.persist) {
  void navigator.storage.persist();
}

export interface Posting {
  applyBtn: HTMLButtonElement;
  applicationStatus: string;
  term: string;
  id: string;
  jobTitleBtn: HTMLAnchorElement;
  organization: string;
  // internalStatus: string;
  location: string;
  applicationDeadline: Date;
}

export interface EnrichedPosting extends Posting {
  gps_ref: string;
  gps_status: string;
}

export interface DbPosting {
  id: string;
  ref: string;
  status: string;
}

const openPromise: Promise<IDBDatabase> = (function () {
  const openRequest = indexedDB.open('GPS', 1);

  openRequest.onupgradeneeded = ({ oldVersion }) => {
    const db = openRequest.result;

    if (oldVersion < 1) {
      db.createObjectStore('postings', { keyPath: 'id' });
    }
  };

  openRequest.onblocked = () => {
    console.log('Please close all other tabs with this site open!');
  };

  return new Promise((resolve, reject) => {
    openRequest.addEventListener('success', () => {
      const db = openRequest.result;
      db.onversionchange = () => {
        db.close();
        console.log('A new version of this page is ready. Please reload or close this tab!');
      };
      resolve(db);
    });
    openRequest.addEventListener('error', () => reject(openRequest.error));
  });
})();

export function openDb() {
  return openPromise;
}

export function toDbPosting(x: EnrichedPosting): DbPosting {
  return {
    id: x.id,
    ref: x.gps_ref,
    status: x.gps_status,
  };
}

export async function exportDb(db: IDBDatabase): Promise<string> {
  const request = db.transaction(['postings'], 'readonly').objectStore('postings').getAll();

  const json = await new Promise<string>((resolve) => {
    request.onsuccess = () => {
      resolve(JSON.stringify(request.result));
    };
  });
  const compressedStream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressedBlob = await new Response(compressedStream).blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf('base64,') + 7));
    };
    reader.readAsDataURL(compressedBlob);
  });
}

export async function importDb(db: IDBDatabase, data: string): Promise<void> {
  const byteString = atob(data);
  const dataArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) dataArray[i] = byteString.charCodeAt(i);

  const compressedBlob = new Blob([dataArray]);
  const decompressedStream = compressedBlob.stream().pipeThrough(new DecompressionStream('gzip'));
  const importedData = (await new Response(decompressedStream).json()) as DbPosting[];

  const transaction = db.transaction(['postings'], 'readwrite');
  const postings = transaction.objectStore('postings');
  importedData.forEach((x) => postings.put(x));
  return new Promise<void>((resolve) => {
    transaction.oncomplete = () => resolve();
  });
}
