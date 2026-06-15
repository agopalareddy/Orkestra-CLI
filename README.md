# 🎹 Orkestra

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-red.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-v5-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-v19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v8-646cff.svg)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57.svg)](https://sqlite.org/)

**Orkestra** is a premium, **local-first AI Agent Studio** that orchestrates the AI CLIs you already have installed — `claude-code`, `codex`, and `gemini-cli` / `agy` (Antigravity) — into a single panel and a unified multi-agent development pipeline.

Instead of paying for direct API integrations, Orkestra acts as a smart wrapper around the CLI tools already **installed and logged in** on your machine. It drives those sessions, captures their output, tracks their live usage limits, and chains them together into a `Planner → Builder → Reviewer → Fixer` workflow — all running on `127.0.0.1`.

> The interface ships in Turkish. This README documents the system in English.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [How It Works](#%EF%B8%8F-how-it-works)
- [Chat Studio](#-chat-studio)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Agent Command Templates](#-agent-command-templates)
- [API Reference](#-api-reference)
- [PowerShell Automation](#-powershell-automation)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🌟 Key Features

- **⚡ Local-First Orchestration** — Wraps local CLI tools using their active logged-in sessions. No direct API keys required; Orkestra runs `claude -p`, `codex exec`, and `agy -p` on your behalf.
- **🛠️ Four-Stage Agent Pipeline** — Runs a task through a structured role chain: **Planner → Builder → Reviewer → Fixer**, each step streamed live to the UI over Server-Sent Events.
- **💬 Multi-AI Chat** — Talk to Claude, Codex, or Gemini individually, or to **all of them at once**. The full conversation history (including the other AIs' replies) is shared with every model, so each agent sees the whole discussion.
- **📊 Live Usage & Limit Dashboard** — Fetches **live** 5-hour and weekly usage windows straight from each provider's usage API (Anthropic OAuth usage, ChatGPT/Codex `wham/usage`) using the tokens stored by each CLI. A model whose quota is exhausted is auto-disabled and skipped.
- **🧠 Dynamic Model & Effort Control** — Model lists are pulled live per provider (e.g. Anthropic `/v1/models`). For Claude and Codex you can switch the **reasoning effort** (Low / Medium / High) per message.
- **🎙️ Voice Input** — Dictate messages with a sleek, Codex-style recording bar (live transcript, timer, waveform, cancel / send), powered by the browser Web Speech API.
- **🖼️ Image Attachments** — Attach screenshots by **drag-to-pick or `Ctrl+V` paste**. Images are stored locally and read back by the agentic CLIs through their own vision/read tools.
- **🗂️ Conversation History** — Every chat is saved locally. Start a **New Chat** or jump back into a previous conversation from a quick popover in the chat header or the sidebar.
- **🔄 Failover & Fallback** — Scans `stdout`/`stderr` for rate limits (429), quota errors, and timeouts. When an agent is blocked it reroutes to predefined fallback agents.
- **🔒 Secure Git Publisher** — Reviews modified files, automatically filters out secrets (`.env`, private keys, credentials), creates a branch, commits, pushes, and opens a draft PR — all gated behind explicit user approval.

---

## 🗺️ How It Works

```
 ┌─────────────────────────────────────────────────────────┐
 │                    Orkestra Dashboard                    │
 │        Chat  ·  Pipeline  ·  Agent Center  ·  Git        │
 └────────────────────────────┬────────────────────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  Claude CLI  │ │  Codex CLI   │ │  Gemini /agy │
     └──────────────┘ └──────────────┘ └──────────────┘
```

1. **Chat (Decide)** — Brainstorm architecture and strategy with one or more planners.
2. **Brief** — Orkestra compiles a concise task summary (features, constraints, success criteria).
3. **Run (Code)** — The agent pipeline executes inside an isolated workspace directory (`workspaces/run-xxxx`), streaming events live.
4. **Publish** — Safely commit, push, and open a draft pull request.

---

## 💬 Chat Studio

The Chat panel is the heart of Orkestra:

| Capability | Description |
| --- | --- |
| **Target (Hedef)** | Choose a single planner (`Claude` / `Codex` / `Gemini`) or `All` to fan the message out to every authenticated CLI in parallel. |
| **Model** | Live per-provider model list. Quota-exhausted models are shown disabled with their reset time. |
| **Effort (Efor)** | For Claude & Codex: `Low` (fast) · `Medium` · `High` (best quality). Maps to `claude --effort` and `codex -c model_reasoning_effort`. |
| **Voice** | Tap the mic to dictate; the composer turns into a recording bar with a live transcript and a send / cancel control. |
| **Images** | Paste a screenshot with `Ctrl+V` or pick a file. The path is handed to the agent, which reads it with its own tools. |
| **History** | "Yeni" starts a fresh chat; "Geçmiş" opens previously saved conversations (persisted in `localStorage`). |

---

## 🚀 Getting Started

### Prerequisites

Install [Node.js](https://nodejs.org/) **20 or higher** and the CLIs you want to orchestrate (each must be authenticated / logged in):

| CLI | Install | Notes |
| --- | --- | --- |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | Authenticate with `claude auth login` |
| **OpenAI Codex** | `npm install -g @openai/codex` | Authenticate with `codex login` |
| **Antigravity / Gemini** | `agy` or `gemini` on `PATH` | Log in via the Antigravity terminal (`agy login`) |

> Orkestra ships default agents using a `dry-run` command, so you can explore the panel even before any real CLI is installed.

### Installation

```bash
git clone https://github.com/burakdemir16/Orkestra-CLI.git
cd Orkestra-CLI
npm install
npm run dev
```

`npm run dev` runs the Fastify backend and the Vite frontend concurrently:

- **Frontend panel** → http://127.0.0.1:5173
- **Backend API** → http://127.0.0.1:8787

### Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run backend + frontend in watch mode |
| `npm run build` | Type-check (`tsc --noEmit`) and build the frontend |
| `npm start` | Run the backend only |
| `npm test` | Run the unit tests (Node test runner) |

---

## 🔧 Configuration

Configuration is read from environment variables (see [`.env.example`](.env.example)):

| Variable | Default | Description |
| --- | --- | --- |
| `ORKESTRA_HOST` | `127.0.0.1` | Backend bind host |
| `ORKESTRA_PORT` | `8787` | Backend port |
| `ORKESTRA_DATA_DIR` | `data` | SQLite DB + uploaded images |
| `ORKESTRA_WORKSPACE_DIR` | `workspaces` | Isolated per-run working directories |

---

## 🧩 Agent Command Templates

Each agent defines a `command` and an `argsTemplate`. Orkestra fills these placeholders at runtime:

| Placeholder | Value |
| --- | --- |
| `{prompt}` | The user task plus the previous agents' context |
| `{workspace}` | The isolated working directory for the run |
| `{transcript}` | The full transcript of previous agents |
| `{role}` | The agent's role in the pipeline |

**Example (Claude agent)**

- **Command:** `claude`
- **Arguments:** `["-p", "{prompt}", "--effort", "low"]`

---

## 🔌 API Reference

The backend exposes a small REST + SSE API on `127.0.0.1:8787`:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat` | Send a chat message (`planner`, `model`, `effort`, `attachments`) |
| `POST` | `/api/upload` | Upload an image (base64 data URL) for chat attachments |
| `GET` | `/api/cli-status` | Live auth status, usage windows, and model lists per CLI |
| `POST` | `/api/cli/:agent/{login,logout,test}` | Manage a CLI's session |
| `GET` | `/api/agents` · `POST/PUT/DELETE` | Manage pipeline agents |
| `GET` | `/api/runs` · `POST /api/runs` | List / start pipeline runs |
| `GET` | `/api/runs/:id/events` | Live run event stream (SSE) |
| `GET/POST` | `/api/git/*` | Status, branch, commit, push, draft PR |

---

## 🐚 PowerShell Automation

For terminal lovers, `orchestra-run.ps1` runs the same orchestration logic directly in your shell:

```powershell
./orchestra-run.ps1 -Task "Create a beautiful modern portfolio website" -ProjectDir "my-portfolio"
```

1. **Planner (Codex)** — Designs the structure and writes `01-plan.md`.
2. **Builder (Claude)** — Writes code to files (`index.html`, `styles.css`, `script.js`).
3. **Reviewer (Gemini / Antigravity)** — Audits the files and lists adjustments in `02-review.md`.
4. **Fixer (Claude)** — Applies the reviewer's notes.

---

## 📦 Project Structure

```text
├── apps/
│   ├── server/             # Fastify backend
│   │   └── src/
│   │       ├── index.ts    # REST + SSE API
│   │       ├── cli.ts      # Planner calls, auth detection, prompt building
│   │       ├── usage.ts    # Live usage limits + dynamic model lists
│   │       ├── runner.ts   # Pipeline executor
│   │       ├── db.ts       # SQLite store (WAL)
│   │       └── git.ts      # Git publisher
│   └── web/                # React + Vite dashboard (glassmorphism UI)
├── packages/
│   └── shared/             # Shared TypeScript types
├── docs/                   # Architecture docs
├── scripts/                # Helper login scripts
├── workspaces/             # Isolated run outputs
└── devam.md                # Handoff / continuation document
```

---

## 🛣️ Roadmap

- **Live Antigravity per-model quota** — The Antigravity IDE exposes per-model quota through its Codeium backend (`GetUserStatus`), which requires the IDE's DPAPI-encrypted API key. Currently the Antigravity model list is curated; live quota is planned.
- **Pipeline review loops** — Allow the Reviewer to send work back to the Fixer iteratively.
- **MemoryProvider layer** — Persist long-term decisions beyond the per-run SQLite transcript.

---

## 📝 License

Distributed under the **PolyForm Noncommercial License 1.0.0**. You may use, modify, and share Orkestra for **non-commercial** purposes. See [`LICENSE`](LICENSE) for the full terms.
