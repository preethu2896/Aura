# AURA — Enterprise AI Cowork Platform

AURA is a premium, secure, local-first AI Cowork platform designed to integrate autonomous agent execution, multi-agent coordination, and natural-language background automation directly into enterprise workspace workflows.

---

## ⚡ Core Philosophy & Architecture

AURA is engineered as a secure side-by-side coworker. Unlike simple text interfaces, AURA provides a sandboxed runtime context where AI Agents safely execute tasks on your system under strict user permission supervision.

- **Local-First & Private**: All history, configurations, project files, and settings are stored locally in a secure SQLite database, ensuring proprietary code and corporate assets never leave your local infrastructure.
- **Process Boundary Isolation**: Fully decoupled architecture separating the Main process (no DOM/Node.js access) and the Renderer process (safe UI execution) using a preload IPC bridge, protecting against arbitrary code execution risks.
- **YOLO & Supervised Execution Modes**: Toggle between step-by-step permission confirmation (granular approval for file writes, terminal execution, and internet access) and YOLO mode (unattended autonomous execution).

---

## 📁 ChatGPT-Style Projects

Organize your tasks, documents, customized instructions, settings, and memory into fully isolated, self-contained project workspaces.

- **Workspace File Isolation**: Dedicated directories (`workDir/projects/<project_id>/files/`) for uploaded files, enabling secure, cloud-sync-ready project management.
- **Dynamic Configuration Inheritance**: Conversations automatically inherit project settings:
  - Custom instructions and system prompts.
  - Model configurations (provider, API keys, temperature).
  - Custom voice defaults (TTS voice name and STT language).
  - Selected MCP servers and active teammate agents.
- **Scoped memory**: Long-term context is stored with tags, importance scores, and source tracking (user-provided vs. agent-learned) that never leak between projects.
- **Fallback Resolution**: Project configurations automatically resolve to the built-in, un-deletable "General" project if active entities are missing.

---

## 🤖 Multi-Agent Workspace Hub

AURA operates as a unified manager for developer command-line interfaces, eliminating separate toolchains.

- **Auto-Discovery**: Instantly detects local CLI developer engines, including Claude Code, Codex, Qwen Code, Goose AI, Hermes, Snow CLI, Cursor Agent, and AURA CLI (aionrs).
- **Unified MCP (Model Context Protocol) Injection**: Configure Model Context Protocol tools once and project them automatically across all developer agents.
- **Parallel Context Sessions**: Run multiple independent developer agent sessions concurrently within the same project workspace.

---

## 👥 Team Mode (Multi-Agent Orchestration)

Execute complex workflows by defining multi-agent team directories.

- **Leader-Teammate Topology**: A designated Leader agent decomposes user goals into structured sub-tasks and delegates them to parallel Teammate agents.
- **Mailbox Context Exchange**: Teammate agents communicate asynchronously through virtual mailbox exchanges to resolve dependency gates without user intervention.
- **Dynamic Task Boards**: Real-time Kanban board updates within the workspace showing teammate execution logs, current tasks, and outputs.
- **Granular Supervision**: Sliding permission bars for each teammate, allowing you to grant auto-approval to trusted agents while supervising others.

---

## ⏰ cron Background Automation

Schedule background agents to automate recurring workflows using natural language.

- **Multi-Engine Scheduling**: Configure recurrence using standard Cron expressions (supporting timezone offsets), fixed-interval timers, or one-time alerts.
- **Resilience & Wakeup Queuing**: AURA prevents OS sleep states during critical task runs and automatically executes missed runs once the machine wakes up.
- **Session-Bounded Context**: Scheduled tasks run either inside active conversation history (preserving context) or spin up fresh sessions to compile clean, recurring audits.

---

## 📄 Office Document Automation (OfficeCLI)

AURA is integrated with the `OfficeCLI` toolchain to automate layout generation, calculations, and content structure.

- **Morph PPT Generator**: Auto-generates presentations (`.pptx`) featuring structured slides and seamless Morph slide-to-slide transitions.
- **Structured Word Processor**: Generates formatted contracts, legal templates, and academic papers (`.docx`) adhering to predefined styles.
- **Excel Spreadsheet Automator**: Automates table calculations, applies conditional formatting, and generates data sheets (`.xlsx/.xlsm`) complete with computational formulas.

---

## 📱 Anywhere Access (Remote Gateways)

Supervise, interact, and guide your active agents remotely on any device.

- **Secure WebUI**: Fully responsive web interface protected by end-to-end password validation or localized QR code authentication.
- **Chat Bot Channels**: Bidirectional integration with native channels, allowing you to trigger workflows, approve agent commands, and receive alerts via:
  - **Telegram** (dedicated Cowork Bot)
  - **Lark** (corporate bot endpoints)
  - **DingTalk** (AI card rendering and callback integrations)
  - **WeChat** (individual WeChat integrations)

---

## 🎨 Extensible Assistant & Skills Ecosystem

Customize agent intelligence using modular plug-and-play skills.

- **21+ Built-in Assistants**: Pre-configured templates optimized for coding, presentation design, data analysis, academic research, and system administration.
- **Three-Tier Skills Architecture**:
  - **Built-in**: Base toolchains provided by the AURA engine.
  - **Custom**: User-defined YAML/Markdown schemas mapped to local project directories.
  - **Extension**: Specialized capabilities contributed by the Extension SDK.
- **Live Preview Panel**: Multi-tab preview area supporting PDF, Word, Excel sheets, images, interactive Diff displays, and rendered Mermaid flowcharts.

---

## 🔑 LLM Provider Adaptability

Plug in any API key or local model. AURA's adapter layer interfaces seamlessly with:

- **Commercial Cloud Nodes**: Anthropic (Claude), OpenAI (GPT), Gemini (Vertex & AI Studio), DeepSeek, xAI (Grok).
- **Local Inference Engines**: Ollama, LM Studio (fully customized endpoint routing).
- **Gateway Aggregators**: Unified access via NewAPI configurations.
