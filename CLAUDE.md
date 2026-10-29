# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hackathon starter repo ("Natteskiftet"): an on-call agent that takes first shift when a 03:00 alarm fires, digs through logs and history, and reports honestly what it knows and doesn't know. All data in `data/` is fictional, set in the night of 29 Oct 2026. The code, prompts and docs are in Norwegian; keep new code, identifiers and tool descriptions in Norwegian to match.

## Commands

```bash
npm install
cp .env.example .env                 # then set ANTHROPIC_API_KEY (.env is gitignored, never commit it)
npm start                            # runs the default example alarm (betaling 03:12)
npm start -- "ALARM kl 03:40: api-gateway gir 17 % 504"   # custom alarm
```

There is no build step, linter, type-checker or test suite configured. Requires Node >= 20.12 (uses `process.loadEnvFile` and `import.meta.dirname`). ESM only (`"type": "module"`).

Optional env vars: `MODELL` (default `claude-sonnet-5-5`), `MAX_ITERASJONER` (default 10, caps agent loop rounds).

## Architecture

Three files in `src/`, one dependency (`@anthropic-ai/sdk`):

- `index.js` loads `.env`, takes the alarm text from argv (falls back to `eksempelOppgave`), and calls `kjørAgent`.
- `agent.js` is the whole agent loop: call `messages.create`, print text blocks, and if `stop_reason` is `tool_use` run every requested tool and send all `tool_result` blocks back in a single user message. It stops on `end_turn`, `refusal`, `max_tokens`, or after `MAX_ITERASJONER`. Tool errors are returned to the model with `is_error: true` rather than thrown, so the model can retry.
- `verktoy.js` holds the system prompt, the example alarm and the `verktøy` array. Each tool is `{ definisjon, kjør }`: `definisjon` is the Anthropic tool schema the model sees, `kjør` is the implementation.

### Tool stubs

`agent.js` only sends tools whose `kjør` is a function (`verktøy.filter(v => v.kjør)`). Tools with `kjør: null` are stubs and are invisible to the model until implemented. Currently only `sok_i_logger` is live; `hent_runbook`, `sjekk_deploy_historikk` and `finn_lignende_hendelser` are stubs with TODO comments describing the intended implementation. To enable one, replace `kjør: null` with a function that takes the model's input and returns a string or JSON-serialisable object (objects are `JSON.stringify`'d).

Conventions that matter:
- Tool names must be ASCII (`sok_i_logger`, not `søk_i_logger`).
- The tool `description` is effectively a prompt to the model: say when to use it and what to watch out for.
- Throw an `Error` with a helpful message (e.g. listing valid values) on bad input; the message goes back to the model.
- Time inputs go through `tilMs`: accepts full ISO or bare `"03:10"`, interpreted as 29 Oct 2026 at +01:00.

## Data (`data/`)

Plain JSON and markdown, read synchronously via `lesJson` in `verktoy.js`: `alarmer.json` (five alarms), `logger.json` (~250 lines, 02:30–03:50, fields `tid`, `tjeneste`, `nivå`, `melding`), `deploy-historikk.json`, `hendelser.json` (past incidents with post-mortems), `tjenester.json` (owners, on-call, dependencies), and `runbooks/<tjeneste>.md`. Services: api-gateway, innlogging, betaling, sok, varsling, kunde-db. Not all runbooks are current, and the root cause often sits in a different service than the one alarming; the system prompt and tool descriptions are written to steer the agent toward verifying rather than guessing.
