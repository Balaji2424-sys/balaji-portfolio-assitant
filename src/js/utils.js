/**
 * utils.js
 * Small, dependency-free helpers shared across the assistant modules.
 * Exposed on window.APAI.utils so plain <script> tags (no bundler) can use them.
 */
(function (global) {
  'use strict';

  /**
   * Fetch JSON with basic error handling. Never throws silently —
   * callers get a rejected promise they can catch and show a friendly message for.
   * @param {string} url
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`Request to ${url} failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Escapes HTML special characters. Used before injecting any text
   * (user input or model output) into the DOM via innerHTML.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Debounce a function call.
   * @param {Function} fn
   * @param {number} wait ms
   */
  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * Generates a short unique-enough id for DOM keys (message ids, etc).
   * Not cryptographically unique — fine for session-scoped UI state.
   */
  function uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  global.APAI = global.APAI || {};
  global.APAI.utils = { fetchJSON, escapeHtml, debounce, uid };
})(window);
