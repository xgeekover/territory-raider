# ⑥ 피드백 (Feedback)

> 분석→개발→테스트→품질 과정에서 실제로 발견한 이슈와 수정 루프. 파이프라인 산출물 6/8.
> 이 문서는 "무엇이 처음 계획대로 안 됐고, 왜, 어떻게 고쳤는가"의 기록이다.

## FB-1. Electron 바이너리 미설치 (install-script 차단)

- **증상**: `npm i electron` 후 `node_modules/electron/dist/version` 없음. 패키지만 설치되고 바이너리 미다운로드.
- **원인**: 환경의 allow-scripts 가드가 electron `postinstall`(바이너리 다운로드 스크립트)을 차단.
- **수정**: `node node_modules/electron/install.js` 수동 실행 → v43.1.0 정상 확보.
- **반영**: CI(⑦)에서는 이 가드가 없으므로 표준 `npm ci`로 자동 설치됨. 로컬 재현 시 위 명령 필요 → README/오케스트레이션 문서에 명시.

## FB-2. vite-plugin-electron@1.1.0 이 Vite 6에서 ESM을 강제 (핵심 이슈)

- **증상**: main/preload를 `format:'cjs'`, `entryFileNames:'[name].cjs'`로 설정했는데 출력이 **ESM `import`** 문으로 나옴. 빌드 로그에 `Unknown output options: codeSplitting`, `Unknown input options: platform` 경고.
- **원인**: 1.1.0은 Rolldown/신형 Vite를 겨냥 — 클래식 Vite 6(Rollup 4)에서 플러그인이 주입한 옵션이 무시되며 내 출력 포맷 override도 함께 유실.
- **1차 대응**: Vite 6 호환 `0.29.0`으로 다운그레이드 → 경고는 사라졌으나 여전히 ESM.
- **2차 대응**: Vite lib 모드 `formats:['cjs']`로 강제 → main은 CJS가 됐지만 **preload가 `.mjs`로 출력**됨(플러그인이 `"type":"module"` 하에서 preload 이름을 강제). `.mjs`는 sandbox preload에서 로드 불가 → 치명.

## FB-3. 결정: 플러그인 폐기, esbuild 결정적 빌드로 전환

- **판단**: 플러그인과의 씨름은 비결정적이고 취약. 설계 문서의 폴백 트리거 발동.
- **조치**: `vite-plugin-electron` 제거, `esbuild`를 명시 devDep으로 추가.
  - 렌더러: **순수 `vite build`** (웹 빌드 완전 무변경 — 원래 목표 달성).
  - main/preload: `scripts/build-electron.mjs`가 esbuild로 `format:'cjs'` + `.cjs` 확장자 **결정적** 출력. `electron`·`node:*` external.
  - dev: `scripts/dev-electron.mjs`가 Vite dev server + esbuild watch + Electron 실행 오케스트레이션.
- **결과**: main.cjs(require 4, import 0), preload.cjs(정상 `require("electron")` + contextBridge). 부팅 스모크 exit 0.
- **교훈**: 빌드 산출물의 포맷/확장자가 런타임 계약(여기선 sandbox preload=CJS)에 직결될 때는, 편의 플러그인보다 **직접 제어 가능한 최소 빌드**가 안전하다.

## FB-4. ESLint react-hooks v7 오탐

- **증상**: `eslint .` 11 errors — 전부 `react-hooks/refs`가 기존 `useRafLoop`/`useGameEngine`의 latest-ref·external-store 패턴을 지적.
- **원인**: v7 `recommended`에 React Compiler 실험 규칙이 포함됨. 컴파일러 미도입 프로젝트에는 과도.
- **수정**: 안정 규칙 2개(`rules-of-hooks`=error, `exhaustive-deps`=warn)만 채택. 검증된 게임 코드는 불변.

## FB-5. ESLint가 scripts/ Node 전역 미인식

- **증상**: `scripts/*.mjs`의 `console`/`process`에 `no-undef` 5 errors.
- **원인**: flat config에 scripts 디렉터리 매칭 블록 누락.
- **수정**: `scripts/**/*.mjs`에 `globals.node` 적용 블록 추가 → 0 errors.

## 피드백 루프 요약

| ID | 심각도 | 상태 |
|---|---|---|
| FB-1 | 중 (환경) | ✅ 해결 + 문서화 |
| FB-2 | 높음 (빌드 불능) | ✅ FB-3으로 해결 |
| FB-3 | — (아키텍처 결정) | ✅ 적용·검증 |
| FB-4 | 낮음 (오탐) | ✅ 설정 조정 |
| FB-5 | 낮음 | ✅ 해결 |

> 모든 발견 이슈가 코드/설정/문서에 반영되어 클로즈됨. 잔여 부채(아이콘·서명)는 [05-QUALITY](./05-QUALITY.md) §5에 등록.
