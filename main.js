const entriesElement = document.querySelector('#entries');
const emptyState = document.querySelector('#empty-state');
const loadError = document.querySelector('#load-error');
const entryCount = document.querySelector('#entry-count');
const searchInput = document.querySelector('#search-input');
let entries = [];

function formatDate(date) {
  if (!date) return '';
  const parsedDate = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? date : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsedDate);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleEntries = entries
    .filter((entry) => `${entry.title} ${entry.body} ${entry.version}`.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  entryCount.textContent = `${visibleEntries.length} ${visibleEntries.length === 1 ? 'запись' : 'записей'}`;
  emptyState.hidden = visibleEntries.length !== 0;
  entriesElement.innerHTML = visibleEntries.map((entry) => {
    const images = Array.isArray(entry.images) ? entry.images : [];
    return `
      <article class="entry">
        <div class="entry-date">
          <span class="entry-version">v${escapeHtml(entry.version)}</span>
          ${escapeHtml(formatDate(entry.date))}
        </div>
        <div>
          <h2>${escapeHtml(entry.title)}</h2>
          <p class="entry-text">${escapeHtml(entry.body)}</p>
          ${images.length ? `<div class="entry-images">${images.map((image) => `<a href="${encodeURI(image)}" target="_blank" rel="noopener"><img src="${encodeURI(image)}" alt="Изображение к записи"></a>`).join('')}</div>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

async function loadChanges() {
  try {
    if (window.location.protocol === 'file:') {
      entries = Array.isArray(window.CHANGELOG_DATA) ? window.CHANGELOG_DATA : [];
    } else {
      const response = await fetch(`change.json?${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      entries = Array.isArray(data) ? data : data.entries;
    }
    if (!Array.isArray(entries)) throw new Error('change.json должен содержать массив записей');
    render();
  } catch (error) {
    entries = [];
    entryCount.textContent = '';
    loadError.hidden = false;
  }
}

searchInput.addEventListener('input', render);
loadChanges();
