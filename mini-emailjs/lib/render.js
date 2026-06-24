// lib/render.js
// Tiny template engine: replaces {{field_name}} with values from the
// submitted form data. No external dependencies, intentionally simple.

/**
 * Escape HTML special characters to prevent injection when form data
 * is interpolated into the email's HTML body.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replace {{key}} placeholders in a template string with values from data.
 * Unknown placeholders are replaced with an empty string.
 * All values are HTML-escaped.
 *
 * @param {string} template - e.g. "New message from {{from_name}}"
 * @param {Object} data     - e.g. { from_name: 'Jane', email: 'jane@x.com' }
 */
export function renderTemplate(template, data) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined ? escapeHtml(value) : '';
  });
}

/**
 * Build a clean, readable HTML email body from arbitrary form fields.
 * Renders each field as a labeled row in a simple table layout.
 *
 * @param {Object} data - form fields submitted by the visitor
 * @param {Object} [meta] - extra metadata to show (e.g. submitted_at, project name)
 */
export function buildEmailBody(data, meta = {}) {
  const rows = Object.entries(data)
    .filter(([key]) => !key.startsWith('_')) // skip honeypot / internal fields
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:8px 16px;font-weight:600;color:#1E2D47;font-family:sans-serif;font-size:13px;vertical-align:top;white-space:nowrap;">
            ${escapeHtml(formatLabel(key))}
          </td>
          <td style="padding:8px 16px;color:#334155;font-family:sans-serif;font-size:13px;">
            ${escapeHtml(value).replace(/\n/g, '<br/>')}
          </td>
        </tr>`
    )
    .join('');

  const metaRows = Object.entries(meta)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:6px 16px;color:#8899B4;font-family:sans-serif;font-size:12px;white-space:nowrap;">
            ${escapeHtml(formatLabel(key))}
          </td>
          <td style="padding:6px 16px;color:#8899B4;font-family:sans-serif;font-size:12px;">
            ${escapeHtml(value)}
          </td>
        </tr>`
    )
    .join('');

  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#080D18;padding:24px 28px;border-radius:12px 12px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">New Form Submission</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#F5F7FB;border-radius:0 0 12px 12px;overflow:hidden;">
      ${rows}
    </table>
    ${
      Object.keys(meta).length
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${metaRows}</table>`
        : ''
    }
  </div>`;
}

/** Convert snake_case / camelCase field names into readable labels. */
function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
