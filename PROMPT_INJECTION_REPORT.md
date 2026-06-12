# Prompt-Injection & Blast-Radius Assessment

**Target:** `json-generator-for-n8n` (React/Vite SPA that asks an LLM for n8n workflow JSON)
**Question:** If a malicious description (or a malicious upstream model) injects hostile instructions, what can actually happen?
**Method:** Two layers — (1) a deterministic containment test against the app's real pipeline, and (2) attempted live model-steering samples.

---

## TL;DR

**The app is structurally safe against prompt injection.** The reason is architectural, not luck: the app treats every model response as **pure data**, never as code. There is no `eval`, no `Function()`, no dynamic import, no template execution of model output anywhere in the generation path. So even a *fully steered* model — one that does exactly what an attacker wants — can at worst emit a JSON workflow object, and that object is then filtered before it can reach the user's n8n instance.

The realistic damage ceiling is: **an attacker can influence the *content* of a workflow the user is about to review and import into their own n8n.** They cannot execute code in the app, exfiltrate anything from the app, or pollute app state. Any node only ever runs later, inside the **user's own n8n**, under the user's own credentials, and only if the user activates it.

---

## Layer 1 — Deterministic containment test (the core result)

File: `src/lib/blastRadius.test.js` — **13/13 passing.** Runs simulated "the model was successfully steered" outputs through the *exact* same post-processing the app applies to every response:

```
rawModelText
  → cleanOutput()       strip ``` fences, slice to outermost {...}
  → repairJSON()        JSON.parse + bracket-balance repair (throws on unrepairable)
  → unwrapWorkflow()    unwrap {workflow:…}/{data:…}/… (stops at depth 2)
  → validateStructure() non-blocking warnings
  → import payload      whitelist: ONLY name, nodes, connections, settings
```

| Hostile output (assume model fully complied) | Result |
|---|---|
| Refuses JSON, writes prose/poem | **Blocked at parse** — `isJsonInvalid`, never an importable workflow |
| Bare `PWNED` marker | **Blocked at parse** |
| Leaks its system prompt as prose | **Blocked at parse** |
| `name: "IGNORE PREVIOUS… INJECTION_OK"` | Survives only as an inert **string** (a workflow name); cannot change app behavior |
| Adds `active:true`, `id`, `tags`, `pinData`, `extraEvil` | **All stripped** on import — only `name/nodes/connections/settings` survive |
| `httpRequest` node POSTing to attacker URL | Survives as **inert node data**; app never calls it — runs only inside user's n8n after the user activates |
| Code node with `process.env` | Survives only as a **string**; app never `eval`s it — runs only in n8n's own Code-node sandbox |
| `{workflow:{active:true,…}}` wrapper smuggling | Unwrapped correctly; `active` still stripped |
| Literal `__proto__` key | **No prototype pollution** (`Object.prototype` untouched) |
| Deeply nested single-key smuggling | **Not auto-unwrapped past depth 2** → safe empty import |
| Truncated JSON | Repaired, flagged `repaired:true` for user review |
| Markdown-fenced / chatty preamble JSON | Fences/preamble stripped, parses cleanly |

The existing `src/lib/pipeline.test.js` (81 tests) also still passes — no regressions.

**Why this is the authoritative answer:** the result does *not* depend on whether any particular model resists the injection. Even the worst case (model fully obeys the attacker) is contained by the pipeline. The containment ceiling is fixed by code, not by model behavior.

---

## Layer 2 — Live model-steering samples (could not complete)

Tried to capture real samples (role-hijack, format-escape, system-prompt-leak, markdown-fence payloads). **Blocked by infrastructure, not by the app:** the OpenRouter account is on the **free tier ($0 credits)**, and the free model pool (Llama-3.3-70b / Gemini-2.0-flash / DeepSeek-v3, all `:free`) is **congested upstream** — every request returned `429 … temporarily rate-limited upstream` (provider: Venice), and OpenRouter does not auto-fall-through on that error class.

This is itself a minor finding: **reliable live testing (and reliable production use) needs a paid or BYOK OpenRouter key.** It does not affect the security conclusion, because Layer 1 already bounds the worst case.

---

## Recommendations (optional, defense-in-depth)

The app is safe as-is. If you want to harden the *UX* around injected content:

1. **Visibly flag exfil-shaped nodes before import.** When a generated workflow contains `httpRequest` to an external host, or a Code node referencing `process.env`/secrets, show a one-line "review this — it sends data externally" notice in the preview. (Purely informational; the data is already inert.)
2. **Surface `repaired:true` more prominently** so users double-check truncated/repaired outputs.
3. **Use a paid/BYOK OpenRouter key** for reliability (also unblocks live red-team sampling).
4. Keep the import whitelist exactly as-is — it is the key control. Add a comment/test linking it to this report so it isn't loosened later (this report's test already guards it).

---

*Generated as part of the security review of `json-generator-for-n8n`. The deterministic test (`src/lib/blastRadius.test.js`) is committed alongside this report so the team can re-run it any time with `npm test`.*
