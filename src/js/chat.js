/**
 * chat.js
 * Owns the in-memory conversation state (session-only — cleared on refresh,
 * per project decision) and talks to the /api/chat serverless endpoint.
 * The frontend never talks to Groq directly (SDS Security §9 / §11).
 */
(function (global) {
  'use strict';

  const { fetchJSON } = global.APAI.utils;

  /** @type {Array<{role: 'user'|'assistant', content: string}>} */
  const history = [];

  const MAX_HISTORY_MESSAGES = 12; // mirrors config/settings.json maxHistoryMessages

  function pushHistory(role, content) {
    history.push({ role, content });
    if (history.length > MAX_HISTORY_MESSAGES) {
      history.splice(0, history.length - MAX_HISTORY_MESSAGES);
    }
  }

  /**
   * Sends the user's message to the backend and renders the response.
   * Handles network/timeout failures gracefully — conversation history
   * is preserved and the user is invited to retry (SDS Prompt Engineering §13).
   * @param {string} text
   */
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    global.APAI.ui.appendUserMessage(trimmed);
    pushHistory('user', trimmed);
    global.APAI.ui.showTyping();

    try {
      const response = await fetchJSON('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      global.APAI.ui.hideTyping();

      const { message, actions } = response;
      global.APAI.ui.appendAssistantMessage(message, actions);
      pushHistory('assistant', message);

      if (Array.isArray(actions) && actions.length) {
        // Auto-render the first card-type action into the preview panel,
        // if any, so recruiters see it without an extra click.
        const cardAction = actions.find((a) => a.cardType);
        if (cardAction) {
          global.APAI.renderer.renderIntoPreview(cardAction.cardType, cardAction.payload);
        }
      }
    } catch (err) {
      console.error('[chat.js] request failed', err);
      global.APAI.ui.hideTyping();
      global.APAI.ui.appendAssistantMessage(
        "Sorry, I'm having trouble reaching my knowledge base right now. Could you try asking again in a moment?"
      );
    }
  }

  global.APAI = global.APAI || {};
  global.APAI.chat = { sendMessage, history };
})(window);
