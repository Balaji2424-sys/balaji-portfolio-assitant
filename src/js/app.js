/**
 * app.js
 * Entry point. Wires up the page once the DOM is ready. Kept intentionally
 * thin — all real logic lives in the other modules.
 */
(function (global) {
  'use strict';

  function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }

  function init() {
    global.APAI.ui.initTheme();
    global.APAI.ui.initPreviewPanel();

    // Greeting is the first assistant message, sourced from config/ui.json
    // rather than hardcoded, so it can change without touching app.js.
    global.APAI.utils
      .fetchJSON('config/ui.json')
      .then((cfg) => {
        global.APAI.ui.appendAssistantMessage(cfg.greeting);
      })
      .catch(() => {
        global.APAI.ui.appendAssistantMessage("Hi! I'm Balaji Parasuraman. How can I help you today?");
      });

    global.APAI.ui.wireChips((question) => {
      global.APAI.chat.sendMessage(question);
    });

    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    input.addEventListener('input', () => autoGrow(input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value;
      if (!text.trim()) return;
      input.value = '';
      autoGrow(input);
      sendBtn.disabled = true;
      await global.APAI.chat.sendMessage(text);
      sendBtn.disabled = false;
      input.focus();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
