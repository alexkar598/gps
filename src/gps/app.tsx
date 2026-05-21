import { observe } from '@violentmonkey/dom';
import gridCss from 'ag-grid-community/styles/ag-grid.css';
import gridThemeCss from 'ag-grid-community/styles/ag-theme-alpine-no-font.css';
import type { AgGridSolidProps, AgGridSolidRef } from 'solid-ag-grid';
import AgGridSolid from 'solid-ag-grid';
import { Component, createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import { render } from 'solid-js/web';
import { EnrichedPosting, exportDb, importDb, openDb, Posting, toDbPosting } from './db';
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
  topPaginationPanelSelector,
} from './selectors';
// global CSS
import globalCss from './style.css';
// CSS modules
import { gatherText } from './utils';
import { ColDef } from 'ag-grid-community/dist/lib/entities/colDef';
import { GridState } from 'ag-grid-community';

const [store, setStore] = createStore({
  postings: null as null | Array<EnrichedPosting>,
});

const [gridState, setGridState] = createSignal(
  JSON.parse(localStorage.getItem('gps-postings-grid-state') ?? '{}') as GridState,
);

function PostingsGrid(props: { db: IDBDatabase }) {
  const options = (gridState: GridState) =>
    ({
      columnDefs: (
        [
          {
            field: 'applyBtn',
            headerName: 'Actions',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cellRenderer: (props: any) => {
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
              values: [
                'Applied',
                'Uninterested',
                'Rejected',
                'Shortlist',
                'Interviewed',
                'Offer',
                '',
              ],
            },
          },
          { field: 'term', headerName: 'Term', hide: true },
          { field: 'id', headerName: 'ID' },
          {
            field: 'jobTitleBtn',
            headerName: 'Job Title',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cellRenderer: (props: any) => {
              return props.value;
            },
            valueFormatter: (params) => {
              return gatherText(params.value);
            },
          },
          { field: 'organization', headerName: 'Organization' },
          { field: 'location', headerName: 'Location' },
          { field: 'applicationDeadline', headerName: 'Application Deadline' },
        ] as ColDef[]
      ).map((x) => {
        if ('field' in x) x.tooltipField = x.field;
        return x;
      }),
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
      initialState: gridState,
      rowData: unwrap(store.postings),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) satisfies AgGridSolidProps<any>;

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
  // noinspection JSUnusedAssignment
  return (
    <div class="ag-theme-alpine-auto-dark" style={{ display: 'contents' }}>
      <Show when={gridState()} keyed>
        {(currentKey) => <AgGrid {...options(currentKey)} ref={grid} />}
      </Show>
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

      const settingsPanel = document.createElement('div');
      const paginationPanel = document.querySelector<HTMLElement>(topPaginationPanelSelector);
      paginationPanel!.insertAdjacentElement('beforebegin', settingsPanel);
      render(() => <Settings db={db} />, settingsPanel);

      const grid = document.createElement('div');
      stableParent.insertAdjacentElement('afterend', grid);
      render(() => <PostingsGrid db={db} />, grid);

      let tableElement!: HTMLTableElement;
      function updateTable() {
        const newTable = document.querySelector<HTMLTableElement>(postingTableSelector);
        if (!newTable) return false;
        if (tableElement == newTable) return false;
        tableElement = newTable;
        return true;
      }

      function hookTable() {
        if (!updateTable()) return;

        {
          let element = stableParent!.querySelector<HTMLElement>(
            'div.orbis-posting-actions',
          )!.nextSibling;
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
            applyBtn: posting.querySelector<HTMLElement>(applyBtnSelector),
            applicationStatus: gatherText(posting.querySelector(applicationStatusSelector)),
            term: gatherText(posting.querySelector(termSelector)),
            id:
              posting.classList
                .values()
                .find((x) => x.startsWith('posting'))
                ?.slice(7) ?? 'BAD ID',
            jobTitleBtn: posting.querySelector<HTMLElement>(jobTitleSelector)!,
            organization: gatherText(posting.querySelector(organisationSelector)),
            location: gatherText(posting.querySelector(locationSelector)),
            applicationDeadline: new Date(
              gatherText(posting.querySelector(applicationDeadlineSelector)),
            ),
          };
          postings.push(item);
          item.applyBtn?.remove();
          if (item.jobTitleBtn != null) {
            item.jobTitleBtn.remove();
            item.jobTitleBtn.style.maxWidth = 'revert';
          }
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

function Settings(props: { db: IDBDatabase }) {
  const [copiedText, setCopiedText] = createSignal(false);
  createEffect(() => {
    const currentTopic = copiedText();

    if (!currentTopic) return;

    const timeout = setTimeout(() => setCopiedText(false), 5000);

    onCleanup(() => {
      clearTimeout(timeout);
    });
  });

  return (
    <div>
      <h5>Settings</h5>
      <button
        style={{ 'margin-right': '6px' }}
        class="btn btn-primary btn-small"
        onClick={async () => {
          const data = await exportDb(props.db);
          await navigator.clipboard.writeText(data);
          setCopiedText(true);
        }}
      >
        {copiedText() ? 'Copied!' : 'Export'}
      </button>
      <button
        class="btn btn-primary btn-small"
        onClick={async () => {
          const data = prompt('Import data');
          if (!data) return;

          await importDb(props.db, data);
          setGridState(
            JSON.parse(localStorage.getItem('gps-postings-grid-state') ?? '{}') as GridState,
          );
          enrichPostings(props.db, store.postings ?? [])
            .then((x) => {
              setStore('postings', x);
            })
            .catch(error_handler);
        }}
      >
        Import
      </button>
    </div>
  );
}
