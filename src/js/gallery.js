/**
 * gallery.js
 * Gallery Viewer (SDS: Function Calling §6). Opens a responsive lightbox
 * for a named album, sourced from the gallery registry — never hardcoded
 * image lists.
 */
(function (global) {
  'use strict';

  const { fetchJSON, escapeHtml } = global.APAI.utils;
  let galleryRegistry = null;
  let currentIndex = 0;
  let currentAlbum = null;

  async function loadRegistry() {
    if (!galleryRegistry) {
      galleryRegistry = await fetchJSON('knowledge/gallery/gallery.json').catch(() => ({}));
    }
    return galleryRegistry;
  }

  function renderModal() {
    const image = currentAlbum.images[currentIndex];
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="ai-modal-overlay" id="galleryOverlay">
        <div class="ai-modal-panel">
          <div class="ai-modal-header">
            <strong>${escapeHtml(currentAlbum.title)} (${currentIndex + 1}/${currentAlbum.images.length})</strong>
            <button class="ai-modal-close" id="galleryClose" aria-label="Close">&times;</button>
          </div>
          <div class="ai-modal-body" style="display:flex;align-items:center;justify-content:center;padding:16px;">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.caption || '')}" style="max-width:100%;max-height:100%;border-radius:8px;" />
          </div>
        </div>
      </div>`;

    document.getElementById('galleryClose').onclick = close;
    document.getElementById('galleryOverlay').onclick = (e) => {
      if (e.target.id === 'galleryOverlay') close();
    };
  }

  async function open(albumId) {
    const registry = await loadRegistry();
    const album = registry[albumId];
    if (!album || !album.images?.length) {
      global.APAI.ui?.showToast?.('That gallery is unavailable right now.');
      return;
    }
    currentAlbum = album;
    currentIndex = 0;
    renderModal();
  }

  function close() {
    document.getElementById('modalRoot').innerHTML = '';
    currentAlbum = null;
  }

  global.APAI = global.APAI || {};
  global.APAI.gallery = { open, close };
})(window);
