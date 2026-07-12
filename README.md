# AI Portfolio Assistant

A first-person conversational layer over Balaji Parasuraman's static portfolio.
Built per the project's Software Design Specification — see `/knowledge`,
`/prompts`, and `/config` for the content and behavior contracts.

## Status: Phase 1 (scaffolding) + Phase 2 (knowledge base) complete

- [x] Repo structure matches the approved folder architecture
- [x] Real portfolio files (`index.html`, `style.css`, `script.js`, `resume.pdf`) included; only edit made was pointing the existing "AI Assistant" nav placeholder (`href="#"`) at `assistant.html`
- [x] `assistant.html` — separate page, links `style.css` directly, adds `src/css/assistant.css` for new layout only (no new palette/fonts)
- [x] All JS modules written, syntax-checked, and wired together
- [x] `api/chat.js`: loads prompts + knowledge, calls Groq, **resolves every action's real target/payload server-side from the registries** (the model only ever supplies a lookup `refId`, never a raw URL/path), enforces a token budget on retrieved context, and degrades gracefully with an honest placeholder message when `GROQ_API_KEY` isn't set yet
- [x] Knowledge base populated with **real content**: about, education, skills, all 10 real projects (from the live portfolio), internships (from resume), leadership, all 10 real events, achievements (from resume), contact/links (verified), resume document registry, gallery registry (real event/project image filenames)
- [x] Certifications intentionally left empty — none were supplied, and the guardrails explicitly forbid fabricating them
- [x] End-to-end tested locally: simulated a Groq response referencing a real project, the resume, a valid link, a nonexistent certificate, and a made-up action type — confirmed real ones resolve correctly and the invalid/fabricated ones are silently dropped
- [ ] Phase 4 — add your real `GROQ_API_KEY` in Vercel env vars to activate live responses (structurally done, just needs the key)
- [ ] Still needed: your real `assets/` image folder (this zip has filenames referenced but not the binary images themselves — see note below)
- [ ] Phase 6-7 — responsive QA pass, testing checklist run-through

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in GROQ_API_KEY
npm run dev                  # runs `vercel dev`
```

Until `.env.local` has a real `GROQ_API_KEY`, the assistant will boot and
the UI is fully interactive, but every response will be the honest
"not fully connected yet" placeholder from `api/chat.js` — this is expected
and by design, not a bug.

## Structure

See `/knowledge` for the Markdown + JSON knowledge base (Knowledge Base
Design spec), `/prompts` for the version-controlled prompt files (Prompt
Engineering spec), and `/config` for the registries that keep the frontend
generic (`actions.json`, `routes.json`, `ui.json`, `settings.json`).

## Deployment

Deploy on Vercel. Set `GROQ_API_KEY`, `GROQ_MODEL`, `SYSTEM_PROMPT_VERSION`,
and `MAX_CONTEXT_TOKENS` in Project Settings → Environment Variables. No
other secrets are required — everything else is static content.
