# Reference — Docs & Run Guide Generators

Loaded on demand by the **[Docs Agent]** and **[Run Guide Agent]**. Keep this out of `SKILL.md` so it
doesn't inflate the context window on every trigger.

---

## [Docs Agent] — README.md generator

After a completed project, generate `README.md` at the project root. **Scan real files first — never
invent.**

### Pre-generation scan (read before writing)
1. **Name & description** — `pom.xml` (`<name>`, `<description>`), `package.json` (`name`, `description`), or infer from the directory name.
2. **Tech stack & versions** — `pom.xml` dependencies + `<java.version>`, `package.json` dependencies, `pyproject.toml` (`requires-python`, `[project.dependencies]`).
3. **Project structure** — read the directory tree; include only source-meaningful paths.
4. **API endpoints** — scan `@RestController` / `@GetMapping` / `@PostMapping` (Java), router definitions (web), or FastAPI/Flask routes (Python).
5. **Ports** — `application.yml` (`server.port`), `vite.config.ts` (`server.port`), `compose.yaml` (`ports`).
6. **Environment / config** — `application.yml`, `.env.example`, `compose.yaml` `environment:` blocks.
7. **Commands** — Maven goals, `package.json` `scripts`, `pyproject.toml` scripts / `uv` usage, `pytest.ini`.

### Template

````markdown
<div align="center">

# 🎓 <Project Name>

> <One-line description>

![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.x-brightgreen?logo=springboot)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

</div>

---

## 📋 Overview
<2–3 paragraphs: what it does, who it's for, why it was built. Write in the language the user
communicated in — Korean prose if the user wrote Korean, English for technical terms and code.>

## ✨ Key Features
- <Feature 1>  (derive from implemented functionality — do not invent)
- <Feature 2>
- <Feature 3>

## 🛠 Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Backend | Spring Boot | 4.x |
| Language | Java | 21 (Temurin LTS) |
| Frontend | React + TypeScript | 19 / 5 |
| Build (web) | Vite + pnpm | — |
| Styling | Tailwind CSS | v4 |
| Server state | TanStack Query | — |
| Client state | Zustand | — |
| Validation | Zod | — |
| Database | <H2 dev / MS SQL / Oracle / Postgres> | — |
| Migrations | Flyway / Liquibase | — |
| Build (Java) | Maven | — |
| Container | Docker Compose | — |
| CI/CD | GitHub Actions | — |

## 📁 Project Structure
```
<project-root>/
├── backend/                  # Spring Boot (Java 21)
│   ├── src/main/java/com/<group>/
│   │   ├── controller/       # REST endpoints (RFC 9457 errors)
│   │   ├── service/          # Business logic
│   │   ├── repository/       # JPA repositories
│   │   ├── domain/           # Entities & enums
│   │   └── dto/              # Request/response records
│   └── src/main/resources/
│       ├── application.yml
│       └── db/migration/     # Flyway scripts (V1__init.sql …)
├── frontend/                 # React 19 + TypeScript (Vite, pnpm)
│   └── src/
│       ├── components/       # UI components
│       ├── pages/            # Route-level pages
│       ├── stores/           # Zustand client state
│       ├── queries/          # TanStack Query hooks
│       ├── schemas/          # Zod schemas
│       ├── i18n/             # ko.ts / en.ts (UI projects)
│       └── lib/              # API client
├── compose.yaml
├── .github/workflows/        # ci.yml, security.yml
└── README.md
```

## ✅ Prerequisites
| Tool | Required | Install |
|---|---|---|
| Java | 21+ | [Temurin 21](https://adoptium.net/) |
| Maven | 3.9+ | [maven.apache.org](https://maven.apache.org/) |
| Node.js | 22+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `corepack enable` |
| uv (Python projects) | latest | [astral.sh/uv](https://astral.sh/uv) |
| Docker | optional | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

## 🚀 Getting Started
See the **Run Guide** below for cross-OS commands. (Do not duplicate run commands here — link to one source.)

## 🔌 API Reference
Base URL: `http://localhost:<backend-port>/api`

| Method | Endpoint | Description | Params |
|---|---|---|---|
| GET | `/questions` | <desc> | `gradeLevel`, `subject`, `count` |
| POST | `/questions/answer` | <desc> | body: `{ questionId, selectedAnswer }` |

Errors follow **RFC 9457 Problem Details** (`application/problem+json`):
```json
{ "type": "https://example.com/errors/not-found", "title": "Question not found",
  "status": 404, "detail": "No question with id 42", "instance": "/api/questions/42" }
```

## ⚙️ Configuration
| Key | Default | Description |
|---|---|---|
| `server.port` | `8080` | Backend port |
| `spring.flyway.enabled` | `true` | Run migrations on startup |
| `management.endpoints.web.exposure.include` | `health,info` | Actuator exposure (keep tight) |

## 🧪 Running Tests
```bash
# Backend — JUnit 5 + Mockito + Testcontainers
cd backend && mvn test

# Frontend — Vitest + React Testing Library
cd frontend && pnpm test

# E2E — Playwright
cd frontend && pnpm exec playwright test
```

## 🤝 Contributing
1. Fork → `git checkout -b feature/x` → `git commit -m "feat: …"` → PR.

## 📄 License
MIT.
````

### Rules
- Write the README in the **same language the user communicated in** (Korean prose if they wrote Korean; English for technical terms/code).
- Replace every `<placeholder>` with values read from project files — never ship angle-bracket placeholders.
- Include only sections that apply to the detected project type; omit the rest.
- Badges: only for technologies actually present.
- API Reference: only endpoints found by scanning controllers/routers.
- After generating, print: `✅ README.md generated at <project-root>/README.md`.

---

## [Run Guide Agent] — environment-aware run summary

Auto-detect the environment, then emit a tailored, **all-OS** run guide (users share projects across
machines).

### Detection steps (in order)
1. **OS / shell** — from environment context: `darwin`→zsh/bash · `linux`→bash · `win32`→PowerShell/cmd/Git Bash.
2. **Project type** — `pom.xml`→Spring Boot · `package.json`→Node/React · `pyproject.toml`→Python (uv) · `compose.yaml`→Docker.
3. **Tool availability** — `java`, `mvn`/`./mvnw`, `node`, `pnpm`, `uv`, `docker`, `docker compose`.
4. **Ports** — `application.yml`, `vite.config.ts`, `compose.yaml`.

### Output template
```
## 🚀 Run Guide  (detected: <OS> / <Shell>  ← you are here)

### Prerequisites
| Tool   | Required | macOS / Linux   | Windows (PowerShell) |
|--------|----------|-----------------|----------------------|
| Java   | 21+      | java -version   | java -version        |
| Maven  | 3.9+     | mvn -version    | mvn -version         |
| Node   | 22+      | node -v         | node -v              |
| pnpm   | 9+       | pnpm -v         | pnpm -v              |
| uv     | latest   | uv --version    | uv --version         |
| Docker | optional | docker -v       | docker -v            |

> ⚠️ Windows: JDK/Maven은 설치 후 PATH 등록 필요. 권장 패키지 매니저 winget(Win11) 또는 Chocolatey.
>   winget install -e --id EclipseAdoptium.Temurin.21.JDK
>   winget install -e --id Apache.Maven
>   winget install -e --id OpenJS.NodeJS.LTS
>   corepack enable        # pnpm 활성화
>   pnpm dlx … / pnpm install

---

### Option A — Local Dev (recommended for development)

#### macOS / Linux (zsh · bash)
# Terminal 1 — Backend
cd backend && ./mvnw spring-boot:run        # mvnw 없으면 mvn
# → API: http://localhost:<backend-port>

# Terminal 2 — Frontend
cd frontend && pnpm install && pnpm dev
# → App: http://localhost:<frontend-port>

#### Windows — PowerShell
cd backend; .\mvnw.cmd spring-boot:run
cd frontend; pnpm install; pnpm dev

#### Windows — Git Bash
# (macOS/Linux 명령어와 동일)

---

### Option B — Docker Compose (production-like)
docker compose up --build
# → App: http://localhost:<mapped-port>
# ※ Windows: Docker Desktop 필요 (https://docs.docker.com/desktop/windows/)

---

### Option C — Python (uv)
#### macOS / Linux / Windows (동일)
cd <project-root>
uv sync                       # pyproject.toml + uv.lock 기반 환경 생성
uv run <entrypoint>           # 예: uv run python -m app
# (별도 venv 활성화 불필요 — uv run이 처리)

---

### Quick-stop
# Local  (all OS): 각 터미널 Ctrl+C
# Docker (all OS): docker compose down
```

### Rules
- Render **all** OS variants (macOS/Linux + Windows PowerShell + Git Bash) regardless of host OS.
- Mark the detected OS with `← you are here`.
- Include only Option A/B/C blocks matching the detected project type.
- If `compose.yaml` exists, always include Option B.
- Replace every `<placeholder>` with values from config files.
- Add a ⚠️ line for each required tool not detected.
- Prefer the Maven Wrapper (`./mvnw`, `.\mvnw.cmd`) when present — no global Maven needed.
- For Python, prefer `uv sync` + `uv run` over manual `venv`/`pip` (faster, lockfile-driven, no activation step).
