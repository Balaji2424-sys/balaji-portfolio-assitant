/**
 * actions.js
 * Frontend Action Dispatcher (SDS: Function Calling & Smart Actions §8).
 *
 * The LLM never executes browser behavior directly — it returns action
 * identifiers + a target payload. This module is the ONLY place those
 * identifiers get turned into real DOM/browser effects, and it refuses
 * anything not present in config/actions.json (§11 Security).
 */
(function (global) {
  'use strict';

  const { fetchJSON } = global.APAI.utils;

  let registry = null; // loaded once from config/actions.json

  async function loadRegistry() {
    if (!registry) {
      registry = await fetchJSON('config/actions.json');
    }
    return registry;
  }

  /**
   * Handlers. Each receives the resolved action object:
   * { type, label, target, payload }
   * "target" is already resolved to a real path/URL by the Document/Link
   * registries — this layer never invents a path itself.
   */
  const handlers = {
    openLink(action) {
      if (!action.target) return notifyUnavailable(action);
      window.open(action.target, '_blank', 'noopener');
    },
    downloadFile(action) {
      if (!action.target) return notifyUnavailable(action);
      const a = document.createElement('a');
      a.href = action.target;
      a.download = action.filename || '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    openPdfViewer(action) {
      if (!action.target) return notifyUnavailable(action);
      // Show a compact inline preview in the right panel immediately,
      // AND open the full PDF.js modal for zoom/page navigation —
      // matches the "the preview panel should actually show what I
      // asked to view" feedback, rather than only opening a modal.
      global.APAI.renderer.renderDocumentPreview(action.target, action.label);
      global.APAI.pdfViewer.open(action.target, action.label);
    },
    // Used by the "Expand ↗" button inside an inline doc preview —
    // just opens the full modal viewer for a target already on screen.
    __EXPAND_DOC__(action) {
      global.APAI.pdfViewer.open(action.target, action.label);
    },
    openGallery(action) {
      if (!action.albumId) return notifyUnavailable(action);
      global.APAI.gallery.open(action.albumId);
    },
    renderCard(action) {
      global.APAI.renderer.renderIntoPreview(action.cardType, action.payload);
    },
    sendEmail(action) {
      if (!action.target) return notifyUnavailable(action);
      window.location.href = `mailto:${action.target}`;
    },
    copyToClipboard(action) {
      if (!action.target) return notifyUnavailable(action);
      navigator.clipboard?.writeText(action.target);
      global.APAI.ui?.showToast?.(`Copied: ${action.target}`);
    },
  };

  /**
   * Notice shown in place of a broken action — never a dead button or stack trace.
   * (SDS Function Calling §9 Error Handling)
   */
  function notifyUnavailable(action) {
    global.APAI.ui?.showToast?.(
      `${action.label || 'That resource'} isn't available right now.`
    );
  }

  /**
   * Validate + dispatch a single action returned by the API.
   * @param {{type: string, label?: string, target?: string, [k: string]: any}} action
   */
  async function dispatch(action) {
    if (action.type === '__EXPAND_DOC__') {
      handlers.__EXPAND_DOC__(action);
      return;
    }

    const reg = await loadRegistry();
    const entry = reg[action.type];

    if (!entry) {
      // Unknown / unlisted action type — refuse silently at the execution
      // level, but surface a friendly notice so the UI never looks broken.
      console.warn(`[actions.js] Rejected unlisted action type: ${action.type}`);
      notifyUnavailable(action);
      return;
    }

    const handler = handlers[entry.handler];
    if (!handler) {
      console.warn(`[actions.js] No handler implemented for: ${entry.handler}`);
      notifyUnavailable(action);
      return;
    }

    handler(action);
  }

  /**
   * Dispatch a list of actions attached to one assistant message.
   * @param {Array<object>} actionList
   */
  async function dispatchAll(actionList) {
    if (!Array.isArray(actionList)) return;
    for (const action of actionList) {
      await dispatch(action);
    }
  }

  /**
   * Global delegated listener for buttons rendered by renderer.js inside
   * cards (project Live Demo/GitHub, cert View/Download, the inline-preview
   * Expand button, etc). Those buttons carry data-action-type / data-target
   * attributes with values already resolved server-side into the card
   * payload — this just turns a click into the same dispatch() path the
   * message-level action buttons use, so there's one execution boundary.
   */
  function wireDelegatedClicks() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action-type]');
      if (!btn) return;
      dispatch({
        type: btn.dataset.actionType,
        label: btn.dataset.label || btn.textContent.trim(),
        target: btn.dataset.target,
      });
    });
  }
  wireDelegatedClicks();

  global.APAI = global.APAI || {};
  global.APAI.actions = { dispatch, dispatchAll, loadRegistry };
})(window);
