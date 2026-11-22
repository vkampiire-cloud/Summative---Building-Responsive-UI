let allRecalls = [];

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(rawDate) {
    if (!rawDate || rawDate.length !== 8) return rawDate || 'N/A';
    const year = rawDate.substring(0, 4);
    const month = rawDate.substring(4, 6);
    const day = rawDate.substring(6, 8);
    const parsed = new Date(`${year}-${month}-${day}`);
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

async function checkBackendHealth() {
    const el = document.getElementById('server-indicator');
    if (!el) return;
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        el.textContent = `Server: ${data.hostname || 'Live'}`;
    } catch {
        el.textContent = 'Server: Offline';
        el.style.color = '#c92a2a';
    }
}

function showStatus(html = '') {
    const box = document.getElementById('status-message');
    if (!box) return;
    box.innerHTML = html;
    box.classList.toggle('active', !!html);
}

async function fetchRecalls(query = '') {
    const container = document.getElementById('results-container');
    if (container) container.innerHTML = '';
    showStatus('<div class="feedback-card"><div class="spinner"></div><p>Fetching drug recalls from OpenFDA...</p></div>');

    try {
        const res = await fetch(`/api/recalls?search=${encodeURIComponent(query)}&limit=50`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        allRecalls = data.results || [];
        showStatus();
        applyFiltersAndRender();
    } catch (err) {
        showStatus(`<div class="error-banner"><strong>Error:</strong> ${escapeHTML(err.message)}</div>`);
    }
}

function applyFiltersAndRender() {
    const sev = document.getElementById('severity-filter')?.value || 'ALL';
    const st = document.getElementById('status-filter')?.value || 'ALL';
    const sort = document.getElementById('sort-select')?.value || 'date-desc';
    const container = document.getElementById('results-container');
    const countEl = document.getElementById('results-count');

    const list = allRecalls.filter(i => {
        const classification = (i.classification || '').replace(/\s/g, '');
        const classificationFilter = sev.replace(/\s/g, '');
        const status = (i.status || '').trim().toLowerCase();
        return (sev === 'ALL' || classification === classificationFilter) &&
            (st === 'ALL' || status === st.trim().toLowerCase());
    });

    list.sort((a, b) => {
        if (sort === 'date-desc') return (b.recall_initiation_date || '').localeCompare(a.recall_initiation_date || '');
        if (sort === 'date-asc') return (a.recall_initiation_date || '').localeCompare(b.recall_initiation_date || '');
        return (a.product_description || '').localeCompare(b.product_description || '');
    });

    if (countEl) countEl.textContent = `Showing ${list.length} recall record${list.length === 1 ? '' : 's'}`;
    if (!list.length) {
        if (container) container.innerHTML = '';
        showStatus('<div class="feedback-card"><h3>No recalls found</h3><p>Try different search terms or filters.</p></div>');
        return;
    }

    showStatus();
    if (container) {
        container.innerHTML = list.map(i => {
            const cls = i.classification === 'Class I' || i.classification === 'ClassI'
                ? 'badge-class-i'
                : (i.classification === 'Class II' || i.classification === 'ClassII' ? 'badge-class-ii' : 'badge-class-iii');
            const stCls = (i.status || '').toLowerCase() === 'ongoing' ? 'status-ongoing' : 'status-completed';
            return `
                <article class="recall-card">
                    <div class="card-header">
                        <h2 class="card-title">${escapeHTML(i.product_description || 'Medication')}</h2>
                        <span class="badge ${cls}">${escapeHTML(i.classification || 'Class III')}</span>
                    </div>
                    <div class="card-body">
                        <p class="card-reason"><strong>Reason:</strong> ${escapeHTML(i.reason_for_recall || 'N/A')}</p>
                        <ul class="card-meta">
                            <li><strong>Firm:</strong> ${escapeHTML(i.recalling_firm || 'N/A')}</li>
                            <li><strong>Distribution:</strong> ${escapeHTML(i.distribution_pattern || 'Nationwide')}</li>
                            <li><strong>Date:</strong> ${escapeHTML(formatDate(i.recall_initiation_date))}</li>
                        </ul>
                    </div>
                    <div class="card-footer">
                        <span>Status:</span>
                        <span class="status-badge ${stCls}">${escapeHTML(i.status || 'Unknown')}</span>
                    </div>
                </article>`;
        }).join('');
    }
}

function init() {
    const searchInput = document.getElementById('search-input');
    document.getElementById('search-btn')?.addEventListener('click', () => fetchRecalls(searchInput?.value.trim() || ''));
    searchInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') fetchRecalls(searchInput.value.trim());
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => {
        ['severity-filter', 'status-filter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 'ALL';
        });
        if (searchInput) searchInput.value = '';
        const sort = document.getElementById('sort-select');
        if (sort) sort.value = 'date-desc';
        fetchRecalls('');
    });

    const sort = document.getElementById('sort-select');
    if (sort) sort.value = 'date-desc';
    ['severity-filter', 'status-filter', 'sort-select'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFiltersAndRender);
    });
    checkBackendHealth();
    fetchRecalls('');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
