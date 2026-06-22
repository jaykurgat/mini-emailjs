// app.js — Mini-EmailJS SPA router + all view modules
'use strict';

// ═══════════════════════════════════════════════════════════
// 1. CORE UTILITIES
// ═══════════════════════════════════════════════════════════

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = { ok: false, error: `HTTP ${res.status}` }; }
  if (res.status === 401 && !location.pathname.endsWith('login.html')) {
    location.href = 'login.html';
  }
  return { status: res.status, ...data };
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
  });
}

let _toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = type ? `show ${type}` : 'show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = '', 3200);
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    }
    showToast('Copied to clipboard', 'success');
  }).catch(() => showToast('Copy failed', 'error'));
}

// ═══════════════════════════════════════════════════════════
// 2. ROUTER
// ═══════════════════════════════════════════════════════════

const STATE = {
  view: 'projects',
  projectId: null,
  project: null,
};

function getHash() {
  const h = location.hash.replace('#', '');
  const parts = h.split('&');
  const view = parts[0] || 'projects';
  const idPart = parts.find(p => p.startsWith('id='));
  const id = idPart ? idPart.replace('id=', '') : null;
  return { view, id };
}

function setHash(view, id) {
  const base = `#${view}`;
  location.hash = id ? `${base}&id=${id}` : base;
}

function navigate(view, id) {
  setHash(view, id || STATE.projectId);
}

async function route() {
  const { view, id } = getHash();

  // Project views need a project id
  const projectViews = ['overview','integration','automation','settings'];
  if (projectViews.includes(view)) {
    if (!id && !STATE.projectId) { setHash('projects'); return; }
    const pid = id || STATE.projectId;
    if (pid !== STATE.projectId || !STATE.project) {
      // Load project
      const { ok, project } = await api(`/api/projects/${encodeURIComponent(pid)}`);
      if (!ok) { setHash('projects'); return; }
      STATE.projectId = pid;
      STATE.project = project;
    }
    showProjectNav(STATE.project);
  } else {
    if (!projectViews.includes(view)) {
      // keep project ctx if we just navigated to a global view
    }
  }

  STATE.view = view;
  updateNav(view);
  updateTopbar(view);
  await renderView(view);
}

async function renderView(view) {
  const content = document.getElementById('content');
  content.innerHTML = '<div style="padding:40px 0;text-align:center;"><div class="spinner" style="width:20px;height:20px;border-width:2px;color:var(--accent);margin:0 auto;"></div></div>';

  switch(view) {
    case 'projects':    await viewProjects(); break;
    case 'new-project': await viewNewProject(); break;
    case 'account':     await viewAccount(); break;
    case 'overview':    await viewOverview(); break;
    case 'integration': await viewIntegration(); break;
    case 'automation':  await viewAutomation(); break;
    case 'settings':    await viewSettings(); break;
    default:            await viewProjects();
  }
}

// ═══════════════════════════════════════════════════════════
// 3. SIDEBAR LOGIC
// ═══════════════════════════════════════════════════════════

function updateNav(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
}

function updateTopbar(view) {
  const titles = {
    projects: 'All Projects',
    'new-project': 'New Project',
    account: 'Account Settings',
    overview: 'Overview',
    integration: 'Integration Hub',
    automation: 'Automation',
    settings: 'Project Settings',
  };
  const titleEl = document.getElementById('topbar-title-text');
  if (titleEl) {
    const projectPart = STATE.project && ['overview','integration','automation','settings'].includes(view)
      ? `<span class="topbar-breadcrumb">${esc(STATE.project.name)}</span>`
      : '';
    titleEl.innerHTML = (titles[view] || 'Dashboard') + projectPart;
  }
}

function showProjectNav(project) {
  document.getElementById('project-nav').classList.remove('hidden');
  const nameEl = document.getElementById('ctx-project-name');
  if (nameEl) nameEl.textContent = project.name;
}

function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const colBtn   = document.getElementById('collapse-btn');
  const overlay  = document.getElementById('sidebar-overlay');
  const burger   = document.getElementById('burger-btn');

  // Restore collapse state
  const collapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  if (collapsed) sidebar.classList.add('collapsed');
  updateCollapseIcon(collapsed);

  colBtn?.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
    updateCollapseIcon(isCollapsed);
  });

  // Mobile
  burger?.addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('open');
  });

  // Nav clicks
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.view);
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('open');
    });
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = 'login.html';
  });
}

function updateCollapseIcon(isCollapsed) {
  const btn = document.getElementById('collapse-btn');
  if (!btn) return;
  btn.innerHTML = isCollapsed
    ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><path d="M6 4l4 4-4 4"/></svg>`
    : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><path d="M10 12L6 8l4-4"/></svg>`;
}

// ═══════════════════════════════════════════════════════════
// 4. THEME TOGGLE
// ═══════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const darkIcon  = document.getElementById('theme-icon-dark');
  const lightIcon = document.getElementById('theme-icon-light');
  if (darkIcon)  darkIcon.style.display  = theme === 'dark'  ? 'block' : 'none';
  if (lightIcon) lightIcon.style.display = theme === 'light' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════
// 5. SLIDE-OVER
// ═══════════════════════════════════════════════════════════

function openSlideover(html, title) {
  document.getElementById('slideover-body').innerHTML = html;
  if (title) document.querySelector('.slideover-title').textContent = title;
  document.getElementById('submission-slideover').classList.add('open');
  document.getElementById('slideover-overlay').classList.add('open');
}

function closeSlideover() {
  document.getElementById('submission-slideover').classList.remove('open');
  document.getElementById('slideover-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════
// 6. VIEW: ALL PROJECTS
// ═══════════════════════════════════════════════════════════

async function viewProjects() {
  const { ok, projects } = await api('/api/projects');
  const content = document.getElementById('content');

  if (!ok || !projects) {
    content.innerHTML = `<div class="empty-state"><p>Failed to load projects.</p></div>`;
    return;
  }

  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="navigate('new-project')">
      <svg viewBox="0 0 16 16"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
      New Project
    </button>`;

  if (!projects.length) {
    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">Projects</div>
        <div class="page-subtitle">Connect websites and clients to receive form submissions.</div>
      </div>
      <div class="card">
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="4" y="4" width="14" height="14" rx="2"/><rect x="22" y="4" width="14" height="14" rx="2"/>
            <rect x="4" y="22" width="14" height="14" rx="2"/><rect x="22" y="22" width="14" height="14" rx="2"/>
          </svg>
          <h3>No projects yet</h3>
          <p>Create your first project to get an API endpoint for a website's contact form.</p>
          <button class="btn btn-primary" onclick="navigate('new-project')">Create first project</button>
        </div>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div class="page-header">
      <div class="page-title">Projects</div>
      <div class="page-subtitle">${projects.length} project${projects.length !== 1 ? 's' : ''} connected</div>
    </div>
    <div class="grid-2" id="projects-grid">
      ${projects.map(p => `
        <div class="project-card" onclick="openProject('${esc(p.project_id)}')">
          <div class="project-card-top">
            <div>
              <div class="project-card-name">${esc(p.name)}</div>
              <div class="project-card-id">${esc(p.project_id)}</div>
            </div>
            <span class="badge ${p.is_active ? 'badge-accent' : 'badge-warning'}">
              <span class="badge-dot"></span>${p.is_active ? 'Active' : 'Paused'}
            </span>
          </div>
          <div class="project-card-meta">
            <span class="badge">${esc(p.provider === 'smtp' ? 'Gmail / SMTP' : 'Resend')}</span>
            <span class="badge">→ ${esc(p.to_email)}</span>
          </div>
        </div>`).join('')}
    </div>`;
}

function openProject(projectId) {
  STATE.projectId = projectId;
  STATE.project = null;
  navigate('overview', projectId);
}

// ═══════════════════════════════════════════════════════════
// 7. VIEW: NEW PROJECT
// ═══════════════════════════════════════════════════════════

async function viewNewProject() {
  document.getElementById('topbar-actions').innerHTML = '';
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div class="page-title">New Project</div>
      <div class="page-subtitle">Connect a website or client. You'll get an API endpoint and key.</div>
    </div>
    <div class="card" style="max-width:620px;">
      <form id="new-project-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project name <span class="req">*</span></label>
            <input type="text" id="np-name" placeholder="e.g. ApexOps Website" required/>
            <div class="form-error" id="err-np-name"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Project ID (URL slug)</label>
            <input type="text" id="np-id" placeholder="auto-generated"/>
            <div class="form-hint">Used in the API URL. Leave blank to auto-generate.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notification recipient email <span class="req">*</span></label>
          <input type="email" id="np-email" placeholder="you@gmail.com" required/>
          <div class="form-error" id="err-np-email"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Email provider</label>
          <select id="np-provider">
            <option value="resend">Resend (built in — zero setup)</option>
            <option value="smtp">My own Gmail / SMTP</option>
          </select>
          <div class="form-hint" id="np-provider-hint">Uses this platform's shared Resend account.</div>
        </div>

        <div id="np-smtp-fields" class="hidden">
          <div class="card" style="background:var(--bg-elevated);border-style:dashed;margin-bottom:16px;">
            <div class="section-title" style="margin-bottom:12px;">SMTP / Gmail Settings</div>
            <p class="text-muted mb-12" style="font-size:12.5px;">
              Gmail: host <code>smtp.gmail.com</code>, port <code>465</code>, and a
              <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--accent);text-decoration:underline;">16-char App Password</a> (no spaces).
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">SMTP host</label>
                <input type="text" id="np-smtp-host" placeholder="smtp.gmail.com"/>
              </div>
              <div class="form-group">
                <label class="form-label">Port</label>
                <input type="number" id="np-smtp-port" value="465" placeholder="465"/>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">SMTP username</label>
              <input type="text" id="np-smtp-user" placeholder="you@gmail.com"/>
            </div>
            <div class="form-group">
              <label class="form-label">App password</label>
              <input type="text" id="np-smtp-pass" placeholder="16-character app password (no spaces)"/>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">"From" address</label>
          <input type="text" id="np-from" placeholder="onboarding@resend.dev"/>
        </div>

        <div class="form-group">
          <label class="form-label">Email subject template</label>
          <input type="text" id="np-subject" value="New form submission from {{from_name}}"/>
          <div class="form-hint">Use <code>{{field_name}}</code> for dynamic values.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Allowed origins</label>
          <input type="text" id="np-origins" placeholder="https://example.com, https://www.example.com"/>
          <div class="form-hint">Comma-separated. Leave blank to allow all (fine while testing).</div>
        </div>

        <div class="form-group">
          <label class="form-label">Rate limit (submissions per IP per hour)</label>
          <input type="number" id="np-rate" value="20" min="1" max="1000"/>
        </div>

        <div class="flex-between mt-20">
          <button type="button" class="btn btn-ghost" onclick="navigate('projects')">Cancel</button>
          <button type="submit" class="btn btn-primary" id="np-submit">Create Project</button>
        </div>
      </form>
    </div>`;

  // Provider toggle
  document.getElementById('np-provider').addEventListener('change', e => {
    const smtp = e.target.value === 'smtp';
    document.getElementById('np-smtp-fields').classList.toggle('hidden', !smtp);
    document.getElementById('np-provider-hint').textContent = smtp
      ? 'Sends using your own Gmail/Outlook/SMTP credentials.'
      : "Uses this platform's shared Resend account.";
    const fromEl = document.getElementById('np-from');
    if (!fromEl.value) fromEl.placeholder = smtp ? 'you@gmail.com' : 'onboarding@resend.dev';
  });

  // Auto-fill from email from smtp user
  document.getElementById('np-smtp-user')?.addEventListener('input', e => {
    const fromEl = document.getElementById('np-from');
    if (!fromEl.value) fromEl.placeholder = e.target.value;
  });

  // Submit
  document.getElementById('new-project-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearFormErrors();
    const provider = document.getElementById('np-provider').value;
    const name = document.getElementById('np-name').value.trim();
    const toEmail = document.getElementById('np-email').value.trim();
    let valid = true;

    if (!name)    { showFormError('np-name', 'Project name is required.');    valid = false; }
    if (!toEmail) { showFormError('np-email', 'Recipient email is required.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('np-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating…';

    const body = {
      name,
      projectId: document.getElementById('np-id').value.trim(),
      toEmail,
      fromEmail: document.getElementById('np-from').value.trim(),
      provider,
      subjectTemplate: document.getElementById('np-subject').value.trim(),
      allowedOrigins: document.getElementById('np-origins').value
        .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean),
      rateLimitPerHour: parseInt(document.getElementById('np-rate').value, 10) || 20,
    };

    if (provider === 'smtp') {
      body.providerConfig = {
        host: document.getElementById('np-smtp-host').value.trim(),
        port: parseInt(document.getElementById('np-smtp-port').value, 10) || 465,
        user: document.getElementById('np-smtp-user').value.trim(),
        pass: document.getElementById('np-smtp-pass').value,
      };
    }

    const { ok, project, error } = await api('/api/projects', { method: 'POST', body });
    btn.disabled = false;
    btn.textContent = 'Create Project';

    if (ok) {
      STATE.projectId = project.project_id;
      STATE.project = project;
      showProjectNav(project);
      showToast('Project created!', 'success');
      navigate('integration', project.project_id);
    } else {
      showToast(error || 'Failed to create project.', 'error');
    }
  });
}

// ═══════════════════════════════════════════════════════════
// 8. VIEW: OVERVIEW
// ═══════════════════════════════════════════════════════════

async function viewOverview() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="navigate('settings')">
      <svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M13.3 10a1.2 1.2 0 0 0 .24 1.32l.04.04a1.46 1.46 0 0 1-2.06 2.06l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.73 1.1V14.5a1.45 1.45 0 0 1-2.9 0v-.06a1.2 1.2 0 0 0-.79-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.46 1.46 0 0 1-2.06-2.06l.04-.04a1.2 1.2 0 0 0 .24-1.32 1.2 1.2 0 0 0-1.1-.73H1.5a1.45 1.45 0 0 1 0-2.9h.06a1.2 1.2 0 0 0 1.1-.79z"/></svg>
      Settings
    </button>`;

  const p = STATE.project;
  const content = document.getElementById('content');

  // Load stats + submissions in parallel
  const [statsRes, subsRes] = await Promise.all([
    api(`/api/projects/${encodeURIComponent(p.project_id)}`),
    api(`/api/projects/${encodeURIComponent(p.project_id)}/submissions?limit=50`),
  ]);

  const stats = statsRes.stats || { total: 0, sent: 0, blocked: 0, error: 0 };
  const submissions = subsRes.submissions || [];

  // Calculate today's submissions
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayCount = submissions.filter(s => new Date(s.created_at) >= today).length;
  const sentRate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  content.innerHTML = `
    <div class="page-header">
      <div class="flex-between">
        <div>
          <div class="page-title">${esc(p.name)}</div>
          <div class="page-subtitle">${esc(p.project_id)} · ${p.is_active ? '<span style="color:var(--accent)">Active</span>' : '<span style="color:var(--warning)">Paused</span>'}</div>
        </div>
        <span class="badge ${p.provider === 'smtp' ? '' : 'badge-accent'}">${esc(p.provider === 'smtp' ? 'Gmail / SMTP' : 'Resend')}</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid-4 mb-16">
      <div class="stat-card">
        <div class="stat-card-label">Total Submissions</div>
        <div class="stat-card-value">${stats.total}</div>
        <div class="stat-card-sub">All time</div>
      </div>
      <div class="stat-card accent-card">
        <div class="stat-card-label">Today</div>
        <div class="stat-card-value">${todayCount}</div>
        <div class="stat-card-sub">Submissions today</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Success Rate</div>
        <div class="stat-card-value">${sentRate}%</div>
        <div class="stat-card-sub">${stats.sent} sent · ${stats.error} errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Blocked</div>
        <div class="stat-card-value">${stats.blocked}</div>
        <div class="stat-card-sub">Spam / rate limited</div>
      </div>
    </div>

    <!-- Submissions table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Submissions</span>
        <div class="flex-center gap-8">
          <div class="search-bar" style="width:220px;">
            <svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
            <input type="text" id="sub-search" placeholder="Search submissions…"/>
          </div>
          <select id="sub-filter" style="width:auto;padding:7px 28px 7px 10px;">
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="blocked">Blocked</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>
      <div id="submissions-table-wrap">
        ${renderSubmissionsTable(submissions)}
      </div>
    </div>`;

  // Store for filtering
  window._allSubmissions = submissions;

  // Search + filter
  function applyFilter() {
    const q = document.getElementById('sub-search').value.toLowerCase();
    const f = document.getElementById('sub-filter').value;
    const filtered = window._allSubmissions.filter(s => {
      const matchStatus = !f || s.status === f;
      const payload = JSON.stringify(s.payload || {}).toLowerCase();
      const matchQ = !q || payload.includes(q) || (s.created_at||'').includes(q);
      return matchStatus && matchQ;
    });
    document.getElementById('submissions-table-wrap').innerHTML = renderSubmissionsTable(filtered);
  }
  document.getElementById('sub-search').addEventListener('input', applyFilter);
  document.getElementById('sub-filter').addEventListener('change', applyFilter);
}

function renderSubmissionsTable(submissions) {
  if (!submissions.length) {
    return `<div class="empty-state">
      <h3>No submissions yet</h3>
      <p>They'll appear here once your form starts sending.</p>
    </div>`;
  }

  const statusBadge = s => {
    if (s === 'sent')    return `<span class="badge badge-success"><span class="badge-dot"></span>Sent</span>`;
    if (s === 'blocked') return `<span class="badge badge-warning"><span class="badge-dot"></span>Blocked</span>`;
    return `<span class="badge badge-error"><span class="badge-dot"></span>Error</span>`;
  };

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Status</th>
            <th>From</th>
            <th>Preview</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map((s,i) => {
            const payload = s.payload || {};
            const from = payload.from_name || payload.email || payload.name || '—';
            const preview = Object.entries(payload).slice(0,3).map(([k,v]) => `${k}: ${v}`).join(' · ');
            return `<tr>
              <td style="white-space:nowrap;">${formatDate(s.created_at)}</td>
              <td>${statusBadge(s.status)}</td>
              <td>${esc(String(from))}</td>
              <td class="td-overflow td-mono">${esc(preview)}</td>
              <td><button class="btn btn-ghost btn-xs" onclick="showSubmissionDetail(${i})">View</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function showSubmissionDetail(index) {
  const s = (window._allSubmissions || [])[index];
  if (!s) return;
  const payload = s.payload || {};

  const rows = Object.entries(payload).map(([k,v]) => `
    <tr>
      <td style="padding:9px 12px;font-weight:600;font-size:12.5px;color:var(--text-tertiary);white-space:nowrap;border-bottom:1px solid var(--border);vertical-align:top;">${esc(k)}</td>
      <td style="padding:9px 12px;font-size:13px;color:var(--text-primary);border-bottom:1px solid var(--border);">${esc(String(v))}</td>
    </tr>`).join('');

  const statusBadge = s.status === 'sent'
    ? `<span class="badge badge-success"><span class="badge-dot"></span>Sent</span>`
    : s.status === 'blocked'
    ? `<span class="badge badge-warning"><span class="badge-dot"></span>Blocked</span>`
    : `<span class="badge badge-error"><span class="badge-dot"></span>Error</span>`;

  openSlideover(`
    <div class="flex-center gap-8 mb-16" style="flex-wrap:wrap;">
      ${statusBadge}
      <span class="badge">${formatDate(s.created_at)}</span>
      ${s.ip_address ? `<span class="badge">IP: ${esc(s.ip_address)}</span>` : ''}
    </div>
    ${s.error_message ? `
      <div style="background:var(--danger-dim);border:1px solid var(--danger-border);border-radius:var(--radius);padding:10px 14px;font-size:12.5px;color:var(--danger);margin-bottom:16px;">
        ${esc(s.error_message)}
      </div>` : ''}
    <div class="table-wrap">
      <table><tbody>${rows}</tbody></table>
    </div>`, 'Submission Detail');
}

// ═══════════════════════════════════════════════════════════
// 9. VIEW: INTEGRATION HUB
// ═══════════════════════════════════════════════════════════

async function viewIntegration() {
  document.getElementById('topbar-actions').innerHTML = '';
  const p = STATE.project;
  const endpoint = `${location.origin}/api/send/${p.project_id}`;
  const maskedKey = p.api_key.slice(0,8) + '••••••••••••••••••••••••••••••••••••••••';

  // Code snippets
  const snippets = {
    javascript: `const ENDPOINT = "${endpoint}";
const API_KEY  = "${p.api_key}";

const data = {
  apiKey:    API_KEY,
  from_name: "Jane Smith",
  email:     "jane@example.com",
  message:   "Hello from my website!"
};

const res = await fetch(ENDPOINT, {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify(data),
});
const result = await res.json();
console.log(result); // { ok: true }`,

    curl: `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey":    "${p.api_key}",
    "from_name": "Jane Smith",
    "email":     "jane@example.com",
    "message":   "Hello from my website!"
  }'`,

    python: `import requests

ENDPOINT = "${endpoint}"
API_KEY  = "${p.api_key}"

res = requests.post(ENDPOINT, json={
    "apiKey":    API_KEY,
    "from_name": "Jane Smith",
    "email":     "jane@example.com",
    "message":   "Hello from my website!"
})
print(res.json())  # {'ok': True}`,
  };

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div class="page-title">Integration Hub</div>
      <div class="page-subtitle">Your API endpoint, keys, and ready-to-use code snippets.</div>
    </div>

    <!-- Endpoint + Key -->
    <div class="card mb-12">
      <div class="card-header"><span class="card-title">Endpoint & API Key</span></div>

      <div class="form-group">
        <label class="form-label">API Endpoint</label>
        <div class="code-row">
          <code>${esc(endpoint)}</code>
          <button class="copy-btn" onclick="copyText('${esc(endpoint)}', this)">Copy</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">API Key</label>
        <div class="key-display" id="key-display">
          <code id="key-value">${esc(maskedKey)}</code>
          <button class="reveal-btn" id="reveal-btn" onclick="toggleKeyReveal()">Reveal</button>
          <button class="copy-btn" onclick="copyText('${esc(p.api_key)}', this)">Copy</button>
        </div>
        <div class="form-hint">Keep this key private. It authenticates form submissions to this project.</div>
      </div>

      <div class="flex-between">
        <span class="text-muted" style="font-size:12.5px;">Key compromised? Rotate it immediately — old key stops working instantly.</span>
        <button class="btn btn-secondary btn-sm" onclick="regenKey()">Regenerate Key</button>
      </div>
    </div>

    <!-- Code snippets -->
    <div class="card mb-12">
      <div class="card-header"><span class="card-title">Code Snippets</span></div>
      <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
        <div class="code-tabs" style="padding:0 12px;background:var(--bg-elevated);">
          <button class="code-tab active" data-tab="javascript">JavaScript</button>
          <button class="code-tab" data-tab="curl">cURL</button>
          <button class="code-tab" data-tab="python">Python</button>
        </div>
        <div style="position:relative;">
          ${Object.entries(snippets).map(([lang, code]) => `
            <div class="code-tab-panel ${lang === 'javascript' ? 'active' : ''}" data-panel="${lang}">
              <div class="code-block" style="border:none;border-radius:0;margin:0;">${esc(code)}<button class="copy-btn code-copy-btn" onclick="copyText(window._snippets['${lang}'], this)">Copy</button></div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Form Builder -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Form Builder</span>
        <div class="flex-center gap-8">
          <button class="btn btn-ghost btn-sm" onclick="saveBuilderConfig()">Save config</button>
          <button class="btn btn-secondary btn-sm" id="copy-form-btn" onclick="copyGeneratedForm()">Copy form code</button>
        </div>
      </div>
      <p class="text-muted mb-16" style="font-size:12.5px;">Pick fields and a theme to generate a fully-styled, ready-to-paste contact form.</p>

      <!-- Fields -->
      <div class="form-group">
        <label class="form-label">Fields</label>
        <div class="field-picker" id="field-picker"></div>
      </div>

      <!-- Custom fields -->
      <div class="form-group">
        <label class="form-label">Custom fields <span style="color:var(--text-tertiary);font-weight:400;">(optional, max 2)</span></label>
        <div id="custom-fields-list"></div>
        <button class="btn btn-ghost btn-sm mt-8" id="add-custom-btn">+ Add custom field</button>
      </div>

      <!-- Theme + heading row -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Theme</label>
          <div class="theme-picker" id="theme-picker">
            <div class="theme-card" data-theme="minimal-light">
              <div class="theme-swatch" style="background:#fff;border:1px solid #D8DEE9;color:#0B0F1A;">Aa</div>
              <div class="theme-name">Light</div>
            </div>
            <div class="theme-card" data-theme="minimal-dark">
              <div class="theme-swatch" style="background:#11151F;color:#F5F7FB;">Aa</div>
              <div class="theme-name">Dark</div>
            </div>
            <div class="theme-card" data-theme="rounded">
              <div class="theme-swatch" style="background:#fff;border:1px solid #E5E5EA;border-radius:14px;color:#1A1A1A;">Aa</div>
              <div class="theme-name">Rounded</div>
            </div>
          </div>
        </div>
        <div>
          <div class="form-group">
            <label class="form-label">Form heading</label>
            <input type="text" id="form-title" placeholder="e.g. Get in Touch"/>
          </div>
          <div class="form-group">
            <label class="form-label">Subheading</label>
            <input type="text" id="form-subtitle" placeholder="e.g. We reply within 24 hours."/>
          </div>
        </div>
      </div>

      <!-- Live preview -->
      <div class="form-group">
        <label class="form-label">Live Preview</label>
        <div class="form-preview-frame" id="form-preview">
          <p style="color:var(--text-tertiary);font-size:13px;">Select fields above to see a preview.</p>
        </div>
      </div>

      <!-- Generated code -->
      <div class="form-group">
        <label class="form-label">Generated Code</label>
        <div class="code-block" id="generated-code" style="min-height:60px;font-size:11.5px;position:relative;">
          Select fields above to generate embed code.
          <button class="copy-btn code-copy-btn" onclick="copyGeneratedForm()">Copy</button>
        </div>
      </div>
    </div>`;

  // Store snippets for copy
  window._snippets = snippets;

  // Wire code tabs
  document.querySelectorAll('.code-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.code-tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.code-tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Init form builder
  initFormBuilder(p);
}

// Key reveal toggle
function toggleKeyReveal() {
  const p = STATE.project;
  if (!p) return;
  const el  = document.getElementById('key-value');
  const btn = document.getElementById('reveal-btn');
  if (!el || !btn) return;
  const isHidden = btn.textContent === 'Reveal';
  el.textContent = isHidden ? p.api_key : (p.api_key.slice(0,8) + '••••••••••••••••••••••••••••••••••••••••');
  btn.textContent = isHidden ? 'Hide' : 'Reveal';
}

// Regenerate API key
async function regenKey() {
  if (!confirm('Regenerate API key? The old key stops working immediately.')) return;
  const p = STATE.project;
  const { ok, project, error } = await api(`/api/projects/${encodeURIComponent(p.project_id)}/regenerate-key`, { method: 'POST' });
  if (ok) {
    STATE.project = project;
    showToast('API key regenerated.', 'success');
    await viewIntegration();
  } else {
    showToast(error || 'Failed.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// 10. FORM BUILDER (shared between integration view)
// ═══════════════════════════════════════════════════════════

const PRESET_FIELDS = [
  { key:'name',    label:'Full Name',      required:true,  hasOpts:false },
  { key:'email',   label:'Email',          required:true,  hasOpts:false },
  { key:'phone',   label:'Phone',          required:false, hasOpts:false },
  { key:'company', label:'Company',        required:false, hasOpts:false },
  { key:'subject', label:'Subject',        required:false, hasOpts:false },
  { key:'stack',   label:'Software Stack', required:false, hasOpts:true,
    presetOpts:'Zoho Suite, HubSpot, GoHighLevel, Salesforce, Multiple / Unintegrated, No CRM, Other' },
  { key:'message', label:'Message',        required:true,  hasOpts:false },
];

let _selFields   = ['name','email','message'];
let _selTheme    = 'minimal-light';
let _formTitle   = '';
let _formSub     = '';
let _customRows  = [];

function initFormBuilder(p) {
  // Load saved config
  const cfg = p.form_builder_config || {};
  if (cfg.selectedFields)  _selFields  = cfg.selectedFields;
  if (cfg.selectedTheme)   _selTheme   = cfg.selectedTheme;
  if (cfg.formTitle)       _formTitle  = cfg.formTitle;
  if (cfg.formSubtitle)    _formSub    = cfg.formSubtitle;
  if (cfg.customFieldRows) _customRows = cfg.customFieldRows.map((r,i) => ({...r, id: Date.now()+i}));

  renderChips();
  renderThemeCards();

  const titleEl = document.getElementById('form-title');
  const subEl   = document.getElementById('form-subtitle');
  if (titleEl) titleEl.value = _formTitle;
  if (subEl)   subEl.value   = _formSub;

  renderCustomRows();
  bindBuilderEvents();
  regenFormCode();
}

function renderChips() {
  const picker = document.getElementById('field-picker');
  if (!picker) return;
  picker.innerHTML = PRESET_FIELDS.map(f => `
    <span class="field-chip ${_selFields.includes(f.key) ? 'checked' : ''} ${f.required ? 'required-chip' : ''}"
          data-key="${f.key}" title="${f.required ? 'Required — cannot remove' : ''}">
      ${esc(f.label)}${f.required ? '<span class="req-star"> *</span>' : ''}
    </span>`).join('');
  picker.querySelectorAll('.field-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.key;
      const preset = PRESET_FIELDS.find(f => f.key === key);
      if (preset?.required) return;
      if (_selFields.includes(key)) {
        _selFields = _selFields.filter(k => k !== key);
        chip.classList.remove('checked');
      } else {
        _selFields.push(key);
        chip.classList.add('checked');
      }
      regenFormCode();
    });
  });
}

function renderThemeCards() {
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.theme === _selTheme);
    card.onclick = () => {
      _selTheme = card.dataset.theme;
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      regenFormCode();
    };
  });
}

function renderCustomRows() {
  const container = document.getElementById('custom-fields-list');
  const addBtn    = document.getElementById('add-custom-btn');
  if (!container) return;

  container.innerHTML = _customRows.map(row => `
    <div class="custom-field-row" data-id="${row.id}">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Label</label>
        <input type="text" class="cf-label" placeholder="e.g. Budget" value="${esc(row.label||'')}"/>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Name (no spaces)</label>
        <input type="text" class="cf-name" placeholder="e.g. budget" value="${esc(row.name||'')}"/>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Type</label>
        <select class="cf-type">
          <option value="text"     ${row.type==='text'    ?'selected':''}>Text</option>
          <option value="email"    ${row.type==='email'   ?'selected':''}>Email</option>
          <option value="tel"      ${row.type==='tel'     ?'selected':''}>Phone</option>
          <option value="select"   ${row.type==='select'  ?'selected':''}>Dropdown</option>
          <option value="textarea" ${row.type==='textarea'?'selected':''}>Textarea</option>
        </select>
      </div>
      <button class="remove-field-btn" data-id="${row.id}">×</button>
      ${row.type==='select' ? `
      <div style="grid-column:1/-1;margin-top:-4px;">
        <input type="text" class="cf-options" placeholder="Option 1, Option 2, Option 3" value="${esc(row.options||'')}"/>
      </div>` : ''}
    </div>`).join('');

  if (addBtn) addBtn.style.display = _customRows.length >= 2 ? 'none' : '';

  container.querySelectorAll('.custom-field-row').forEach(rowEl => {
    const id  = Number(rowEl.dataset.id);
    const ref = _customRows.find(r => r.id === id);
    if (!ref) return;

    rowEl.querySelector('.cf-label')?.addEventListener('input', e => {
      ref.label = e.target.value;
      const nameEl = rowEl.querySelector('.cf-name');
      if (nameEl && !nameEl.value) {
        nameEl.value = e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
        ref.name = nameEl.value;
      }
      regenFormCode();
    });
    rowEl.querySelector('.cf-name')?.addEventListener('input', e => {
      ref.name = e.target.value.replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
      e.target.value = ref.name;
      regenFormCode();
    });
    rowEl.querySelector('.cf-type')?.addEventListener('change', e => {
      ref.type = e.target.value;
      renderCustomRows();
      regenFormCode();
    });
    rowEl.querySelector('.cf-options')?.addEventListener('input', e => {
      ref.options = e.target.value;
      regenFormCode();
    });
    rowEl.querySelector('.remove-field-btn')?.addEventListener('click', () => {
      _customRows = _customRows.filter(r => r.id !== id);
      renderCustomRows();
      regenFormCode();
    });
  });
}

function bindBuilderEvents() {
  document.getElementById('add-custom-btn')?.addEventListener('click', () => {
    if (_customRows.length >= 2) { showToast('Max 2 custom fields.', 'error'); return; }
    _customRows.push({ id: Date.now(), label:'', name:'', type:'text', options:'' });
    renderCustomRows();
  });
  document.getElementById('form-title')?.addEventListener('input', e => { _formTitle = e.target.value; regenFormCode(); });
  document.getElementById('form-subtitle')?.addEventListener('input', e => { _formSub = e.target.value; regenFormCode(); });
}

function regenFormCode() {
  const p = STATE.project;
  if (!p) return;
  const codeEl    = document.getElementById('generated-code');
  const previewEl = document.getElementById('form-preview');
  if (!codeEl || !previewEl) return;

  const customFields = _customRows.filter(r => r.label && r.name).map(r => ({
    label: r.label, name: r.name, type: r.type,
    options: r.type === 'select' ? (r.options||'').split(',').map(o=>o.trim()).filter(Boolean) : [],
  }));

  if (!_selFields.length && !customFields.length) {
    codeEl.childNodes[0].textContent = 'Select fields above to generate embed code.';
    previewEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">Select at least one field.</p>';
    return;
  }

  const snippet = generateFormSnippet({
    endpoint: `${location.origin}/api/send/${p.project_id}`,
    apiKey: p.api_key,
    selectedFields: _selFields,
    customFields,
    theme: _selTheme,
    title: _formTitle,
    subtitle: _formSub,
  });

  window._lastSnippet = snippet;
  // Update code block preserving the copy button
  const copyBtn = codeEl.querySelector('.code-copy-btn');
  codeEl.textContent = snippet;
  if (copyBtn) codeEl.appendChild(copyBtn);

  previewEl.innerHTML = snippet.replace(/<script[\s\S]*?<\/script>/gi,'')
    + `<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;text-align:center;">Visual preview — submit disabled</p>`;
}

function copyGeneratedForm() {
  const code = window._lastSnippet || document.getElementById('generated-code')?.textContent;
  if (!code || code.startsWith('Select fields')) { showToast('Select fields first.','error'); return; }
  copyText(code);
}

async function saveBuilderConfig() {
  const p = STATE.project;
  if (!p) return;
  const cfg = {
    selectedFields: _selFields,
    selectedTheme:  _selTheme,
    formTitle:      _formTitle,
    formSubtitle:   _formSub,
    customFieldRows: _customRows.map(({id,...rest}) => rest),
  };
  const { ok } = await api(`/api/projects/${encodeURIComponent(p.project_id)}`, {
    method: 'PATCH', body: { formBuilderConfig: cfg },
  });
  showToast(ok ? 'Config saved.' : 'Failed to save.', ok ? 'success' : 'error');
}

// ═══════════════════════════════════════════════════════════
// 11. VIEW: AUTOMATION
// ═══════════════════════════════════════════════════════════

async function viewAutomation() {
  document.getElementById('topbar-actions').innerHTML = '';
  const p = STATE.project;

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div class="page-title">Automation</div>
      <div class="page-subtitle">Configure automated email workflows triggered by form submissions.</div>
    </div>

    <!-- Auto-reply -->
    <div class="card mb-12">
      <div class="card-header">
        <div>
          <span class="card-title">Auto-Reply to Submitter</span>
          <div class="text-muted mt-4" style="font-size:12.5px;">Send an automated confirmation email to whoever fills out the form.</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="ar-enabled" ${p.auto_reply_enabled ? 'checked' : ''}/>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div id="ar-fields" style="display:${p.auto_reply_enabled ? 'block' : 'none'};">
        <div class="divider"></div>

        <div class="card" style="background:var(--bg-elevated);border-color:var(--border);margin-bottom:16px;">
          <div class="section-title" style="margin-bottom:10px;">Available variables</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${['{{from_name}}','{{email}}','{{phone}}','{{company}}','{{message}}'].map(v =>
              `<code style="background:var(--bg-overlay);border:1px solid var(--border-md);border-radius:4px;padding:3px 8px;font-size:12px;color:var(--accent);">${esc(v)}</code>`
            ).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subject</label>
          <input type="text" id="ar-subject" value="${esc(p.auto_reply_subject || "Thanks for reaching out — we'll be in touch soon.")}"/>
          <div class="form-hint">Supports <code>{{field_name}}</code> placeholders.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Message body</label>
          <textarea id="ar-body" style="min-height:160px;font-family:var(--font-mono);font-size:12.5px;">${esc(p.auto_reply_body || '')}</textarea>
          <div class="form-hint">Plain text. Use line breaks for paragraphs. Supports <code>{{field_name}}</code> placeholders.</div>
        </div>

        <button class="btn btn-primary btn-sm" id="ar-save-btn" onclick="saveAutoReply()">Save auto-reply</button>
      </div>
    </div>

    <!-- Future workflows placeholder -->
    <div class="card">
      <div class="card-header"><span class="card-title">Webhook Notifications</span></div>
      <div class="empty-state" style="padding:32px 0;">
        <svg class="empty-state-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="20" cy="20" r="18"/><path d="M20 12v8l6 3"/>
        </svg>
        <h3>Coming soon</h3>
        <p>Forward submissions to Slack, Discord, or any webhook URL.</p>
      </div>
    </div>`;

  // Toggle show/hide auto-reply fields
  document.getElementById('ar-enabled').addEventListener('change', e => {
    document.getElementById('ar-fields').style.display = e.target.checked ? 'block' : 'none';
  });
}

async function saveAutoReply() {
  const p = STATE.project;
  const btn = document.getElementById('ar-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const body = {
    autoReplyEnabled: document.getElementById('ar-enabled').checked,
    autoReplySubject: document.getElementById('ar-subject')?.value?.trim() || '',
    autoReplyBody:    document.getElementById('ar-body')?.value || '',
  };

  const { ok, project, error } = await api(`/api/projects/${encodeURIComponent(p.project_id)}`, {
    method:'PATCH', body,
  });

  btn.disabled = false;
  btn.textContent = 'Save auto-reply';

  if (ok) {
    STATE.project = project;
    showToast('Auto-reply saved.', 'success');
  } else {
    showToast(error || 'Failed to save.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// 12. VIEW: SETTINGS
// ═══════════════════════════════════════════════════════════

async function viewSettings() {
  document.getElementById('topbar-actions').innerHTML = '';
  const p = STATE.project;

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div class="page-title">Project Settings</div>
      <div class="page-subtitle">Update configuration for ${esc(p.name)}.</div>
    </div>

    <form id="settings-form">
      <!-- General -->
      <div class="card mb-12">
        <div class="card-header"><span class="card-title">General</span></div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project name</label>
            <input type="text" id="s-name" value="${esc(p.name)}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Notification recipient</label>
            <input type="email" id="s-email" value="${esc(p.to_email)}"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Subject template</label>
          <input type="text" id="s-subject" value="${esc(p.subject_template)}"/>
          <div class="form-hint">Use <code>{{field_name}}</code> placeholders.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Allowed origins</label>
          <input type="text" id="s-origins" value="${esc((p.allowed_origins||[]).join(', '))}"/>
          <div class="form-hint">Comma-separated. No trailing slashes. Leave blank to allow all.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Rate limit (per IP per hour)</label>
            <input type="number" id="s-rate" value="${p.rate_limit_per_hour}" min="1" max="1000"/>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:1px;">
            <div class="checkbox-row">
              <input type="checkbox" id="s-active" ${p.is_active ? 'checked' : ''}/>
              <label for="s-active">Project is active</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Provider -->
      <div class="card mb-12">
        <div class="card-header"><span class="card-title">Email Provider</span></div>
        <div class="form-group">
          <label class="form-label">Provider</label>
          <select id="s-provider">
            <option value="resend" ${p.provider==='resend'?'selected':''}>Resend (platform default)</option>
            <option value="smtp"   ${p.provider==='smtp'  ?'selected':''}>My own Gmail / SMTP</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">"From" address</label>
          <input type="text" id="s-from" value="${esc(p.from_email)}"/>
        </div>

        <div id="s-smtp-fields" style="display:${p.provider==='smtp'?'block':'none'};">
          <div class="divider"></div>
          <p class="text-muted mb-12" style="font-size:12.5px;">
            Gmail: host <code>smtp.gmail.com</code>, port <code>465</code>, and a
            <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--accent);text-decoration:underline;">16-char App Password</a> (no spaces).
          </p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">SMTP host</label>
              <input type="text" id="s-smtp-host" value="${esc((p.provider_config||{}).host||'')}" placeholder="smtp.gmail.com"/>
            </div>
            <div class="form-group">
              <label class="form-label">Port</label>
              <input type="number" id="s-smtp-port" value="${(p.provider_config||{}).port||465}"/>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">SMTP username</label>
            <input type="text" id="s-smtp-user" value="${esc((p.provider_config||{}).user||'')}"/>
          </div>
          <div class="form-group">
            <label class="form-label">App password</label>
            <input type="text" id="s-smtp-pass" placeholder="Leave blank to keep existing"/>
            <div class="form-hint">Only fill in if you want to change the current password.</div>
          </div>
        </div>
      </div>

      <div class="flex-between mb-12">
        <button type="button" class="btn btn-ghost" onclick="navigate('overview')">Cancel</button>
        <button type="submit" class="btn btn-primary" id="s-save-btn">Save Changes</button>
      </div>
    </form>

    <!-- Danger zone -->
    <div class="danger-zone">
      <h3>Danger Zone</h3>
      <p>Permanently delete this project, its API key, and all submission history. This cannot be undone.</p>
      <button class="btn btn-danger btn-sm" onclick="deleteProject()">Delete Project</button>
    </div>`;

  // Provider toggle
  document.getElementById('s-provider').addEventListener('change', e => {
    document.getElementById('s-smtp-fields').style.display = e.target.value === 'smtp' ? 'block' : 'none';
  });

  // Save
  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const provider = document.getElementById('s-provider').value;
    const btn = document.getElementById('s-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const body = {
      name:             document.getElementById('s-name').value.trim(),
      toEmail:          document.getElementById('s-email').value.trim(),
      fromEmail:        document.getElementById('s-from').value.trim(),
      provider,
      subjectTemplate:  document.getElementById('s-subject').value.trim(),
      allowedOrigins:   document.getElementById('s-origins').value
        .split(',').map(s => s.trim().replace(/\/$/,'')).filter(Boolean),
      rateLimitPerHour: parseInt(document.getElementById('s-rate').value,10) || 20,
      isActive:         document.getElementById('s-active').checked,
    };

    if (provider === 'smtp') {
      const existing = p.provider_config || {};
      const newPass  = document.getElementById('s-smtp-pass').value;
      body.providerConfig = {
        host: document.getElementById('s-smtp-host').value.trim() || existing.host,
        port: parseInt(document.getElementById('s-smtp-port').value,10) || existing.port || 465,
        user: document.getElementById('s-smtp-user').value.trim() || existing.user,
        pass: newPass || existing.pass,
      };
    }

    const { ok, project, error } = await api(`/api/projects/${encodeURIComponent(p.project_id)}`, {
      method:'PATCH', body,
    });

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (ok) {
      STATE.project = project;
      showProjectNav(project);
      showToast('Settings saved.', 'success');
    } else {
      showToast(error || 'Failed to save.', 'error');
    }
  });
}

async function deleteProject() {
  if (!confirm(`Delete "${STATE.project?.name}"? This cannot be undone.`)) return;
  const { ok, error } = await api(`/api/projects/${encodeURIComponent(STATE.project.project_id)}`, { method:'DELETE' });
  if (ok) {
    STATE.project = null;
    STATE.projectId = null;
    document.getElementById('project-nav').classList.add('hidden');
    showToast('Project deleted.', 'success');
    navigate('projects');
  } else {
    showToast(error || 'Failed to delete.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// 13. VIEW: ACCOUNT SETTINGS
// ═══════════════════════════════════════════════════════════

async function viewAccount() {
  document.getElementById('topbar-actions').innerHTML = '';

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div class="page-title">Account Settings</div>
      <div class="page-subtitle">Manage your dashboard credentials and preferences.</div>
    </div>

    <!-- Change password -->
    <div class="card mb-12" style="max-width:480px;">
      <div class="card-header"><span class="card-title">Change Password</span></div>
      <p class="text-muted mb-16" style="font-size:12.5px;">
        Your new password will be saved to Vercel and take effect after the automatic redeployment
        (~60 seconds). You'll be signed out and need to log in again.
      </p>
      <form id="pw-form">
        <div class="form-group">
          <label class="form-label">Current password</label>
          <input type="password" id="pw-current" autocomplete="current-password" required/>
          <div class="form-error" id="err-pw-current"></div>
        </div>
        <div class="form-group">
          <label class="form-label">New password</label>
          <input type="password" id="pw-new" autocomplete="new-password" required/>
          <div class="form-error" id="err-pw-new"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirm new password</label>
          <input type="password" id="pw-confirm" autocomplete="new-password" required/>
          <div class="form-error" id="err-pw-confirm"></div>
        </div>
        <button type="submit" class="btn btn-primary" id="pw-btn">Update Password</button>
      </form>
    </div>

    <!-- Info -->
    <div class="card mb-12" style="max-width:480px;">
      <div class="card-header"><span class="card-title">Platform Info</span></div>
      <div class="workflow-row" style="border:none;padding:0;">
        <div class="workflow-info"><h3>Authentication</h3><p>Single-user, shared password (v1)</p></div>
      </div>
      <div class="divider"></div>
      <div class="workflow-row" style="border:none;padding:0;">
        <div class="workflow-info"><h3>Multi-user accounts</h3><p>Planned for v2 — will use Supabase Auth</p></div>
        <span class="badge">Coming soon</span>
      </div>
    </div>

    <!-- Appearance -->
    <div class="card" style="max-width:480px;">
      <div class="card-header"><span class="card-title">Appearance</span></div>
      <div class="workflow-row" style="border:none;padding:0;margin-top:4px;">
        <div class="workflow-info">
          <h3>Dark mode</h3>
          <p>Toggle between dark and light interface.</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="theme-check" ${(localStorage.getItem('theme')||'dark')==='dark'?'checked':''}/>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>`;

  // Theme toggle in account page
  document.getElementById('theme-check').addEventListener('change', e => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });

  // Password change form
  document.getElementById('pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearFormErrors();

    const current  = document.getElementById('pw-current').value;
    const newPw    = document.getElementById('pw-new').value;
    const confirm  = document.getElementById('pw-confirm').value;
    let valid = true;

    if (!current) { showFormError('pw-current', 'Enter your current password.'); valid = false; }
    if (newPw.length < 8) { showFormError('pw-new', 'Password must be at least 8 characters.'); valid = false; }
    if (newPw !== confirm) { showFormError('pw-confirm', 'Passwords do not match.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('pw-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Updating…';

    const { ok, error } = await api('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: current, newPassword: newPw },
    });

    btn.disabled = false;
    btn.textContent = 'Update Password';

    if (ok) {
      showToast('Password updated. Signing you out…', 'success');
      setTimeout(async () => {
        await api('/api/auth/logout', { method: 'POST' });
        location.href = 'login.html';
      }, 2000);
    } else {
      showToast(error || 'Failed to update password.', 'error');
      if (error?.toLowerCase().includes('current')) {
        showFormError('pw-current', error);
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// 14. FORM HELPERS
// ═══════════════════════════════════════════════════════════

function showFormError(id, msg) {
  const el  = document.getElementById(id);
  const err = document.getElementById('err-' + id);
  if (el)  el.classList.add('has-error');
  if (err) { err.textContent = msg; err.classList.add('show'); }
}

function clearFormErrors() {
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.has-error').forEach(e => e.classList.remove('has-error'));
}

// ═══════════════════════════════════════════════════════════
// 15. INIT
// ═══════════════════════════════════════════════════════════

async function init() {
  // Auth check
  const { authenticated } = await api('/api/auth/session');
  if (!authenticated) { location.href = 'login.html'; return; }

  initTheme();
  initSidebar();

  // Slide-over close
  document.getElementById('slideover-close')?.addEventListener('click', closeSlideover);
  document.getElementById('slideover-overlay')?.addEventListener('click', closeSlideover);

  // Hash routing
  window.addEventListener('hashchange', route);
  await route();
}

init();
