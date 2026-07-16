# ⑤ 품질점검 (Quality)

> 정적 분석 · 의존성 감사 · Electron 보안 베스트프랙티스 대조. 파이프라인 산출물 5/8.

## 1. 품질 게이트 결과

| 게이트 | 명령 | 결과 |
|---|---|---|
| 타입 검사(렌더러) | `tsc --noEmit` | ✅ 0 errors (strict) |
| 타입 검사(Electron) | `tsc --noEmit -p tsconfig.electron.json` | ✅ 0 errors |
| Lint | `eslint .` | ✅ 0 errors |
| 단위 테스트 | `vitest run` | ✅ 84 passed (엔진 72 + store 12) |
| 의존성 감사(prod) | `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| 의존성 감사(all) | `npm audit` | ✅ 0 vulnerabilities |
| 렌더러 빌드 | `vite build` | ✅ 성공 (dist 192K) |
| Electron 빌드 | esbuild → `.cjs` | ✅ CJS 정상(require/module.exports) |
| 부팅 스모크(dev) | `SMOKE_TEST=1 electron .` | ✅ exit 0 "renderer loaded OK" |
| 부팅 스모크(packaged) | `.app` 직접 실행 | ✅ exit 0 |

## 2. Lint 정책 결정

`eslint-plugin-react-hooks@7`의 `recommended`는 React Compiler 정렬 실험 규칙(`react-hooks/refs` 등)을 포함하며, 이 프로젝트가 의도적으로 쓰는 **latest-ref 패턴**(`cbRef.current = callback`)과 **external-store 엔진 반환**을 오탐한다. 컴파일러 미도입 프로젝트 관례에 따라 안정된 두 규칙만 채택:

- `react-hooks/rules-of-hooks`: error
- `react-hooks/exhaustive-deps`: warn

검증된 게임 로직을 lint 취향에 맞춰 변형하지 않는다는 원칙(회귀 위험 회피).

## 3. Electron 보안 체크리스트 (공식 권고 대조)

| # | 항목 | 적용 | 구현 위치 |
|---|---|---|---|
| 1 | 보안 콘텐츠만 로드 | ✅ | dev=localhost, prod=`file://` 로컬 자산 |
| 2 | 원격 콘텐츠 `nodeIntegration` 비활성 | ✅ | `nodeIntegration: false` |
| 3 | `contextIsolation` 활성 | ✅ | `contextIsolation: true` |
| 4 | `sandbox` 활성 | ✅ | `sandbox: true` (preload는 CJS로 컴파일) |
| 5 | 권한 요청 처리 | ✅ | `setPermissionRequestHandler`/`CheckHandler` 전면 deny |
| 6 | `webSecurity` 유지 | ✅ | `webSecurity: true` |
| 7 | CSP 정의 | ✅ | prod `onHeadersReceived`로 엄격 CSP 주입 |
| 8 | `allowRunningInsecureContent` 미설정 | ✅ | 기본값 false |
| 9 | 실험 기능 미사용 | ✅ | 기본값 |
| 10 | `enableBlinkFeatures` 미사용 | ✅ | 미설정 |
| 11 | `<webview>` 옵션 검증 | ➖ | webview 미사용 |
| 12 | 네비게이션 제한 | ✅ | `will-navigate` preventDefault |
| 13 | 새 창 생성 제한 | ✅ | `setWindowOpenHandler` → `deny` |
| 14 | `openExternal` 신뢰 콘텐츠만 | ✅ | `https://`만 허용, 앱 내 외부링크 없음 |
| 15 | 최신 Electron | ✅ | Electron 43 |

추가 하드닝: **단일 인스턴스 락**(`requestSingleInstanceLock`), IPC는 `highscore:get`/`set` 2채널만 화이트리스트, `set` 입력은 `sanitizeScore`로 정수·비음수 검증.

## 4. CSP 상세

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';   ← Tailwind 인라인 스타일 때문
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

dev 모드는 Vite HMR(웹소켓/eval) 때문에 CSP 미적용 — 프로덕션 전용.

## 5. 잔여 품질 부채 (후속)

- **앱 아이콘 미설정** — electron-builder가 기본 Electron 아이콘 사용(빌드는 정상). `build/icon.icns|ico|png` 추가 필요.
- **코드 서명/공증 미적용** — 미서명 아티팩트. 배포 시 시크릿 주입 지점만 CI에 마련(⑦ 참조).
- `exhaustive-deps`는 warn — 신규 회귀는 경고로 노출되나 게이트를 막지 않음.
