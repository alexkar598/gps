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
