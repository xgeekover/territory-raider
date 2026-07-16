# ② 설계 (Design)

> 분석([01-ANALYSIS](./01-ANALYSIS.md)) 기반 Electron 전환 아키텍처 확정. 파이프라인 산출물 2/8.

## 1. 설계 원칙

1. **가산적(additive)** — 기존 `src/` 렌더러 코드와 웹 빌드를 건드리지 않고 Electron 레이어만 추가. 게임은 그대로 브라우저에서도 돈다.
2. **보안 우선(secure by default)** — Electron 공식 권고를 기본값으로. 렌더러는 Node 접근 불가, 화이트리스트 IPC만 노출.
3. **단일 코드베이스** — 하이스코어 접근을 어댑터로 추상화해 web(localStorage)/desktop(파일) 양쪽 지원.

## 2. 빌드/패키징 도구 결정

| 관심사 | 선택 | 근거 |
|---|---|---|
| 개발/번들 | **`vite-plugin-electron/simple`** | 기존 `vite.config.ts`·`index.html` 유지한 채 main/preload 빌드 + HMR 추가. 최소 침습. |
| 패키징 | **`electron-builder`** | 3-OS 인스톨러(dmg/zip, nsis, AppImage/deb) 표준. CI 매트릭스 친화. |
| 폴백 | `electron-vite` | vite-plugin-electron이 Vite6와 충돌 시 전환(분석 리스크 항목). |

## 3. 프로세스 모델

```
┌─────────────── Main process (Node) ─ electron/main.ts ───────────────┐
│  app 라이프사이클 · BrowserWindow 생성 · 앱 메뉴                        │
│  IPC 핸들러:  highscore:get / highscore:set  (ipcMain.handle)         │
│  영속화:  userData/highscore.json  (원자적 쓰기)                       │
│  보안:  will-navigate/​setWindowOpenHandler 차단, CSP 세팅              │
└───────────────▲───────────────────────────────┬─────────────────────┘
     preload 로드 │ contextBridge                  │ loadURL / loadFile
┌───────────────┴──── Preload (isolated) ─────────▼─────────────────────┐
│  electron/preload.ts                                                   │
│  contextBridge.exposeInMainWorld('desktop', {                          │
│     isDesktop: true,                                                    │
│     getHighScore(): Promise<number>,                                    │
│     setHighScore(n): Promise<void>,                                     │
│  })  // ipcRenderer.invoke 만 래핑, 그 외 노출 없음                      │
└───────────────────────────────▲───────────────────────────────────────┘
                                 │ window.desktop (읽기전용 브리지)
┌────────────────────────────────┴──── Renderer (기존 src/) ─────────────┐
│  React + Canvas 게임 (변경 없음)                                        │
│  ui/highscore.ts → 어댑터로 교체: window.desktop 있으면 IPC, 없으면 LS   │
└────────────────────────────────────────────────────────────────────────┘
```

## 4. 보안 설계 (NFR1)

BrowserWindow `webPreferences`:

```ts
{
  contextIsolation: true,      // 렌더러 ↔ preload 컨텍스트 격리
  nodeIntegration: false,      // 렌더러에서 require/Node 불가
  sandbox: true,               // OS 샌드박스
  webSecurity: true,
  preload: <preload.js 절대경로>,
}
```

추가 하드닝:
- **CSP**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` — 프로덕션은 `onHeadersReceived`로 주입. (Tailwind 인라인 스타일 때문에 style만 `unsafe-inline`.)
- **네비게이션 잠금**: `will-navigate` 취소, `setWindowOpenHandler`는 모두 `deny`(외부 링크는 `shell.openExternal`로만).
- **IPC 최소 노출**: `get`/`set` 두 채널만. set은 입력을 `Number`·범위 검증.

## 5. 하이스코어 영속화 설계 (FR2)

- **저장 위치**: `app.getPath('userData')/highscore.json` → `{ "highScore": <int> }`.
- **원자적 쓰기**: `*.tmp`에 쓰고 `rename`으로 교체(손상 방지).
- **어댑터**(`src/ui/highscore.ts`):
  - 기존 동기 API(`loadHighScore`/`saveHighScore`)는 **웹 호환용으로 유지**.
  - 데스크탑 비동기 API(`initHighScore`)를 추가: 앱 시작 시 `window.desktop.getHighScore()`로 초기값 로드, 저장은 `window.desktop.setHighScore()`.
  - 브라우저에서는 `window.desktop`이 없으므로 자동으로 localStorage 경로.
- **App.tsx**: 최소 변경 — 초기 하이스코어를 async로 로드, 갱신 시 어댑터 저장 호출.

## 6. 창/UX 설계

| 항목 | 값 |
|---|---|
| 콘텐츠 크기 | 820 × 760 (캔버스 768 + HUD/여백) |
| resizable | false (픽셀 게임 정합성) — 최소/최대 동일 |
| backgroundColor | `#09090b` (zinc-950, 초기 백플래시 방지) |
| show | `ready-to-show` 후 표시(백지 깜빡임 제거) |
| 메뉴 | 최소 앱 메뉴(Quit/Reload(dev)/Toggle Fullscreen/About) |
| title | `Territory Raider` |

## 7. 파일 구조 (추가분)

```
Volfied/
├─ electron/
│  ├─ main.ts          # 메인 프로세스 (창·IPC·영속화·보안·메뉴)
│  ├─ preload.ts       # contextBridge 브리지
│  └─ store.ts         # highscore.json 원자적 read/write (테스트 대상)
├─ build/              # electron-builder 리소스(아이콘 placeholder)
├─ electron-builder.yml
├─ vite.config.ts      # vite-plugin-electron 플러그인 추가 + base:'./'
└─ src/ui/highscore.ts # 어댑터로 확장 (기존 함수 시그니처 유지)
```

## 8. 개발 모드 vs 프로덕션 로딩

| 모드 | 렌더러 로드 | 트리거 |
|---|---|---|
| dev | `loadURL(process.env.VITE_DEV_SERVER_URL)` + DevTools | `vite` HMR |
| prod | `loadFile(dist/index.html)` (base `./`) | `npm run build` 후 |

## 9. npm 스크립트 설계 (오케스트레이션 연결)

| 스크립트 | 역할 |
|---|---|
| `dev` | 웹 개발(기존, 유지) |
| `dev:desktop` | Electron + Vite HMR |
| `build` | 웹 프로덕션 빌드(기존, 유지) |
| `typecheck` | `tsc --noEmit`(electron 포함) |
| `test` | Vitest(엔진 + store) |
| `lint` | ESLint(신규, 경량) |
| `verify` | typecheck + lint + test + build (품질 게이트) |
| `dist` | `verify` 후 electron-builder 현재 OS 패키징 |
| `dist:all` | 3-OS 패키징(CI에서 매트릭스로 분산) |

## 10. 결정 로그

- **Electron 채택**(사용자 결정): 플랫폼 간 Canvas 렌더 일관성 + 성숙한 생태계.
- **3-OS 타깃**(사용자 결정): macOS+Windows+Linux 매트릭스.
- **미서명 아티팩트**: 코드서명은 시크릿 주입 지점만 마련, 실제 서명은 후속.
- **localStorage 폴백 유지**: 웹/데스크탑 단일 코드베이스 확보.
