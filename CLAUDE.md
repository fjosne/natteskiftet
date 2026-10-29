# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hackathon starter repo ("Natteskiftet"): an on-call agent that takes first shift when a 03:00 alarm fires, digs through logs and history, and reports honestly what it knows and doesn't know. All data in `data/` is fictional, set in the night of 29 Oct 2026. The code, prompts and docs are in Norwegian; keep new code, identifiers and tool descriptions in Norwegian to match.

## Commands

```bash
npm install
cp .env.example .env                 # then set ANTHROPIC_API_KEY (.env is gitignored, never commit it; ../.env is used as fallback, see src/miljo.js)
npm start                            # runs the default example alarm (betaling 03:12)
npm start -- "ALARM kl 03:40: api-gateway gir 17 % 504"   # custom alarm (free text)
npm start -- ALARM-0340              # alarm by ID from data/alarmer.json
```

There is no build step, linter, type-checker or test suite configured. Requires Node >= 20.12 (uses `process.loadEnvFile` and `import.meta.dirname`). ESM only (`"type": "module"`).

Optional env vars: `MODELL` (default `claude-sonnet-5-5`), `MAX_ITERASJONER` (default 15, caps agent loop rounds; when the cap is hit the agent makes one final forced `lever_rapport` call, marks the report `ufullstendig`, and calls `varsle_vakt` itself if nobody has been notified), `EFFORT` (default `medium`; one of `low`, `medium`, `high`, `xhigh`, `max`; invalid values fail at startup before any API call). The env vars are read inside `kjørAgent`, so values from `.env` take effect.

## Architecture

One dependency (`@anthropic-ai/sdk`):

- `index.js` loads `.env`, turns argv into `{ oppgave, nå, alarm }` via `alarm.js` (falls back to `eksempelOppgave`), and calls `kjørAgent`.
- `alarm.js` resolves an alarm ID from `data/alarmer.json`, or parses free text: the clock time in the text becomes «nå»; without one, the last log line is used and the task text says so. Free-text alarms have `alvorlighet: null`.
- `agent.js` is the whole agent loop: call `messages.create`, print text blocks, and if `stop_reason` is `tool_use` run every requested tool and send all `tool_result` blocks back in a single user message. It stops on `end_turn`, `refusal`, `max_tokens`, after a valid `lever_rapport`, or after `MAX_ITERASJONER` (then forces a final report). Tool errors are returned to the model with `is_error: true` rather than thrown, so the model can retry. `kjørAgent` returns `{ rapport, varslet, kontekst, svar }`.
- `verktoy.js` holds the system prompt, the example alarm and the `verktøy` array, imported from one file per tool in `src/verktoy/`. Each tool is `{ definisjon, kjør }`: `definisjon` is the Anthropic tool schema the model sees, `kjør(input, kontekst)` is the implementation. Shared helpers (`DATA`, `lesJson`, `tilMs`) live in `src/verktoy/felles.js`.
- `kontekst` is created per run in `agent.js` (fields documented there): `nå` (alarm time; all tools cut data after it), `alarm`, `hentedeRunbooks` (required by `utfor_tiltak`), `varslet`, `rapport`.

### Tools

Live: `sok_i_logger`, `hent_runbook`, `sjekk_deploy_historikk`, `finn_lignende_hendelser`, `hent_tjenesteinfo`, `utfor_tiltak` (enum of three allowed actions, SIMULATED, requires the service's runbook to be fetched first), `varsle_vakt` (`{ til, kopi, melding }`, SIMULATED) and `lever_rapport` (fixed schema, validated in code, ends the loop). `agent.js` only sends tools whose `kjør` is a function (`verktøy.filter(v => v.kjør)`); a tool with `kjør: null` is a stub invisible to the model. A tool returns a string or JSON-serialisable object (objects are `JSON.stringify`'d).

All tools except `lever_rapport` get a required `hvorfor` field (one-sentence reason for the call). It is added generically in `agent.js` (`medHvorfor`, on a copy of the schema, so tool files are untouched), printed as `↳ hvorfor: …` under `→ tool`, and stripped from the input before `kjør` runs, so tools never see it. If the model omits it the call still runs and prints `(ikke oppgitt)`. The automatic `varsle_vakt` call prints a fixed reason.

Conventions that matter:
- Tool names must be ASCII (`sok_i_logger`, not `søk_i_logger`).
- The tool `description` is effectively a prompt to the model: say when to use it and what to watch out for.
- Throw an `Error` with a helpful message (e.g. listing valid values) on bad input; the message goes back to the model.
- Time inputs go through `tilMs`: accepts full ISO or bare `"03:10"`, interpreted as 29 Oct 2026 at +01:00.

## Data (`data/`)

Plain JSON and markdown, read synchronously via `lesJson` in `verktoy.js`: `alarmer.json` (five alarms), `logger.json` (~250 lines, 02:30–03:50, fields `tid`, `tjeneste`, `nivå`, `melding`), `deploy-historikk.json`, `hendelser.json` (past incidents with post-mortems), `tjenester.json` (owners, on-call, dependencies), and `runbooks/<tjeneste>.md`. Services: api-gateway, innlogging, betaling, sok, varsling, kunde-db. Not all runbooks are current, and the root cause often sits in a different service than the one alarming; the system prompt and tool descriptions are written to steer the agent toward verifying rather than guessing.
