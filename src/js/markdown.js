/**
 * markdown.js
 * Renders a deliberately small, safe subset of Markdown for assistant messages:
 * **bold**, *italic*, line breaks, and "- " bullet lists.
 *
 * Design choice: the assistant's conversational text should never contain raw
 * links (per the SDS — links are structured actions, not inline markdown links),
 * so this renderer intentionally does NOT support [text](url) syntax. That keeps
 * the action registry as the single source of truth for anything clickable.
 *
 * Input is escaped BEFORE any markdown transformation, so the model can never
 * inject raw HTML/script through its response text.
 */
(function (global) {
  'use strict';

  const { escapeHtml } = global.APAI.utils;

  /**
   * @param {string} raw - plain text (possibly containing the supported markdown subset)
   * @returns {string} safe HTML string
   */
  function renderInline(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return out;
  }

  function toHtml(raw) {
    if (!raw) return '';
    const lines = raw.split('\n');
    const htmlParts = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (!inList) {
          htmlParts.push('<ul>');
          inList = true;
        }
        htmlParts.push(`<li>${renderInline(trimmed.slice(2))}</li>`);
      } else {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (trimmed.length > 0) {
          htmlParts.push(`<p>${renderInline(trimmed)}</p>`);
        }
      }
    }
    if (inList) htmlParts.push('</ul>');

    return htmlParts.join('');
  }

  global.APAI = global.APAI || {};
  global.APAI.markdown = { toHtml };
})(window);
