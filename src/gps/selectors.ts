// language=css
export const postingRowSelector = 'tr[id^="posting"]';
// language=css
export const postingTableSelector = '#postingsTable';
// language=css
export const postingTableStableParentSelector = '*:has(> * > #postingsTable)';

// language=css
export const applyBtnSelector = 'td:nth-child(1) a.btn.btn-primary';
// language=css
export const applicationStatusSelector = 'td:nth-child(2)';
// language=css
export const termSelector = 'td:nth-child(3)';
// language=css
export const jobTitleSelector = 'td.orgDivTitleMaxWidth';
// language=css
export const organisationSelector = 'td.orgDivTitleMaxWidth ~ .orgDivTitleMaxWidth';
// language=css
export const internalStatusSelector = organisationSelector + ' ~ *';
// language=css
export const locationSelector = internalStatusSelector + ' ~ *';
// language=css
export const applicationDeadlineSelector = locationSelector + ' ~ *';
// language=css
export const topPaginationPanelSelector = '#postingsTablePlaceholder';
