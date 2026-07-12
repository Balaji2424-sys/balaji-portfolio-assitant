/**
 * renderer.js
 * Rich Card Renderer (SDS: UI/UX §9, Function Calling §5).
 * Every render function takes a plain metadata object (from the knowledge
 * base / API response) and returns an HTML string. No card ever contains
 * text that isn't present in the payload it was given.
 */
(function (global) {
  'use strict';

  const { escapeHtml } = global.APAI.utils;

  function tagList(tags = []) {
    return `<div class="ai-project-card-tags">${tags
      .map((t) => `<span>${escapeHtml(t)}</span>`)
      .join('')}</div>`;
  }

  function projectCard(p) {
    return `
      <article class="ai-project-card">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name || '')}" loading="lazy" />` : ''}
        <div class="ai-project-card-body">
          <div class="ai-project-card-title">${escapeHtml(p.name || 'Untitled project')}</div>
          <p class="ai-project-card-desc">${escapeHtml(p.summary || '')}</p>
          ${tagList(p.techStack)}
          <div class="ai-message-actions">
            ${p.demo ? `<button class="ai-action-btn primary" data-action-type="OPEN_LIVE_DEMO" data-target="${escapeHtml(p.demo)}">Live Demo</button>` : ''}
            ${p.github ? `<button class="ai-action-btn" data-action-type="OPEN_GITHUB_REPO" data-target="${escapeHtml(p.github)}">GitHub</button>` : ''}
            ${p.reportUrl ? `<button class="ai-action-btn" data-action-type="VIEW_PROJECT_REPORT" data-target="${escapeHtml(p.reportUrl)}">Report</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function certificateCard(c) {
    return `
      <article class="ai-project-card">
        <div class="ai-project-card-body">
          <div class="ai-project-card-title">${escapeHtml(c.course || 'Certificate')}</div>
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
          <div class="ai-project-card-title">${escapeHtml(i.role || 'Internship')}</div>
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
          <div class="ai-project-card-title">${escapeHtml(e.institution || '')}</div>
          <p class="ai-project-card-desc">${escapeHtml(e.degree || '')} ${e.cgpa ? `&middot; CGPA ${escapeHtml(e.cgpa)}` : ''}</p>
          ${subjectRows ? `<p class="ai-project-card-desc">${subjectRows}</p>` : ''}
        </div>
      </article>`;
  }

  const renderersByType = {
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
  global.APAI.renderer = { renderIntoPreview, renderInline };
})(window);
