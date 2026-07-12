/**
 * ui.js
 * DOM rendering: message bubbles, typing indicator, theme toggle, toasts.
 * Theme toggle logic is intentionally identical to the portfolio's own
 * script.js (same localStorage key, same particle palette) so switching
 * themes here feels like the same product, not a different one.
 */
(function (global) {
  'use strict';

  const { escapeHtml, uid } = global.APAI.utils;

  // ── THEME TOGGLE (mirrors portfolio script.js) ──────────────────
  function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('bp-theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    initParticles(savedTheme);

    themeToggle?.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('bp-theme', next);
      initParticles(next);
    });
  }

  function initParticles(theme) {
    if (!global.particlesJS) return;
    if (global.pJSDom && global.pJSDom.length) {
      global.pJSDom.forEach((instance) => instance.pJS.fn.vendors.destroypJS());
      global.pJSDom = [];
    }
    const isDark = theme === 'dark';
    particlesJS('particles-js', {
      particles: {
        number: { value: 70 },
        color: { value: isDark ? '#7C3AED' : '#6D28D9' },
        shape: { type: 'circle' },
        opacity: { value: isDark ? 0.35 : 0.45 },
        size: { value: 2 },
        move: { enable: true, speed: 1 },
        line_linked: {
          enable: true,
          distance: 120,
          color: isDark ? '#06B6D4' : '#0891A8',
          opacity: isDark ? 0.18 : 0.22,
          width: 1,
        },
      },
    });
  }

  // ── MESSAGES ─────────────────────────────────────────────────
  const messagesEl = () => document.getElementById('messages');

  function appendMessage(role, htmlContent, { actions = [] } = {}) {
    const el = document.createElement('div');
    el.className = `ai-message ${role}`;
    el.id = uid('msg');
    el.innerHTML = htmlContent;

    if (actions.length) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'ai-message-actions';
      actionsEl.innerHTML = actions
        .map(
          (a, i) => `<button class="ai-action-btn ${i === 0 ? 'primary' : ''}"
            data-action-index="${i}">${escapeHtml(a.label || a.type)}</button>`
        )
        .join('');
      el.appendChild(actionsEl);

      actionsEl.querySelectorAll('button').forEach((btn, i) => {
        btn.addEventListener('click', () => global.APAI.actions.dispatch(actions[i]));
      });
    }

    messagesEl().appendChild(el);
    messagesEl().scrollTop = messagesEl().scrollHeight;
    return el;
  }

  function appendUserMessage(text) {
    return appendMessage('user', `<p>${escapeHtml(text)}</p>`);
  }

  function appendAssistantMessage(markdownText, actions) {
    const html = global.APAI.markdown.toHtml(markdownText);
    return appendMessage('assistant', html, { actions });
  }

  let typingEl = null;
  function showTyping() {
    typingEl = document.createElement('div');
    typingEl.className = 'ai-typing';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesEl().appendChild(typingEl);
    messagesEl().scrollTop = messagesEl().scrollHeight;
  }
  function hideTyping() {
    typingEl?.remove();
    typingEl = null;
  }

  // ── TOAST ────────────────────────────────────────────────────
  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:var(--clr-surface); border:1px solid var(--clr-border);
      color:var(--clr-text); padding:10px 18px; border-radius:999px;
      font-family:var(--font-body); font-size:0.85rem; z-index:200;
      box-shadow:0 10px 30px rgba(0,0,0,.3);`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ── SUGGESTED CHIPS ──────────────────────────────────────────
  function wireChips(onSelect) {
    document.querySelectorAll('.ai-chip[data-question]').forEach((chip) => {
      chip.addEventListener('click', () => onSelect(chip.dataset.question));
    });
  }

  global.APAI = global.APAI || {};
  global.APAI.ui = {
    initTheme,
    appendUserMessage,
    appendAssistantMessage,
    showTyping,
    hideTyping,
    showToast,
    wireChips,
  };
})(window);
