// public/form-generator.js
//
// Generates a complete, styled, ready-to-paste contact form (HTML + CSS + JS)
// wired to a project's /api/send/:projectId endpoint.
//
// Used by project.html's "Form Builder" section.

/**
 * Built-in field presets. Each has a stable `key`, the HTML `name` attribute
 * used in the submitted payload, a label, input type, and whether it's
 * required by default.
 */
const FIELD_PRESETS = [
  { key: 'name',    name: 'from_name', label: 'Full Name',  type: 'text',     required: true  },
  { key: 'email',   name: 'email',     label: 'Email',      type: 'email',    required: true  },
  { key: 'phone',   name: 'phone',     label: 'Phone',      type: 'tel',      required: false },
  { key: 'company', name: 'company',   label: 'Company',    type: 'text',     required: false },
  { key: 'subject', name: 'subject',   label: 'Subject',    type: 'text',     required: false },
  { key: 'message', name: 'message',  label: 'Message',    type: 'textarea', required: true  },
];

/**
 * Theme presets. Each is a self-contained set of CSS custom properties +
 * base styles, scoped under `.mek-form` so it won't leak into / clash with
 * the host site's existing styles.
 */
const THEMES = {
  'minimal-light': {
    label: 'Minimal Light',
    css: `
.mek-form {
  --mek-bg: #ffffff;
  --mek-text: #0B0F1A;
  --mek-muted: #5C6B85;
  --mek-border: #D8DEE9;
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
  --mek-accent: #5B5BD6;
  --mek-accent-text: #FFFFFF;
  --mek-radius: 22px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 480px;
}`,
  },
};

/** Shared base CSS — uses the --mek-* variables set by the chosen theme. */
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
}
.mek-form input,
.mek-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 13px;
  border: 1px solid var(--mek-border);
  border-radius: var(--mek-radius);
  background: transparent;
  color: var(--mek-text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.mek-form input:focus,
.mek-form textarea:focus {
  border-color: var(--mek-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mek-accent) 18%, transparent);
}
.mek-form textarea {
  min-height: 110px;
  resize: vertical;
}
.mek-form button {
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
.mek-form button:hover { opacity: 0.9; }
.mek-form button:disabled { opacity: 0.6; cursor: not-allowed; }
.mek-form .mek-status {
  margin-top: 12px;
  font-size: 13px;
  display: none;
}
.mek-form .mek-status.show { display: block; }
.mek-form .mek-status.success { color: var(--mek-accent); }
.mek-form .mek-status.error { color: #EF4444; }
`;

/**
 * Build the list of fields to render, combining selected presets and
 * custom fields, in a sensible order (text inputs first, message/textarea last).
 *
 * @param {string[]} selectedPresetKeys - keys from FIELD_PRESETS to include
 * @param {Array<{label: string, name: string, type: string}>} customFields
 * @returns {Array} ordered field definitions
 */
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
    }));

  const all = [...presets, ...customs];

  // Put textarea-type fields last for a more natural form layout
  const inputs = all.filter((f) => f.type !== 'textarea');
  const textareas = all.filter((f) => f.type === 'textarea');
  return [...inputs, ...textareas];
}

/** Escape a value for safe interpolation into HTML attributes/text. */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate the complete embed code (HTML + <style> + <script>) for a
 * customized contact form.
 *
 * @param {Object} opts
 * @param {string} opts.endpoint - the project's API endpoint URL
 * @param {string} opts.apiKey - the project's API key
 * @param {string[]} opts.selectedFields - preset field keys to include
 * @param {Array} [opts.customFields] - additional custom fields
 * @param {string} [opts.theme] - theme key from THEMES (default 'minimal-light')
 * @param {string} [opts.title] - optional heading shown above the form
 * @param {string} [opts.subtitle] - optional subtext shown below the heading
 * @returns {string} complete embeddable snippet
 */
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

  const fieldHtml = fields
    .map((f) => {
      const id = `mek-${f.name}`;
      const reqAttr = f.required ? ' required' : '';
      const reqMark = f.required ? ' *' : '';

      if (f.type === 'textarea') {
        return `      <div class="mek-group">
        <label for="${id}">${esc(f.label)}${reqMark}</label>
        <textarea id="${id}" name="${esc(f.name)}"${reqAttr}></textarea>
      </div>`;
      }

      return `      <div class="mek-group">
        <label for="${id}">${esc(f.label)}${reqMark}</label>
        <input type="${esc(f.type)}" id="${id}" name="${esc(f.name)}"${reqAttr}/>
      </div>`;
    })
    .join('\n');

  const headerHtml = title || subtitle
    ? `      ${title ? `<h3>${esc(title)}</h3>` : ''}\n      ${subtitle ? `<p class="mek-sub">${esc(subtitle)}</p>` : ''}\n`
    : '';

  return `<!-- Mini-EmailJS contact form (theme: ${themeDef.label}) -->
<style>
${themeDef.css.trim()}
${BASE_CSS.trim()}
</style>

<form class="mek-form" id="mek-contact-form">
${headerHtml}${fieldHtml}
      <!-- Honeypot — kept hidden, bots often fill it in -->
      <input type="text" name="_gotcha" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off"/>

      <button type="submit">Send Message</button>
      <div class="mek-status" id="mek-status"></div>
</form>

<script>
(function () {
  const ENDPOINT = "${endpoint}";
  const API_KEY  = "${apiKey}";

  const form = document.getElementById('mek-contact-form');
  const status = document.getElementById('mek-status');
  const button = form.querySelector('button');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    status.className = 'mek-status';
    status.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    data.apiKey = API_KEY;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Sending…';

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.ok) {
        status.textContent = 'Thanks — your message has been sent!';
        status.className = 'mek-status show success';
        form.reset();
      } else {
        status.textContent = 'Error: ' + (result.error || 'Something went wrong.');
        status.className = 'mek-status show error';
      }
    } catch (err) {
      status.textContent = 'Network error. Please try again.';
      status.className = 'mek-status show error';
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
})();
</script>`;
}
