import { observe } from '@violentmonkey/dom';
import gridCss from 'ag-grid-community/styles/ag-grid.css';
import gridThemeCss from 'ag-grid-community/styles/ag-theme-alpine-no-font.css';
import type { AgGridSolidProps, AgGridSolidRef } from 'solid-ag-grid';
import AgGridSolid from 'solid-ag-grid';
import { Component, createEffect, on } from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import { render } from 'solid-js/web';
import { EnrichedPosting, openDb, Posting, toDbPosting } from './db';
import {
  applicationDeadlineSelector,
  applicationStatusSelector,
  applyBtnSelector,
  jobTitleSelector,
  locationSelector,
  organisationSelector,
  postingRowSelector,
  postingTableSelector,
  postingTableStableParentSelector,
  termSelector,
} from './selectors';
// global CSS
import globalCss from './style.css';
// CSS modules
import { gatherText } from './utils';

const [store, setStore] = createStore({
  postings: null as null | Array<EnrichedPosting>,
});

function PostingsGrid(props: { db: IDBDatabase }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: AgGridSolidProps<any> = {
    columnDefs: [
      {
        field: 'applyBtn',
        headerName: 'Actions',
        cellRenderer: (props) => {
          return props.value;
        },
      },
      { field: 'applicationStatus', headerName: 'Application Status', hide: true },
      {
        field: 'gps_ref',
        headerName: 'Reference',
        editable: true,
        valueSetter: (params) => {
          const data = params.data as EnrichedPosting;

          const transaction = props.db.transaction(['postings'], 'readwrite');
          const postings = transaction.objectStore('postings');
          data.gps_ref = params.newValue;
          postings.put(toDbPosting(data));
          setTimeout(() => {
            params.api.onFilterChanged();
          });
          return true;
        },
      },
      {
        field: 'gps_status',
        headerName: 'Status',
        editable: true,
        valueSetter: (params) => {
          const data = params.data as EnrichedPosting;

          const transaction = props.db.transaction(['postings'], 'readwrite');
          const postings = transaction.objectStore('postings');
          data.gps_status = params.newValue;
          postings.put(toDbPosting(data));
          setTimeout(() => {
            params.api.onFilterChanged();
          });
          return true;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Applied', 'Uninterested', 'Rejected', 'Shortlist', 'Interviewed', 'Offer', ''],
        },
      },
      { field: 'term', headerName: 'Term', hide: true },
      { field: 'id', headerName: 'ID' },
      {
        field: 'jobTitleBtn',
        headerName: 'Job Title',
        cellRenderer: (props) => {
          return props.value;
        },
        valueFormatter: (params) => {
          return gatherText(params.value);
        },
      },
      { field: 'organization', headerName: 'Organization' },
      { field: 'location', headerName: 'Location' },
      { field: 'applicationDeadline', headerName: 'Application Deadline' },
    ],
    defaultColDef: {
      flex: 1,
      filter: true,
      filterParams: {
        maxNumConditions: 20,
      },
    },
    domLayout: 'autoHeight',
    suppressDragLeaveHidesColumns: true,
    onStateUpdated: (event) => {
      localStorage.setItem('gps-postings-grid-state', JSON.stringify(event.state));
    },
    initialState: JSON.parse(localStorage.getItem('gps-postings-grid-state') || '{}'),
    rowData: unwrap(store.postings),
  };
  options.columnDefs.forEach((x) => {
    if ('field' in x) x.tooltipField = x.field;
  });

  // eslint-disable-next-line no-unassigned-vars
  let grid!: AgGridSolidRef;

  createEffect(
    on(
      () => store.postings,
      (v) => {
        grid?.api.setGridOption('rowData', unwrap(v));
      },
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AgGrid = AgGridSolid as Component<any>;
  return (
    <div class="ag-theme-alpine-auto-dark" style={{ display: 'contents' }}>
      <AgGrid {...options} ref={grid} />
    </div>
  );
}

// Inject CSS
GM_addStyle(globalCss);
GM_addStyle(gridCss);
GM_addStyle(gridThemeCss);

const dbPromise = (async function () {
  return await openDb();
})();

const pageLoadPromise = (function () {
  if (document.readyState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener('load', resolve);
  });
})();

function error_handler(err: unknown) {
  console.error('GPS Error: ', err);
  alert('GPS Error: ' + err);
}

Promise.all([dbPromise, pageLoadPromise])
  .then(([db]) => {
    if (window.location.pathname.endsWith('/coopjobs.htm')) {
      const stableParent = document.querySelector<HTMLElement>(postingTableStableParentSelector);
      if (!stableParent) return;

      const grid = document.createElement('div');
      stableParent.insertAdjacentElement('afterend', grid);
      render(() => <PostingsGrid db={db} />, grid);

      let tableElement!: HTMLTableElement;
      function updateTable() {
        const newTable = document.querySelector<HTMLTableElement>(postingTableSelector);
        if (tableElement == newTable) return false;
        tableElement = newTable;
        return true;
      }

      function hookTable() {
        if (!updateTable()) return;

        {
          let element = stableParent.querySelector<HTMLElement>(
            'div.orbis-posting-actions',
          ).nextSibling;
          while (element) {
            const nextElement = element.nextSibling;
            if ('style' in element) (element as HTMLElement).style.display = 'none';
            else element.remove();
            element = nextElement;
          }
        }

        const postings = new Array<Posting>();

        for (const posting of tableElement.querySelectorAll(postingRowSelector)) {
          const item: Posting = {
            applyBtn: posting.querySelector<HTMLButtonElement>(applyBtnSelector),
            applicationStatus: gatherText(posting.querySelector(applicationStatusSelector)),
            term: gatherText(posting.querySelector(termSelector)),
            id: posting.classList
              .values()
              .find((x) => x.startsWith('posting'))
              .slice(7),
            jobTitleBtn: posting.querySelector<HTMLAnchorElement>(jobTitleSelector)!,
            organization: gatherText(posting.querySelector(organisationSelector)),
            location: gatherText(posting.querySelector(locationSelector)),
            applicationDeadline: new Date(
              gatherText(posting.querySelector(applicationDeadlineSelector)),
            ),
          };
          postings.push(item);
          item.applyBtn.remove();
          item.jobTitleBtn.remove();
          item.jobTitleBtn.style['max-width'] = 'revert';
        }

        enrichPostings(db, postings)
          .then((x) => {
            setStore('postings', x);
          })
          .catch(error_handler);
      }
      hookTable();
      observe(stableParent, hookTable, { subtree: true, childList: true });
    }
  })
  .catch(error_handler);

function enrichPostings(db: IDBDatabase, postings: Posting[]): Promise<EnrichedPosting[]> {
  return new Promise((resolve) => {
    const ret: EnrichedPosting[] = postings.map((x) =>
      Object.assign({ gps_ref: '', gps_status: '' }, x),
    );

    const transaction = db.transaction(['postings'], 'readonly');
    const postingsStore = transaction.objectStore('postings');

    if (ret.length === 0) return [];

    ret.forEach((x) => {
      const result = postingsStore.get(x.id);
      result.onsuccess = () => {
        if (result.result == null) return;
        x.gps_ref = result.result.ref;
        x.gps_status = result.result.status;
      };
    });

    transaction.oncomplete = () => resolve(ret);
  });
}
