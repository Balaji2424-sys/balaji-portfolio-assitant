/**
 * pdfViewer.js
 * Embedded PDF Viewer (SDS: Function Calling §7, UI/UX §9).
 * Uses PDF.js for in-app zoom/page navigation. The library is lazy-loaded
 * from CDN only when a "View" action actually fires — not on initial page
 * load — to protect the "minimal JS bundle" performance goal (§10) while
 * still supporting the fuller viewer experience requested for this build.
 */
(function (global) {
  'use strict';

  const { escapeHtml } = global.APAI.utils;
  const PDFJS_VERSION = '3.11.174';
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

  let pdfjsLoaded = false;
  let currentPdf = null;
  let currentPage = 1;
  let currentScale = 1.2;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensurePdfJs() {
    if (pdfjsLoaded) return;
    await loadScript(`${PDFJS_CDN}/pdf.min.js`);
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
    pdfjsLoaded = true;
  }

  function shellMarkup(label) {
    return `
      <div class="ai-modal-overlay" id="pdfOverlay">
        <div class="ai-modal-panel">
          <div class="ai-modal-header">
            <strong>${escapeHtml(label || 'Document')}</strong>
            <div>
              <button class="ai-action-btn" id="pdfZoomOut">&minus;</button>
              <button class="ai-action-btn" id="pdfZoomIn">+</button>
              <button class="ai-modal-close" id="pdfClose" aria-label="Close">&times;</button>
            </div>
          </div>
          <div class="ai-modal-body" id="pdfBody">
            <p class="ai-empty-preview" style="padding:24px;">Loading document…</p>
          </div>
        </div>
      </div>`;
  }

  async function renderPage(num) {
    const page = await currentPdf.getPage(num);
    const viewport = page.getViewport({ scale: currentScale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const body = document.getElementById('pdfBody');
    if (body) {
      body.innerHTML = '';
      body.appendChild(canvas);
    }
  }

  async function open(url, label) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = shellMarkup(label);
    document.getElementById('pdfClose').onclick = close;
    document.getElementById('pdfOverlay').onclick = (e) => {
      if (e.target.id === 'pdfOverlay') close();
    };

    try {
      await ensurePdfJs();
      currentPdf = await global.pdfjsLib.getDocument(url).promise;
      currentPage = 1;
      currentScale = 1.2;
      await renderPage(currentPage);

      document.getElementById('pdfZoomIn').onclick = () => {
        currentScale = Math.min(currentScale + 0.2, 3);
        renderPage(currentPage);
      };
      document.getElementById('pdfZoomOut').onclick = () => {
        currentScale = Math.max(currentScale - 0.2, 0.6);
        renderPage(currentPage);
      };
    } catch (err) {
      console.error('[pdfViewer] failed to load document', err);
      const body = document.getElementById('pdfBody');
      if (body) {
        body.innerHTML = `<p class="ai-empty-preview" style="padding:24px;">
          This document is currently unavailable. You can try again in a moment.
        </p>`;
      }
    }
  }

  function close() {
    document.getElementById('modalRoot').innerHTML = '';
    currentPdf = null;
  }

  global.APAI = global.APAI || {};
  global.APAI.pdfViewer = { open, close };
})(window);
