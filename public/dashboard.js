// public/dashboard.js
// Shared helpers used across all dashboard pages.

/** Wrapper around fetch that always sends/receives JSON and includes cookies. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'same-origin',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: `Unexpected response (${res.status})` };
  }

  if (res.status === 401) {
    // Session expired or not logged in — redirect to login
    if (!location.pathname.endsWith('login.html')) {
      location.href = 'login.html';
    }
  }

  return { status: res.status, ...data };
}

/** Show a small toast message at the bottom of the screen. */
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = type === 'error' ? 'error' : '';
  // Force reflow so the transition re-triggers if shown again quickly
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/** Copy text to clipboard and flash the button that triggered it. */
function copyToClipboard(text, btnEl) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      if (btnEl) {
        const original = btnEl.textContent;
        btnEl.textContent = 'Copied!';
        btnEl.classList.add('copied');
        setTimeout(() => {
          btnEl.textContent = original;
          btnEl.classList.remove('copied');
        }, 1500);
      }
      showToast('Copied to clipboard');
    })
    .catch(() => showToast('Failed to copy', 'error'));
}

/** Format an ISO timestamp into a short, readable local string. */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Escape HTML for safe interpolation into innerHTML. */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Redirect to login if not authenticated. Call at the top of protected pages. */
async function requireAuth() {
  const { authenticated } = await api('/api/auth/session');
  if (!authenticated) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

/** Wire up the logout button (id="logout-btn") if present on the page. */
function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = 'login.html';
  });
}
