// public/form-generator.js
// Generates complete, styled, ready-to-paste contact form snippets.
// Supports text, email, tel, textarea, and select (dropdown) field types.

const FIELD_PRESETS = [
  { key: 'name',    name: 'from_name', label: 'Full Name',      type: 'text',     required: true  },
  { key: 'email',   name: 'email',     label: 'Email',          type: 'email',    required: true  },
  { key: 'phone',   name: 'phone',     label: 'Phone',          type: 'tel',      required: false },
  { key: 'company', name: 'company',   label: 'Company',        type: 'text',     required: false },
  { key: 'subject', name: 'subject',   label: 'Subject',        type: 'text',     required: false },
  { key: 'stack',   name: 'stack',     label: 'Software Stack', type: 'select',   required: false,
    options: [
      'Zoho Suite',
      'HubSpot',
      'GoHighLevel',
      'Salesforce',
      'Multiple / Unintegrated Platforms',
      'No CRM Currently',
      'Other',
    ]
  },
  { key: 'message', name: 'message',  label: 'Message',        type: 'textarea', required: true  },
];

const THEMES = {
  'minimal-light': {
    label: 'Minimal Light',
    css: `
.mek-form {
  --mek-bg: #ffffff;
  --mek-text: #0B0F1A;
  --mek-muted: #5C6B85;
  --mek-border: #D8DEE9;
  --mek-input-bg: #F5F7FB;
  --mek-accent: #00C98D;
  --mek-accent-text: #0B0F1A;
  --mek-radius: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 480px;
}`,
  },
  'minimal-dark': {
    label: 'Minimal Dark',
    css: `
.mek-form {
  --mek-bg: #11151F;
  --mek-text: #F5F7FB;
  --mek-muted: #8A99B4;
  --mek-border: #2A3349;
  --mek-input-bg: #1A2235;
  --mek-accent: #00D49A;
  --mek-accent-text: #0B0F1A;
  --mek-radius: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 480px;
}`,
  },
  rounded: {
    label: 'Rounded',
    css: `
.mek-form {
  --mek-bg: #FFFFFF;
  --mek-text: #1A1A1A;
  --mek-muted: #767676;
  --mek-border: #E5E5EA;
  --mek-input-bg: #F8F8F8;
  --mek-accent: #5B5BD6;
  --mek-accent-text: #FFFFFF;
  --mek-radius: 22px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 480px;
}`,
  },
};

const BASE_CSS = `
.mek-form {
  background: var(--mek-bg);
  color: var(--mek-text);
  padding: 28px;
  border-radius: calc(var(--mek-radius) + 6px);
  border: 1px solid var(--mek-border);
}
.mek-form h3 {
  margin: 0 0 6px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--mek-text);
}
.mek-form p.mek-sub {
  margin: 0 0 20px;
  font-size: 13.5px;
  color: var(--mek-muted);
}
.mek-form .mek-group {
  margin-bottom: 14px;
}
.mek-form label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--mek-text);
}
.mek-form input,
.mek-form textarea,
.mek-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 13px;
  border: 1px solid var(--mek-border);
  border-radius: var(--mek-radius);
  background: var(--mek-input-bg);
  color: var(--mek-text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
}
.mek-form input:focus,
.mek-form textarea:focus,
.mek-form select:focus {
  border-color: var(--mek-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mek-accent) 18%, transparent);
}
.mek-form select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C6B85' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 13px center;
  padding-right: 36px;
  cursor: pointer;
}
.mek-form textarea {
  min-height: 110px;
  resize: vertical;
}
.mek-form button[type="submit"] {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--mek-radius);
  background: var(--mek-accent);
  color: var(--mek-accent-text);
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.mek-form button[type="submit"]:hover { opacity: 0.9; }
.mek-form button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
.mek-form .mek-status {
  margin-top: 12px;
  font-size: 13px;
  display: none;
  padding: 10px 14px;
  border-radius: var(--mek-radius);
}
.mek-form .mek-status.show { display: block; }
.mek-form .mek-status.success {
  color: #065F46;
  background: #D1FAE5;
  border: 1px solid #6EE7B7;
}
.mek-form .mek-status.error {
  color: #991B1B;
  background: #FEE2E2;
  border: 1px solid #FCA5A5;
}
`;

function buildFieldList(selectedPresetKeys, customFields = []) {
  const presets = FIELD_PRESETS.filter((f) => selectedPresetKeys.includes(f.key));
  const customs = customFields
    .filter((f) => f.label && f.name)
    .map((f) => ({
      key: 'custom:' + f.name,
      name: f.name,
      label: f.label,
      type: f.type || 'text',
      required: !!f.required,
      options: f.options || [],
    }));

  const all = [...presets, ...customs];
  // Put textareas last
  const inputs = all.filter((f) => f.type !== 'textarea');
  const textareas = all.filter((f) => f.type === 'textarea');
  return [...inputs, ...textareas];
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFieldHtml(f) {
  const id = `mek-${f.name}`;
  const reqAttr = f.required ? ' required' : '';
  const reqMark = f.required ? ' *' : '';

  if (f.type === 'textarea') {
    return `      <div class="mek-group">
        <label for="${id}">${esc(f.label)}${reqMark}</label>
        <textarea id="${id}" name="${esc(f.name)}"${reqAttr}></textarea>
      </div>`;
  }

  if (f.type === 'select') {
    const opts = (f.options || [])
      .map(o => `          <option value="${esc(o)}">${esc(o)}</option>`)
      .join('\n');
    return `      <div class="mek-group">
        <label for="${id}">${esc(f.label)}${reqMark}</label>
        <select id="${id}" name="${esc(f.name)}"${reqAttr}>
          <option value="" disabled selected>Select an option…</option>
${opts}
        </select>
      </div>`;
  }

  return `      <div class="mek-group">
        <label for="${id}">${esc(f.label)}${reqMark}</label>
        <input type="${esc(f.type)}" id="${id}" name="${esc(f.name)}"${reqAttr}/>
      </div>`;
}

function generateFormSnippet({
  endpoint,
  apiKey,
  selectedFields,
  customFields = [],
  theme = 'minimal-light',
  title = '',
  subtitle = '',
}) {
  const fields = buildFieldList(selectedFields, customFields);
  const themeDef = THEMES[theme] || THEMES['minimal-light'];

  const fieldHtml = fields.map(renderFieldHtml).join('\n');

  const headerHtml = (title || subtitle)
    ? `      ${title    ? `<h3>${esc(title)}</h3>` : ''}
      ${subtitle ? `<p class="mek-sub">${esc(subtitle)}</p>` : ''}\n`
    : '';

  return `<!-- Mini-EmailJS contact form (theme: ${themeDef.label}) -->
<style>
${themeDef.css.trim()}
${BASE_CSS.trim()}
</style>

<form class="mek-form" id="mek-contact-form">
${headerHtml}${fieldHtml}

      <!-- Honeypot — hidden from real users, bots often fill it in -->
      <input type="text" name="_gotcha" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off"/>

      <button type="submit">Send Message</button>
      <div class="mek-status" id="mek-status"></div>
</form>

<script>
(function () {
  var ENDPOINT = "${endpoint}";
  var API_KEY  = "${apiKey}";

  var form   = document.getElementById('mek-contact-form');
  var status = document.getElementById('mek-status');
  var button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    status.className = 'mek-status';
    status.textContent = '';

    var data = Object.fromEntries(new FormData(form).entries());
    data.apiKey = API_KEY;

    button.disabled = true;
    var originalText = button.textContent;
    button.textContent = 'Sending\u2026';

    try {
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      var result = await res.json();

      if (result.ok) {
        status.textContent = 'Thanks \u2014 your message has been sent!';
        status.className = 'mek-status show success';
        form.reset();
      } else {
        status.textContent = 'Error: ' + (result.error || 'Something went wrong.');
        status.className = 'mek-status show error';
      }
    } catch (err) {
      console.error('[Mini-EmailJS] fetch error:', err);
      status.textContent = 'Network error (' + (err.message || 'unknown') + '). Please try again.';
      status.className = 'mek-status show error';
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
})();
</script>`;
}
