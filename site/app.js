/**
 * CyberDastak Opportunities - Client-side Web Application
 * Handles data loading, tab switching, live filtering, and interactive modals.
 */

// Application State
const state = {
  activeTab: 'jobs',
  data: {
    jobs: [],
    events: [],
    scholarships: [],
    newlyAdded: null
  },
  searchQuery: '',
  typeFilter: 'all',
  locationFilter: 'all',
  sortOrder: 'newest'
};

// DOM Element Selectors
const DOM = {
  tabBtns: document.querySelectorAll('.tab-btn'),
  cardsGrid: document.getElementById('cardsGrid'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  locationFilter: document.getElementById('locationFilter'),
  sortOrder: document.getElementById('sortOrder'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  resetSearchBtn: document.getElementById('resetSearchBtn'),
  visibleCount: document.getElementById('visibleCount'),
  lastUpdatedDate: document.getElementById('lastUpdatedDate'),
  statJobs: document.getElementById('statJobs'),
  statEvents: document.getElementById('statEvents'),
  statScholarships: document.getElementById('statScholarships'),
  badgeJobsCount: document.getElementById('badgeJobsCount'),
  badgeEventsCount: document.getElementById('badgeEventsCount'),
  badgeScholarshipsCount: document.getElementById('badgeScholarshipsCount'),
  detailModal: document.getElementById('detailModal'),
  modalContent: document.getElementById('modalContent'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  digestModal: document.getElementById('digestModal'),
  digestModalBtn: document.getElementById('digestModalBtn'),
  closeDigestModalBtn: document.getElementById('closeDigestModalBtn'),
  closeDigestModalOk: document.getElementById('closeDigestModalOk')
};

/**
 * Initializes the application: loads JSON data, attaches event listeners, renders initial view.
 */
async function init() {
  setupEventListeners();
  renderLoadingState();

  await loadAllData();

  updateStats();
  renderCurrentTab();
}

/**
 * Loads JSON datasets with path resolution fallback
 */
async function loadAllData() {
  const tryFetch = async (filename) => {
    // Try current directory /data/ (GitHub Pages), then fallback to ../data/ (local development)
    const paths = [`data/${filename}`, `../data/${filename}`];
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          return await res.json();
        }
      } catch (_) {}
    }
    console.warn(`Could not load ${filename} from known paths.`);
    return [];
  };

  const [jobs, events, scholarships, newlyAdded] = await Promise.all([
    tryFetch('jobs.json'),
    tryFetch('events.json'),
    tryFetch('scholarships.json'),
    tryFetch('newly-added.json')
  ]);

  state.data.jobs = Array.isArray(jobs) ? jobs : [];
  state.data.events = Array.isArray(events) ? events : [];
  state.data.scholarships = Array.isArray(scholarships) ? scholarships : [];
  state.data.newlyAdded = newlyAdded && newlyAdded.counts ? newlyAdded : null;
}

/**
 * Updates hero stats and tab badge counters
 */
function updateStats() {
  const { jobs, events, scholarships, newlyAdded } = state.data;

  DOM.statJobs.textContent = jobs.length;
  DOM.statEvents.textContent = events.length;
  DOM.statScholarships.textContent = scholarships.length;

  DOM.badgeJobsCount.textContent = jobs.length;
  DOM.badgeEventsCount.textContent = events.length;
  DOM.badgeScholarshipsCount.textContent = scholarships.length;

  if (newlyAdded && newlyAdded.fetchedAt) {
    const d = new Date(newlyAdded.fetchedAt);
    DOM.lastUpdatedDate.textContent = `Scanned: ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }
}

/**
 * Attaches event listeners for navigation, search, filters, and modals
 */
function setupEventListeners() {
  // Tab Switching
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName === state.activeTab) return;

      DOM.tabBtns.forEach(b => {
        b.classList.remove('active', 'text-slate-100');
        b.classList.add('text-slate-400');
      });

      btn.classList.add('active', 'text-slate-100');
      btn.classList.remove('text-slate-400');

      state.activeTab = tabName;
      renderCurrentTab();
    });
  });

  // Search Input (debounced)
  let debounceTimeout;
  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderCurrentTab();
    }, 150);
  });

  // Filters
  DOM.typeFilter.addEventListener('change', (e) => {
    state.typeFilter = e.target.value;
    renderCurrentTab();
  });

  DOM.locationFilter.addEventListener('change', (e) => {
    state.locationFilter = e.target.value;
    renderCurrentTab();
  });

  DOM.sortOrder.addEventListener('change', (e) => {
    state.sortOrder = e.target.value;
    renderCurrentTab();
  });

  // Clear Filters
  const clearAllFilters = () => {
    state.searchQuery = '';
    state.typeFilter = 'all';
    state.locationFilter = 'all';
    state.sortOrder = 'newest';

    DOM.searchInput.value = '';
    DOM.typeFilter.value = 'all';
    DOM.locationFilter.value = 'all';
    DOM.sortOrder.value = 'newest';

    renderCurrentTab();
  };

  DOM.clearFiltersBtn.addEventListener('click', clearAllFilters);
  DOM.resetSearchBtn.addEventListener('click', clearAllFilters);

  // Modals
  DOM.closeModalBtn.addEventListener('click', closeModal);
  DOM.detailModal.addEventListener('click', (e) => {
    if (e.target === DOM.detailModal) closeModal();
  });

  DOM.digestModalBtn.addEventListener('click', () => {
    DOM.digestModal.classList.remove('hidden');
  });

  DOM.closeDigestModalBtn.addEventListener('click', () => {
    DOM.digestModal.classList.add('hidden');
  });

  DOM.closeDigestModalOk.addEventListener('click', () => {
    DOM.digestModal.classList.add('hidden');
  });

  // Keyboard escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      DOM.digestModal.classList.add('hidden');
    }
  });
}

/**
 * Filter, sort, and render items for the active tab
 */
function renderCurrentTab() {
  const items = state.data[state.activeTab] || [];

  // Filter items
  const filtered = items.filter(item => {
    // Search Query Match
    if (state.searchQuery) {
      const q = state.searchQuery;
      const title = (item.title || '').toLowerCase();
      const org = (item.organization || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const tags = (item.tags || []).join(' ').toLowerCase();

      if (!title.includes(q) && !org.includes(q) && !loc.includes(q) && !desc.includes(q) && !tags.includes(q)) {
        return false;
      }
    }

    // Type Filter (Internship, Full-time, Remote)
    if (state.typeFilter !== 'all') {
      const t = (item.type || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const filterT = state.typeFilter.toLowerCase();

      if (filterT === 'remote') {
        if (!loc.includes('remote') && !t.includes('remote')) return false;
      } else if (!t.includes(filterT)) {
        return false;
      }
    }

    // Location Filter
    if (state.locationFilter !== 'all') {
      const loc = (item.location || '').toLowerCase();
      const filterL = state.locationFilter.toLowerCase();
      if (!loc.includes(filterL)) return false;
    }

    return true;
  });

  // Sort items
  filtered.sort((a, b) => {
    if (state.sortOrder === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    // Default newest
    const dateField = state.activeTab === 'events' ? 'date' : (state.activeTab === 'scholarships' ? 'deadline' : 'postedDate');
    const dateA = new Date(a[dateField] || a.postedDate || a.date || a.deadline || 0).getTime();
    const dateB = new Date(b[dateField] || b.postedDate || b.date || b.deadline || 0).getTime();
    return dateB - dateA;
  });

  DOM.visibleCount.textContent = filtered.length;

  if (filtered.length === 0) {
    DOM.cardsGrid.innerHTML = '';
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.cardsGrid.innerHTML = filtered.map(item => renderCard(item, state.activeTab)).join('');

  // Attach card click handlers for details modal
  DOM.cardsGrid.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const selected = items.find(i => i.id === id);
      if (selected) openModal(selected, state.activeTab);
    });
  });
}

/**
 * Generates card HTML template
 */
function renderCard(item, category) {
  const isJob = category === 'jobs';
  const isEvent = category === 'events';
  const isScholarship = category === 'scholarships';

  let dateLabel = 'Posted';
  let dateVal = item.postedDate;
  let actionLabel = 'Apply Now';
  let accentColor = 'border-cyan-500/20 hover:border-cyan-400';
  let btnClass = 'bg-cyan-600 hover:bg-cyan-500 text-white';

  if (isEvent) {
    dateLabel = 'Date';
    dateVal = item.date;
    actionLabel = 'Register / Details';
    accentColor = 'border-emerald-500/20 hover:border-emerald-400';
    btnClass = 'bg-emerald-600 hover:bg-emerald-500 text-white';
  } else if (isScholarship) {
    dateLabel = 'Deadline';
    dateVal = item.deadline;
    actionLabel = 'View Grant';
    accentColor = 'border-purple-500/20 hover:border-purple-400';
    btnClass = 'bg-purple-600 hover:bg-purple-500 text-white';
  }

  const tagsHtml = (item.tags || []).slice(0, 3).map(tag => `
    <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50">
      ${escapeHtml(tag)}
    </span>
  `).join('');

  const initials = (item.organization || 'CD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return `
    <div class="cyber-card rounded-2xl p-5 flex flex-col justify-between ${accentColor}">
      <div>
        <!-- TOP ROW: ORG & DATE -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-400 flex items-center justify-center flex-shrink-0">
              ${escapeHtml(initials)}
            </div>
            <div class="min-w-0">
              <span class="text-xs font-bold text-slate-300 truncate block">
                ${escapeHtml(item.organization || 'Verified Provider')}
              </span>
              <span class="text-[11px] text-slate-400 flex items-center gap-1">
                📍 ${escapeHtml(item.location || 'India')}
              </span>
            </div>
          </div>
          <span class="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 flex-shrink-0">
            ${formatRelativeDate(dateVal)}
          </span>
        </div>

        <!-- TITLE -->
        <h3 class="text-base font-bold text-white mb-2 leading-snug hover:text-cyan-300 transition-colors">
          ${escapeHtml(item.title)}
        </h3>

        <!-- DESCRIPTION SNIPPET -->
        <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
          ${escapeHtml(item.description || 'No additional description provided. Click to view requirements and apply.')}
        </p>

        <!-- TAGS -->
        <div class="flex flex-wrap gap-1.5 mb-5">
          ${item.type ? `
            <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
              ${escapeHtml(item.type)}
            </span>
          ` : ''}
          ${tagsHtml}
        </div>
      </div>

      <!-- CARD FOOTER ACTIONS -->
      <div class="flex items-center gap-2 pt-3 border-t border-slate-800/80">
        <button data-id="${item.id}" class="view-detail-btn px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all">
          Details
        </button>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl ${btnClass} text-xs font-bold transition-all shadow-sm">
          <span>${actionLabel}</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    </div>
  `;
}

/**
 * Opens detail modal
 */
function openModal(item, category) {
  const isJob = category === 'jobs';
  const isEvent = category === 'events';
  const actionLabel = isJob ? 'Apply on Official Website' : (isEvent ? 'Register for Event' : 'Access Scholarship');

  const tags = (item.tags || []).map(t => `
    <span class="px-2.5 py-1 rounded-md text-xs bg-slate-800 text-cyan-300 border border-slate-700">${escapeHtml(t)}</span>
  `).join('');

  DOM.modalContent.innerHTML = `
    <div class="mb-4">
      <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider">${escapeHtml(item.organization)}</span>
      <h2 class="text-xl font-extrabold text-white mt-1 leading-snug">${escapeHtml(item.title)}</h2>
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
        <span>📍 ${escapeHtml(item.location)}</span>
        <span>&bull;</span>
        <span>📅 ${formatFullDate(item.postedDate || item.date || item.deadline)}</span>
        ${item.type ? `<span>&bull;</span><span class="text-emerald-400 font-semibold">${escapeHtml(item.type)}</span>` : ''}
      </div>
    </div>

    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-5 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
      ${escapeHtml(item.description || 'Visit the official link below for full requirements, eligibility, and application procedure.')}
    </div>

    <div class="flex flex-wrap gap-1.5 mb-6">
      ${tags}
    </div>

    <div class="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
      <button onclick="navigator.clipboard.writeText('${item.url}'); alert('Opportunity link copied to clipboard!');" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
        📋 Copy Link
      </button>
      <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="w-full sm:flex-grow text-center py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/20">
        ${actionLabel} &rarr;
      </a>
    </div>
  `;

  DOM.detailModal.classList.remove('hidden');
}

function closeModal() {
  DOM.detailModal.classList.add('hidden');
}

/**
 * Format helpers
 */
function formatRelativeDate(dStr) {
  if (!dStr) return 'Recent';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch (_) {
    return 'Recent';
  }
}

function formatFullDate(dStr) {
  if (!dStr) return 'Active';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return dStr;
  }
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLoadingState() {
  DOM.cardsGrid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="cyber-card rounded-2xl p-5 animate-pulse">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-slate-800"></div>
        <div class="flex-1 space-y-2">
          <div class="h-3 bg-slate-800 rounded w-1/3"></div>
          <div class="h-2 bg-slate-800 rounded w-1/2"></div>
        </div>
      </div>
      <div class="h-4 bg-slate-800 rounded w-3/4 mb-3"></div>
      <div class="h-3 bg-slate-800 rounded w-full mb-2"></div>
      <div class="h-3 bg-slate-800 rounded w-5/6 mb-4"></div>
      <div class="h-8 bg-slate-800 rounded-xl"></div>
    </div>
  `).join('');
}

// Kickoff
document.addEventListener('DOMContentLoaded', init);
