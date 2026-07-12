/**
 * renderer.js
 * Rich Card Renderer (SDS: UI/UX §9, Function Calling §5).
 * Every render function takes a plain metadata object (from the knowledge
 * base / API response) and returns an HTML string. No card ever contains
 * text that isn't present in the payload it was given.
 */
(function (global) {
  'use strict';

  const { escapeHtml, fetchJSON, uid } = global.APAI.utils;

  function tagList(tags = []) {
    return `<div class="ai-project-card-tags">${tags
      .map((t) => `<span>${escapeHtml(t)}</span>`)
      .join('')}</div>`;
  }

  /**
   * Profile card — used for "tell me about yourself" style responses.
   * Renders the real photo + name + tagline + highlight tags from
   * knowledge/about/metadata.json. Nothing here is invented client-side.
   */
  function profileCard(p) {
    const tags = p.highlightTags || p.tags || [];
    return `
      <article class="ai-profile-card">
        ${p.photo ? `<img src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name || '')}" loading="lazy" />` : ''}
        <div class="ai-profile-card-body">
          <div class="ai-profile-card-name">${escapeHtml(p.name || '')}</div>
          <div class="ai-profile-card-meta">${escapeHtml(p.tagline || '')}${p.location ? ` &middot; ${escapeHtml(p.location)}` : ''}</div>
          ${p.openTo ? `<div class="ai-profile-card-meta">Open to: ${escapeHtml(p.openTo)}</div>` : ''}
          <div class="ai-profile-card-tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      </article>`;
  }

  /**
   * Project card — full-bleed image with overlay tag/title, tech stack
   * chips, action buttons, and an expandable "View More" section that
   * lazy-loads the project's overview.md the first time it's opened.
   */
  function projectCard(p) {
    const cardId = uid('proj');
    const category = (p.techStack && p.techStack[0]) || 'Project';
    return `
      <article class="ai-project-card" data-project-id="${escapeHtml(p.id || '')}">
        ${p.image || (p.images && p.images[0]) ? `
        <div class="ai-project-card-media">
          <img src="${escapeHtml(p.image || p.images[0])}" alt="${escapeHtml(p.name || '')}" loading="lazy" />
          <span class="ai-project-card-tag">${escapeHtml(category)}</span>
          <div class="ai-project-card-title-overlay">${escapeHtml(p.name || 'Untitled project')}</div>
        </div>` : ''}
        <div class="ai-project-card-body">
          <p class="ai-project-card-desc">${escapeHtml(p.summary || '')}</p>
          ${tagList(p.techStack)}
          <div class="ai-message-actions">
            ${p.demo ? `<button class="ai-action-btn primary" data-action-type="OPEN_LIVE_DEMO" data-target="${escapeHtml(p.demo)}">Live Demo</button>` : ''}
            ${p.github ? `<button class="ai-action-btn" data-action-type="OPEN_GITHUB_REPO" data-target="${escapeHtml(p.github)}">GitHub</button>` : ''}
          </div>
          <button class="ai-view-more-btn" data-view-more="${cardId}">View more &darr;</button>
          <div class="ai-view-more-content" id="${cardId}"></div>
        </div>
      </article>`;
  }

  /**
   * Wires up every "View more" toggle inside a container. On first open,
   * lazy-fetches the project's overview.md (a public static file, same
   * origin — no different from the config/gallery fetches elsewhere) and
   * renders it through the same safe markdown subset used for chat text.
   */
  function wireViewMoreToggles(container) {
    container.querySelectorAll('[data-view-more]').forEach((btn) => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.viewMore;
        const content = document.getElementById(targetId);
        if (!content) return;

        const isOpen = content.classList.toggle('open');
        btn.textContent = isOpen ? 'View less ↑' : 'View more ↓';

        if (isOpen && !content.dataset.loaded) {
          const card = btn.closest('[data-project-id]');
          const projectId = card?.dataset.projectId;
          if (!projectId) return;
          content.textContent = 'Loading…';
          try {
            const res = await fetch(`knowledge/projects/${projectId}/overview.md`);
            const text = await res.text();
            content.innerHTML = global.APAI.markdown.toHtml(text);
            content.dataset.loaded = '1';
          } catch {
            content.textContent = "Couldn't load more details right now.";
          }
        }
      });
    });
  }

  function certificateCard(c) {
    return `
      <article class="ai-project-card">
        <div class="ai-project-card-body">
          <div class="ai-project-card-title-overlay" style="position:static;color:var(--clr-text);margin-bottom:4px;">${escapeHtml(c.course || 'Certificate')}</div>
          <p class="ai-project-card-desc">${escapeHtml(c.issuer || '')}${c.score ? ` &middot; Score: ${escapeHtml(c.score)}` : ''}</p>
          <div class="ai-message-actions">
            ${c.certificate ? `<button class="ai-action-btn primary" data-action-type="VIEW_CERTIFICATE" data-target="${escapeHtml(c.certificate)}">View</button>` : ''}
            ${c.certificate ? `<button class="ai-action-btn" data-action-type="DOWNLOAD_CERTIFICATE" data-target="${escapeHtml(c.certificate)}">Download</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function internshipCard(i) {
    return `
      <article class="ai-project-card">
        <div class="ai-project-card-body">
          <div class="ai-project-card-title-overlay" style="position:static;color:var(--clr-text);margin-bottom:4px;">${escapeHtml(i.role || 'Internship')}</div>
          <p class="ai-project-card-desc">${escapeHtml(i.organization || '')}${i.duration ? ` &middot; ${escapeHtml(i.duration)}` : ''}</p>
          <div class="ai-message-actions">
            ${i.offerLetter ? `<button class="ai-action-btn" data-action-type="VIEW_INTERNSHIP_LETTER" data-target="${escapeHtml(i.offerLetter)}">Offer Letter</button>` : ''}
            ${i.certificate ? `<button class="ai-action-btn" data-action-type="VIEW_CERTIFICATE" data-target="${escapeHtml(i.certificate)}">Certificate</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function educationCard(e) {
    const subjectRows = (e.subjects || [])
      .map((s) => `<span>${escapeHtml(s.name)}: ${escapeHtml(String(s.marks))}</span>`)
      .join(' &middot; ');
    return `
      <article class="ai-project-card">
        <div class="ai-project-card-body">
          <div class="ai-project-card-title-overlay" style="position:static;color:var(--clr-text);margin-bottom:4px;">${escapeHtml(e.institution || '')}</div>
          <p class="ai-project-card-desc">${escapeHtml(e.degree || '')} ${e.cgpa ? `&middot; CGPA ${escapeHtml(e.cgpa)}` : ''}</p>
          ${subjectRows ? `<p class="ai-project-card-desc">${subjectRows}</p>` : ''}
        </div>
      </article>`;
  }

  /**
   * Inline document preview (right panel) — used alongside the full
   * PDF.js modal so a "View Resume" action shows something immediately
   * without an extra click, per the "preview panel should actually
   * reflect what I asked for" feedback.
   */
  function documentPreview(url, label) {
    return `
      <div class="ai-doc-preview">
        <iframe src="${escapeHtml(url)}" title="${escapeHtml(label || 'Document')}" loading="lazy"></iframe>
        <div class="ai-doc-preview-footer">
          <span>${escapeHtml(label || 'Document')}</span>
          <button class="ai-action-btn" data-action-type="__EXPAND_DOC__" data-target="${escapeHtml(url)}" data-label="${escapeHtml(label || 'Document')}">Expand &#8599;</button>
        </div>
      </div>`;
  }

  const renderersByType = {
    profile: profileCard,
    project: projectCard,
    certificate: certificateCard,
    internship: internshipCard,
    education: educationCard,
  };

  /**
   * Renders a card into the right-hand preview panel.
   * Falls back to a friendly "not available" note for unknown types
   * rather than throwing, per the SDS error-handling rule.
   */
  function renderIntoPreview(cardType, payload) {
    const slot = document.getElementById('previewSlot');
    if (!slot) return;
    const render = renderersByType[cardType];
    if (!render || !payload) {
      slot.innerHTML = `<p class="ai-empty-preview">Nothing to preview yet.</p>`;
      return;
    }
    slot.innerHTML = render(payload);
    wireViewMoreToggles(slot);
    global.APAI.ui?.openPreviewPanel?.();
  }

  /**
   * Shows an inline document preview (iframe) in the right panel,
   * alongside the modal viewer opened by pdfViewer.js.
   */
  function renderDocumentPreview(url, label) {
    const slot = document.getElementById('previewSlot');
    if (!slot) return;
    slot.innerHTML = documentPreview(url, label);
    global.APAI.ui?.openPreviewPanel?.();
  }

  /**
   * Renders a card inline in the chat transcript (used when a message
   * says e.g. "here's that project" and should show the card right there).
   */
  function renderInline(cardType, payload) {
    const render = renderersByType[cardType];
    if (!render || !payload) return '';
    return render(payload);
  }

  global.APAI = global.APAI || {};
  global.APAI.renderer = { renderIntoPreview, renderDocumentPreview, renderInline, wireViewMoreToggles };
})(window);
