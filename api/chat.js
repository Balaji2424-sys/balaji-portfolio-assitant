/**
 * api/chat.js
 * Vercel Serverless Function — the only place that talks to Groq.
 * Flow (SDS Technical Architecture §5):
 *   validate request -> classify intent -> load knowledge ->
 *   assemble prompt -> call Groq -> validate structured actions -> respond.
 *
 * Never exposes GROQ_API_KEY to the client. Runs on Node's built-in fetch
 * (Node 18+ Vercel runtime), no extra HTTP dependency needed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
const PROMPTS_DIR = path.join(ROOT, 'prompts');
const ACTIONS_REGISTRY_PATH = path.join(ROOT, 'config', 'actions.json');
const ROUTES_PATH = path.join(ROOT, 'config', 'routes.json');
const SETTINGS_PATH = path.join(ROOT, 'config', 'settings.json');

// ── Small file helpers (sync is fine — these are small, cached per cold start) ──
function readJSONSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

let cachedPromptBundle = null;
function loadPromptBundle() {
  if (cachedPromptBundle) return cachedPromptBundle;
  cachedPromptBundle = {
    system: readTextSafe(path.join(PROMPTS_DIR, 'system-prompt.md')),
    personality: readTextSafe(path.join(PROMPTS_DIR, 'personality.md')),
    recruiter: readTextSafe(path.join(PROMPTS_DIR, 'recruiter.md')),
    visitor: readTextSafe(path.join(PROMPTS_DIR, 'visitor.md')),
    guardrails: readTextSafe(path.join(PROMPTS_DIR, 'guardrails.md')),
  };
  return cachedPromptBundle;
}

/**
 * Very small keyword classifier: matches the user's message against
 * config/routes.json intent keywords to decide which knowledge/<domain>
 * folders to load. This is the MVP retrieval strategy the SDS specifies
 * for Phase 1 (Markdown + JSON retrieval) — embeddings are a v2 concern.
 */
// Extra synonyms beyond the literal route-intent keyword, so singular/plural
// and common phrasing variants ("cv", "internship", "hire me") still match.
const KEYWORD_ALIASES = {
  about: ['yourself', 'who are you', 'introduce'],
  education: ['college', 'cgpa', 'degree', 'school', 'university'],
  skills: ['skill', 'tech stack', 'language', 'framework', 'know react', 'know python'],
  projects: ['project', 'built', 'app', 'demo'],
  internships: ['internship', 'intern'],
  experience: ['experience', 'work'],
  leadership: ['leadership', 'secretary', 'organizer', 'organized', 'lead'],
  ieee: ['ieee'],
  events: ['event', 'symposium', 'hackathon', 'workshop'],
  certifications: ['certificate', 'certification', 'nptel', 'course'],
  achievements: ['achievement', 'award', 'won', 'winner'],
  contact: ['email', 'linkedin', 'whatsapp', 'reach', 'hire me', 'phone'],
  resume: ['resume', 'cv'],
  gallery: ['gallery', 'photo', 'picture'],
};

function classifyDomains(message) {
  const routes = readJSONSafe(ROUTES_PATH, {});
  const lower = message.toLowerCase();
  const matched = new Set();

  for (const [intent, domains] of Object.entries(routes)) {
    if (intent.startsWith('_')) continue;
    const stem = intent.replace(/s$/, ''); // "projects" -> "project"
    const aliases = KEYWORD_ALIASES[intent] || [];
    const isMatch = lower.includes(intent) || lower.includes(stem) || aliases.some((k) => lower.includes(k));
    if (isMatch) {
      domains.forEach((d) => matched.add(d));
    }
  }

  // Direct project-name mentions always pull in the full projects domain
  // (cheap and robust — the per-project folders are small).
  const projectIndex = readJSONSafe(path.join(KNOWLEDGE_DIR, 'projects', 'index.json'), []);
  const mentionsAProject = projectIndex.some(
    (p) => lower.includes(p.id.replace(/-/g, ' ')) || lower.includes(p.name.toLowerCase())
  );
  if (mentionsAProject) matched.add('projects');

  // Fallback: if nothing matched, load "about" so the assistant can at
  // least introduce itself sensibly rather than retrieving nothing.
  if (matched.size === 0) matched.add('about');
  return [...matched];
}

/**
 * Recursively collects .md/.json files under a directory, one level deep
 * of subfolders (covers knowledge/projects/<slug>/*). Depth is capped so a
 * stray deeply-nested folder can't blow up context size.
 */
function collectFiles(dirPath, relativePrefix, depth = 0) {
  const chunks = [];
  if (!fs.existsSync(dirPath) || depth > 1) return chunks;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = `${relativePrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      chunks.push(...collectFiles(fullPath, relPath, depth + 1));
    } else if (/\.(md|json)$/.test(entry.name)) {
      const content = readTextSafe(fullPath);
      if (content.trim()) {
        chunks.push(`--- ${relPath} ---\n${content}`);
      }
    }
  }
  return chunks;
}

/**
 * Loads all Markdown + JSON files from the given knowledge domains,
 * including one level of subfolders (e.g. knowledge/projects/hostelos/).
 * Silently skips domains with no content yet (placeholder-friendly for
 * Phase 2, where content gets filled in incrementally).
 */
function loadKnowledgeForDomains(domains) {
  const chunks = [];
  for (const domain of domains) {
    const domainPath = path.join(KNOWLEDGE_DIR, domain);
    chunks.push(...collectFiles(domainPath, `knowledge/${domain}`));
  }
  return chunks.join('\n\n');
}

function buildSystemPrompt(mode) {
  const p = loadPromptBundle();
  const modePrompt = mode === 'recruiter' ? p.recruiter : p.visitor;
  return [p.system, p.personality, modePrompt, p.guardrails].filter(Boolean).join('\n\n---\n\n');
}

const DOCUMENTS_PATH = path.join(KNOWLEDGE_DIR, 'metadata', 'documents.json');
const LINKS_PATH = path.join(KNOWLEDGE_DIR, 'links', 'links.json');
const CONTACT_PATH = path.join(KNOWLEDGE_DIR, 'contact', 'metadata.json');

function loadProjectMetadata(slug) {
  const p = path.join(KNOWLEDGE_DIR, 'projects', slug, 'metadata.json');
  return readJSONSafe(p, null);
}

function loadAboutMetadata() {
  return readJSONSafe(path.join(KNOWLEDGE_DIR, 'about', 'metadata.json'), null);
}

/**
 * Resolves a sanitized action's real target from the knowledge registries,
 * using the refId the model supplied. The model never sees or invents a
 * real URL/path — this is the single place targets get resolved, which is
 * the server-side half of the defense described in Function Calling §11
 * (actions.js on the client re-validates the action *type* whitelist too).
 * Returns null if the refId doesn't resolve to anything real — the caller
 * drops the action rather than shipping a broken one.
 */
function resolveTarget(entry, refId) {
  if (!refId) return null;

  switch (entry.targetSource) {
    case 'links': {
      const links = readJSONSafe(LINKS_PATH, {});
      return links[refId] || null;
    }
    case 'documents': {
      const docs = readJSONSafe(DOCUMENTS_PATH, {});
      return docs[refId]?.path || null;
    }
    case 'project.demo': {
      const project = loadProjectMetadata(refId);
      return project?.demo || null;
    }
    case 'project.github': {
      const project = loadProjectMetadata(refId);
      return project?.github || null;
    }
    case 'contact.email': {
      const contact = readJSONSafe(CONTACT_PATH, {});
      return contact.email || null;
    }
    case 'contact.phone': {
      const contact = readJSONSafe(CONTACT_PATH, {});
      return contact.phone || null;
    }
    case 'gallery':
      // gallery.js resolves albums client-side by id; the id itself IS the target.
      return refId;
    default:
      return null;
  }
}

/**
 * Validates the model's returned actions against the action registry,
 * resolves each one's real target/payload from the knowledge base, and
 * drops anything that doesn't check out. Anything not whitelisted or not
 * resolvable is dropped rather than trusted (Function Calling §11).
 */
function sanitizeActions(actions) {
  const registry = readJSONSafe(ACTIONS_REGISTRY_PATH, {});
  if (!Array.isArray(actions)) return [];

  const resolved = [];
  for (const a of actions) {
    if (!a || typeof a.type !== 'string') continue;
    const entry = registry[a.type];
    if (!entry) continue; // unlisted action type — drop

    const out = { type: a.type, label: a.label || a.type };

    if (entry.handler === 'renderCard') {
      let payload = null;
      if (entry.cardType === 'profile') {
        payload = loadAboutMetadata();
      } else {
        payload = a.refId ? loadProjectMetadata(a.refId) : null;
      }
      if (!payload) continue; // no valid ref — drop rather than render an empty card
      out.cardType = entry.cardType;
      out.payload = payload;
    } else if (entry.handler === 'openGallery') {
      out.albumId = a.refId || null;
      if (!out.albumId) continue;
    } else {
      const target = resolveTarget(entry, a.refId);
      if (!target) continue; // couldn't resolve — drop instead of shipping a dead action
      out.target = target;
    }

    resolved.push(out);
  }
  return resolved;
}

/**
 * Rough char-per-token budget guard (≈4 chars/token, conservative). Not a
 * real tokenizer — good enough to stop unbounded growth as the knowledge
 * base scales, per MAX_CONTEXT_TOKENS in settings/env.
 */
function truncateToTokenBudget(text, maxTokens) {
  const charBudget = maxTokens * 4;
  if (text.length <= charBudget) return text;
  return `${text.slice(0, charBudget)}\n\n[...knowledge context truncated to fit token budget...]`;
}

async function callGroq({ systemPrompt, knowledgeContext, history, message }) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const maxTokens = parseInt(process.env.MAX_CONTEXT_TOKENS, 10) || 8000;
  knowledgeContext = truncateToTokenBudget(knowledgeContext, maxTokens * 0.7); // leave room for system/personality/history

  if (!apiKey) {
    // No key configured yet — Phase 4 hasn't happened. Fail predictably
    // instead of crashing, so the rest of the app stays testable.
    const err = new Error('GROQ_API_KEY is not configured.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const messages = [
    { role: 'system', content: `${systemPrompt}\n\nKnowledge context:\n${knowledgeContext}` },
    ...(Array.isArray(history) ? history.slice(-12) : []),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Model didn't return valid JSON — degrade to plain text, no actions,
    // rather than surfacing a broken response to the user.
    parsed = { message: raw, actions: [] };
  }

  return {
    message: typeof parsed.message === 'string' ? parsed.message : String(parsed.message || ''),
    actions: sanitizeActions(parsed.actions),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed', actions: [] });
    return;
  }

  const settings = readJSONSafe(SETTINGS_PATH, { maxHistoryMessages: 12 });
  const { message, history = [], mode = 'visitor' } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ message: 'A message is required.', actions: [] });
    return;
  }

  try {
    const domains = classifyDomains(message);
    const knowledgeContext = loadKnowledgeForDomains(domains);
    const systemPrompt = buildSystemPrompt(mode);

    const result = await callGroq({
      systemPrompt,
      knowledgeContext,
      history: history.slice(-(settings.maxHistoryMessages || 12)),
      message,
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      // Friendly, honest placeholder — this is expected until Phase 4
      // (Groq integration) is wired up with a real key in Vercel env vars.
      res.status(200).json({
        message:
          "Hi! I'm Balaji Parasuraman. My assistant isn't fully connected yet — the team is still wiring up my knowledge base and AI backend. Please check back soon, or reach me directly via the contact links on my portfolio.",
        actions: [],
      });
      return;
    }

    console.error('[api/chat] error:', err);
    res.status(200).json({
      message: "Sorry, I'm having trouble answering that right now. Could you try rephrasing, or ask again in a moment?",
      actions: [],
    });
  }
};
