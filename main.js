const entriesElement = document.querySelector('#entries');
const archiveTree = document.querySelector('#archive-tree');
const emptyState = document.querySelector('#empty-state');
const loadError = document.querySelector('#load-error');
const resultsCount = document.querySelector('#results-count');
const archiveCount = document.querySelector('#archive-count');
const searchInput = document.querySelector('#search-input');
const clearSearch = document.querySelector('#clear-search');
const archiveDisclosure = document.querySelector('#archive-disclosure');
let entries = [];

if (!window.matchMedia('(min-width: 761px)').matches) archiveDisclosure.open = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

function formatDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed).replace(/\sг\.$/, '');
}

function searchableText(entry) {
  return `${entry.title} ${entry.body} ${entry.version || ''}`.toLocaleLowerCase('ru-RU');
}

function visibleEntries() {
  const query = searchInput.value.trim().toLocaleLowerCase('ru-RU');
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !query || searchableText(entry).includes(query))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}

function renderArchive(list) {
  const years = new Map();
  for (const entry of list) {
    const year = entry.date.slice(0, 4);
    const month = entry.date.slice(0, 7);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(entry);
  }

  const groups = [...years.entries()];
  archiveTree.innerHTML = groups.map(([year, months], yearIndex) => {
    const monthGroups = [...months.entries()];
    const yearTotal = [...months.values()].reduce((total, monthEntries) => total + monthEntries.length, 0);
    const monthMarkup = monthGroups.map(([key, monthEntries], monthIndex) => {
      const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(`${key}-01T12:00:00`));
      const links = monthEntries.map((entry) => `
        <li><a href="#${escapeHtml(entry.id)}" data-entry-id="${escapeHtml(entry.id)}">${escapeHtml(entry.title)} ${escapeHtml(entry.date.slice(8, 10))}.</a></li>
      `).join('');
      const open = searchInput.value.trim() || (yearIndex === 0 && monthIndex === 0) ? ' open' : '';
      return `<details${open}><summary>${escapeHtml(monthName)} (${monthEntries.length})</summary><ul>${links}</ul></details>`;
    }).join('');
    const open = searchInput.value.trim() || yearIndex === 0 ? ' open' : '';
    return `<details${open}><summary>${escapeHtml(year)} (${yearTotal})</summary>${monthMarkup}</details>`;
  }).join('');
  archiveCount.textContent = `(${list.length})`;
}

function renderImages(images, title) {
  const safeImages = (Array.isArray(images) ? images : []).filter((path) =>
    typeof path === 'string' && path.startsWith('images/changelog/') && !path.includes('..')
  );
  if (!safeImages.length) return '';
  return `<p>${safeImages.map((path, index) => `
    <a href="${escapeHtml(path)}" target="_blank" rel="noopener">
      <img src="${escapeHtml(path)}" width="320" alt="${escapeHtml(title)} ${index + 1}" loading="lazy">
    </a>
  `).join(' ')}</p>`;
}

function renderEntry(entry, index, list) {
  const newer = index > 0 ? list[index - 1] : null;
  const older = index < list.length - 1 ? list[index + 1] : null;
  const lines = String(entry.body || '').split(/\n+/).filter(Boolean).map((line) => escapeHtml(line)).join('<br>');
  const navigation = (newer || older) ? `
    <p>
      ${newer ? `<a href="#${escapeHtml(newer.id)}">← новее</a>` : ''}
      ${newer && older ? ' | ' : ''}
      ${older ? `<a href="#${escapeHtml(older.id)}">старее →</a>` : ''}
    </p>
  ` : '';
  return `
    <article id="${escapeHtml(entry.id)}" tabindex="-1">
      <h2>${escapeHtml(entry.title)}</h2>
      <p>${escapeHtml(formatDate(entry.date))}${entry.version ? ` | версия ${escapeHtml(entry.version)}` : ''}.</p>
      <p>${lines}</p>
      ${renderImages(entry.images, entry.title)}
      ${navigation}
      <hr>
    </article>
  `;
}

function render() {
  const list = visibleEntries();
  if (searchInput.value.trim()) archiveDisclosure.open = true;
  renderArchive(list);
  resultsCount.textContent = searchInput.value.trim()
    ? `найдено ${list.length} из ${entries.length}.`
    : `всего ${entries.length} ченжлогов.`;
  emptyState.hidden = list.length > 0;
  clearSearch.hidden = !searchInput.value;
  entriesElement.innerHTML = list.map((entry, index) => renderEntry(entry, index, list)).join('');

  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id && list.some((entry) => entry.id === id)) {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
}

async function loadChanges() {
  try {
    let data;
    if (window.location.protocol === 'file:') {
      data = window.CHANGELOG_DATA;
    } else {
      const response = await fetch(`change.json?${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    entries = Array.isArray(data) ? data : data?.entries;
    if (!Array.isArray(entries)) throw new Error('Некорректный список');
    entries = entries.filter((entry) => entry.id && entry.date && entry.title);
    render();
  } catch (error) {
    resultsCount.textContent = '';
    archiveCount.textContent = '';
    entriesElement.replaceChildren();
    emptyState.hidden = true;
    loadError.hidden = false;
  }
}

searchInput.addEventListener('input', render);
clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  render();
  searchInput.focus();
});
archiveTree.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-entry-id]');
  if (link) {
    const entry = document.getElementById(link.dataset.entryId);
    requestAnimationFrame(() => entry?.scrollIntoView());
  }
});
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(window.location.hash.slice(1));
  document.getElementById(id)?.scrollIntoView();
});
loadChanges();
