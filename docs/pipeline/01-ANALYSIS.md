# ① 분석 (Analysis)

> Territory Raider(Volfied 스타일 게임)를 **Electron 데스크탑 앱**으로 전환하기 위한 현행 분석.
> 파이프라인 산출물 1/8. 작성일 기준 베이스라인: typecheck ✅, Vitest 72 tests ✅.

## 1. 현행 스택

| 영역 | 기술 |
|---|---|
| 언어 | TypeScript 5.8 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| UI | React 18.3 + Tailwind v4 (`@tailwindcss/vite`) |
| 렌더 | Canvas 2D (게임엔진 라이브러리 없음) |
| 번들러 | Vite 6.3 |
| 테스트 | Vitest 3 (엔진 순수 TS, jsdom 불필요 — `environment: node`) |
| 런타임 | Node 24 / npm 11 |

## 2. 아키텍처 요약

```
engine/ (순수 TS, DOM 의존성 0)  ──tick/dispatch/subscribe──►  ui/ (React + Canvas)
  core/    gameState, grid, rng, types                     components/  GameCanvas, Hud, 5 screens
  systems/ movement, claim, laser, enemies, spark,         hooks/       useGameEngine, useKeyboard, useRafLoop
           collision, items, scoring                       render/      renderer(Canvas2D), perf
  config/  constants, stages                               highscore.ts (localStorage)
```

- 엔진은 **React/DOM 무의존** 순수 모듈 → headless 테스트 가능. 데스크탑 전환에 영향 없음(안전 지대).
- 렌더는 정적 레이어(offscreen canvas) + 동적 레이어. 캔버스 고정 크기 **768×576** (`GRID 128×96 × CELL_PX 6`).

## 3. 브라우저 API 표면 (전환 리스크 스캔)

| API | 위치 | Electron 영향 |
|---|---|---|
| `window.localStorage` | `ui/highscore.ts` | 렌더러에서 동작하나 **파일 영속화로 승격 권장**(프로 데스크탑 표준) |
| `window.addEventListener(keydown/keyup/blur)` | `useKeyboard.ts` | 영향 없음 |
| `document.getElementById/createElement` | `main.tsx`, `renderer.ts` | 영향 없음 |
| 오디오 / `navigator` / 네트워크 / fetch | **없음** | 리스크 없음 |

> 결론: 브라우저 의존 표면이 매우 얕아 **Electron 친화적**. 오디오 자동재생·CORS·권한 이슈 없음.

## 4. 전환 시 반드시 해결할 항목 (Must-fix)

1. **Vite `base` 경로** — 현재 미설정(기본 `/`). Electron은 프로덕션에서 `file://`로 로드하므로 `/assets/...` 절대경로가 깨진다. → `base: './'` 필요 (설계에서 확정).
2. **보안 기본값** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, 엄격 CSP, 외부 네비게이션 차단.
3. **web/desktop 겸용 유지** — 기존 `npm run dev`(브라우저) 파이프라인을 깨지 않고 Electron 레이어를 **가산(additive)**으로 얹는다.

## 5. 개선 기회 (Should-do)

- **하이스코어 영속화**: `localStorage`(브라우저 캐시성) → main 프로세스가 `app.getPath('userData')/highscore.json`에 저장. 렌더러는 보안 preload 브리지(`window.desktop`)로 접근, 브라우저 환경에서는 자동으로 `localStorage` 폴백.
- **네이티브 창 UX**: 고정 크기(≈ 820×760, 캔버스 768 + HUD/여백), 최소 크기, 앱 메뉴, 종료/포커스 처리.

## 6. 요구사항 정의

### 기능 (FR)
- FR1. 브라우저와 동일한 게임플레이를 네이티브 창에서 제공.
- FR2. 하이스코어는 앱 재시작 후에도 유지(파일 영속화).
- FR3. macOS·Windows·Linux 3종 인스톨러/아티팩트 생성.

### 비기능 (NFR)
- NFR1. 보안: 렌더러 샌드박스, IPC 화이트리스트, CSP.
- NFR2. 성능: 60Hz 고정 스텝 렌더 유지(현행과 동일).
- NFR3. 회귀 방지: 기존 72개 엔진 테스트 그린 유지 + 웹 빌드 병행 유지.
- NFR4. 재현 가능한 CI 빌드(3 OS 매트릭스).

## 7. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| `file://` 자산 경로 깨짐 | 앱 백지화면 | `base:'./'` + 빌드 산출물 스모크 검증 |
| Electron/Vite 버전 호환 | 빌드 실패 | `vite-plugin-electron` 도입, 실패 시 `electron-vite`로 폴백 |
| 코드사이닝 미보유 | 배포 경고 | CI는 **미서명 아티팩트** 산출(서명은 후속 시크릿 주입 지점만 마련) |
| 창 크기/HUD 레이아웃 | UX 저하 | 고정 창 + `useContentSize` 로 캔버스 기준 사이징 |

## 8. 범위 경계

- **포함**: Electron 셸, 보안 브리지, 파일 영속화, 3-OS 패키징 설정, CI/CD, 파이프라인 문서.
- **제외(후속)**: 코드 서명/공증(Apple notarization), 자동 업데이트(autoUpdater) 서버, 스토어 배포. → 설계에서 **확장 지점만** 남긴다.
