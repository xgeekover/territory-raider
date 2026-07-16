# ⑧ 오케스트레이션 (Orchestration)

> 전 단계를 하나의 재현 가능한 흐름으로 묶는 실행 계층. 파이프라인 산출물 8/8.

## 1. 파이프라인 전체 흐름

```
 로컬 개발 ──► 통합 게이트(verify) ──► 패키징(dist) ──► CI(3-OS) ──► 태그 릴리스
    │               │                     │              │              │
 dev:desktop   typecheck·lint         electron-builder  ci.yml      release.yml
 (HMR)         ·test·build            (dmg/nsis/App…)   PR/push     tag v*.*.*
```

각 단계는 **동일 명령**으로 로컬과 CI에서 실행된다(환경 드리프트 최소화).

## 2. npm 스크립트 = 오케스트레이션 계약

| 스크립트 | 묶는 단계 | 내용 |
|---|---|---|
| `dev` | 웹 개발 | 순수 Vite (기존, 무변경) |
| `dev:desktop` | 데스크탑 개발 | Vite dev server + esbuild watch + Electron (`scripts/dev-electron.mjs`) |
| `typecheck` | 품질 | 렌더러(`tsconfig`) + Electron(`tsconfig.electron.json`) 이중 검사 |
| `lint` | 품질 | ESLint flat config |
| `test` | 테스트 | Vitest 84 (엔진 72 + store 12) |
| `build:renderer` | 개발 | `vite build` → `dist/` |
| `build:electron` | 개발 | esbuild → `dist-electron/*.cjs` |
| `build:desktop` | 개발 | typecheck → build:renderer → build:electron |
| **`verify`** | **게이트** | **typecheck → lint → test → build:desktop** (CI/커밋 전 관문) |
| `start:desktop` | 테스트 | `electron .` (SMOKE_TEST=1 시 부팅 후 자동 종료) |
| `dist` / `dist:dir` | 패키징 | build:desktop → electron-builder (현재 OS) |
| `dist:mac` / `dist:win` / `dist:linux` | CI 패키징 | OS별 인스톨러 |

> **단일 진입점 원칙**: 개발자는 `npm run verify` 하나로 CI가 볼 것과 동일한 관문을 로컬에서 통과시킨다.

## 3. CI/CD 오케스트레이션 (⑦ 연계)

- **`ci.yml`** — push/PR(main). 3-OS 매트릭스에서 `typecheck·lint·test·build:desktop` + **부팅 스모크**(Linux는 xvfb + chrome-sandbox SUID, mac/win 직접).
- **`release.yml`** — 태그 `v*.*.*`. OS별 인스톨러 빌드 → 아티팩트 업로드 → GitHub Release(draft) 첨부. 코드서명 시크릿 주입 지점 명시(주석).

## 4. 아키텍처 오케스트레이션 (런타임)

```
Electron main (dist-electron/main.cjs)
  ├─ 창 생성 · 보안 하드닝 · 메뉴 · 단일 인스턴스 락
  ├─ IPC: highscore:get/set  ──►  store.ts (원자적 JSON 영속화)
  └─ preload.cjs ──contextBridge──►  renderer(window.desktop)
                                        └─ highscore.ts 어댑터: desktop=IPC / web=localStorage
```

## 5. 재현 절차 (신규 머신)

```bash
npm ci
# (allow-scripts 차단 환경만) node node_modules/electron/install.js   # FB-1 참조
npm run verify          # 전 관문 통과 확인
npm run dev:desktop     # 데스크탑 개발 실행
npm run dist            # 현재 OS 인스톨러 생성 → release/
```

## 6. 파이프라인 산출물 인덱스

| 단계 | 산출물 |
|---|---|
| ① 분석 | [01-ANALYSIS.md](./01-ANALYSIS.md) |
| ② 설계 | [02-DESIGN.md](./02-DESIGN.md) |
| ③ 개발 | `electron/`, `scripts/`, `vite.config.ts`, `electron-builder.yml` |
| ④ 테스트 | `tests/electron/store.test.ts`, 부팅 스모크 훅 |
| ⑤ 품질 | [05-QUALITY.md](./05-QUALITY.md) |
| ⑥ 피드백 | [06-FEEDBACK.md](./06-FEEDBACK.md) |
| ⑦ CI/CD | `.github/workflows/ci.yml`, `release.yml` |
| ⑧ 오케스트레이션 | 본 문서 + 통합 npm 스크립트 |
| ⑨ UX 이터레이션 | [09-UX-ITERATION.md](./09-UX-ITERATION.md) — 아이콘 + 주스 레이어 |
| ⑩ 보스전 | [10-BOSS-BATTLE.md](./10-BOSS-BATTLE.md) — 엔진 확장: 탄막·격노 페이즈 |

## 7. 최종 상태

- ✅ 데스크탑 앱 부팅/렌더 검증(dev 빌드 + packaged `.app` 모두 exit 0).
- ✅ 웹 빌드 완전 무변경(순수 Vite 경로 보존).
- ✅ `verify` 게이트 그린: typecheck · lint · 84 tests · build.
- ✅ 3-OS CI + 태그 릴리스 자동화.
- ⏭ 후속: 앱 아이콘, 코드서명/공증, 자동 업데이트(모두 시크릿/자산 주입 지점만 마련됨).
