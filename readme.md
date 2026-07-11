# AURA - Cowork with AI Agents

AURA is a free, open-source Cowork application designed for side-by-side collaboration with AI Agents.

## Key Features

- **Cowork Platform**: Unlike traditional AI clients, AURA gives AI Agents full capability to read/write files, run terminal commands, search the web, and execute tools under your supervision.
- **ChatGPT-Style Projects**: Organize conversations, files, custom memory, and LLM settings into isolated project folders. Project memory never leaks between scopes.
- **Multi-Agent Ecosystem**: Automatically detects and integrates CLI developer tools such as Claude Code, Codex, Qwen Code, and AURA CLI (aionrs) in a unified workspace GUI.
- **Team Mode**: Run Leader-Teammate agent flows to delegate and execute complex developer tasks concurrently.
- **Office Document Automation**: Built-in specialized assistants for automated layout generation of presentations (PPT), papers (Word), and spreadsheets (Excel).
- **natural-language Cron Scheduling**: Set up background automation using standard cron rules or natural language commands.
- **Anywhere Access**: Remote web interface (WebUI) and native chat bot integrations (Telegram, Lark, WeChat).
- **Bring Your Own Key**: Supports commercial APIs (OpenAI, Anthropic, Gemini, DeepSeek), local endpoints (Ollama, LM Studio), and model hubs (NewAPI).

## Quick Start

### Prerequisites
Make sure you have [Bun](https://bun.sh) installed.

### Installation
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/preethu2896/Aura.git
   cd Aura
   bun install
   ```

2. Start the development server:
   ```bash
   bun run dev
   ```

### Running Tests
Run unit tests with Vitest:
```bash
bun run test
```

### Packaging
Build the production package:
```bash
bun run build
```
