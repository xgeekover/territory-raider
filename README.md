# Territory Raider

**한국어** · [English](./docs/README.en.md)

**🎮 [브라우저에서 바로 플레이](https://xgeekover.github.io/territory-raider/)** — 설치 없이 링크 하나로 실행됩니다. 데스크톱 설치본은 [Releases](https://github.com/xgeekover/territory-raider/releases)에서.

Volfied/Qix 스타일의 **땅따먹기(영역 점유)** 게임입니다. **React 18 + TypeScript(strict) + Canvas 2D**만으로 만들었고 게임 엔진 라이브러리는 쓰지 않았습니다. 어둠 속으로 선을 그어 보스를 가두고, 필드의 80%를 점유하세요. 스테이지는 무한히 이어지며 **5스테이지마다 보스전**이 벌어집니다.

이름·아트·사운드는 모두 오리지널이며, 장르 메커니즘만 빌려왔습니다. 모든 비주얼은 다크 zinc/slate 팔레트 위에 시안/푸크시아 네온 악센트로 코드가 직접 그립니다.

![Territory Raider 게임플레이](docs/gameplay.gif)

*불 테마 스테이지: 바위 지형을 피해 영역을 점유하다가, 화염 패치에 닿는 순간 **긋던 절개선이 통째로 타버립니다**. 이어서 **TIME**이 앰버(20초) → 레드(10초)로 바뀌며 적들이 빨라집니다.*

## 빠른 시작

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 헤드리스 엔진 단위 테스트 (Vitest)
npm run build      # tsc --noEmit + 프로덕션 빌드
npm run typecheck  # tsc --noEmit만
```

## 데스크톱 앱 (Electron)

같은 게임이 얇고 보안-강화된 Electron 셸을 통해 네이티브 데스크톱 앱(macOS · Windows · Linux)으로도 제공됩니다. 웹 빌드는 그대로 두고 — 렌더러는 순수 Vite 앱 그대로 — `electron/`(main + preload)과 `scripts/`만 추가됩니다.

```bash
npm run dev:desktop   # Electron + Vite HMR
npm run verify        # 게이트: typecheck · lint · test · build:desktop
npm run dist          # 현재 OS용 패키징 → release/
npm run dist:mac      # dmg(설치본) + zip(무설치본), x64 + arm64
npm run dist:win      # NSIS(설치본) + 포터블 단일 exe, x64
npm run dist:linux    # deb(설치본) + AppImage(무설치본), x64
```

모든 플랫폼에 **설치본과 무설치(포터블) 빌드가 함께** 제공됩니다:

| OS | 설치본 | 무설치본 |
|---|---|---|
| **macOS** | `.dmg` (x64 + arm64) | `.zip` (압축 해제 → `.app` 실행) |
| **Windows** | `.exe` NSIS 설치 마법사 | 포터블 `.exe` (더블클릭, 설치 불필요) |
| **Linux** | `.deb` | `.AppImage` (chmod +x → 실행) |

크로스-OS 패키징은 CI가 담당합니다: `vX.Y.Z` 태그를 푸시하면
[`.github/workflows/release.yml`](./.github/workflows/release.yml)이 macOS/Windows/Linux
네이티브 러너에서 6종 아티팩트를 모두 빌드해 드래프트 GitHub Release에 첨부합니다.
현재 빌드는 **미서명**입니다(macOS Gatekeeper / Windows SmartScreen 경고 발생 —
macOS는 우클릭 → 열기, Windows는 "추가 정보 → 실행"). 코드 서명은 인증서 확보 후
시크릿으로 붙이는 후속 단계입니다.

> allow-scripts 샌드박스 환경에서 `npm install`이 Electron 바이너리 다운로드를 건너뛰면
> `node node_modules/electron/install.js`를 한 번 실행해 주세요.

## 이펙트 & 사운드 (juice 레이어)

모든 피드백은 에셋 없이 코드로 생성되며, 엔진은 건드리지 않고 그 위에 얹혀 있습니다:

- **신스 오디오** (`src/ui/fx/audio.ts`) — 점유·아이템·레이저·사망·스파크·스테이지
  클리어·보스 킬에 WebAudio 오실레이터 효과음, 플레이 중에는 낮은 앰비언트 패드.
  `M`으로 음소거, 설정은 저장됩니다.
- **캔버스 이펙트** (`src/ui/fx/fx.ts`) — 파티클 버스트, 떠오르는 `+점수` 팝업, 전장
  플래시, 화면 흔들림, 그리고 그리는 동안 고동치는 위험 비네트(스파크가 트레일을
  추적 중이면 로즈색으로 변함).
- **상태 워처** (`src/ui/fx/watcher.ts`) — 매 프레임 엔진 상태를 diff해 위 효과를
  전부 파생시킵니다. 엔진은 이벤트를 발행하지 않고 테스트도 그대로입니다.
- **UI 폴리시** — 스테이지별 코드네임 인트로 배너, 80% 목표 눈금이 있는 점유
  진행 바, 점수 팝 애니메이션, 마지막 목숨 경고 펄스, 기록/클리어/승리 시 CSS
  콘페티, 애니메이션 타이틀 그리드, 창 포커스를 잃으면 자동 일시정지.

앱 아이콘(`build/icon.*`)도 게임의 비주얼 언어로 프로그램이 그립니다 — `npm run icon`으로 재생성.

## 조작법

| 키 | 동작 |
|---|---|
| **방향키** | 점유 경계선을 따라 이동 (실드 모드) |
| **Space (누르고 있기)** | 미점유 공간으로 트레일 긋기 (드로잉 모드) |
| **X** | 레이저 발사 (실드 모드, `L` 아이템 필요) |
| **P** | 일시정지 / 재개 |
| **M** | 사운드 토글 (저장됨) |
| **Enter** | 시작 · 스테이지 클리어 후 진행 · 재시작 |

## 게임 규칙

- 처음에는 **실드 상태**로 경계 셀(어둠과 맞닿은 점유/보더 셀) 위만 걷습니다. 실드 상태에서는 무적입니다.
- **Space**를 누른 채 어둠으로 들어가면 **트레일**을 긋기 시작합니다. 점유 지역으로 되돌아와 고리를 닫으면 둘러싼 영역이 점유됩니다.
- 점유는 **보스 기준 플러드필**로 판정합니다: 보스가 갇히지 *않은* 쪽은 어둠으로 남고 나머지가 전부 당신 것이 됩니다. 안에 갇힌 미니언은 함정 보너스와 함께 소멸합니다.
- 그리는 동안은 무방비 상태 — 적과 닿거나 **스파크**가 트레일을 타고 올라오면 목숨을 잃습니다.
- 아이템 타일을 영역 안에 가두면 획득: **T** 시간정지, **S** 속도, **L** 레이저 충전, **P** 점수, **C** 미니언 일소.
- **바위 지형.** 2스테이지부터 필드에 암석 클러스터가 깔립니다 — 절개선이 막히고, 적탄도 바위에 막히니 지형을 엄폐물로 쓰세요. 바위는 점유되지 않으며 80% 목표 계산에서 제외됩니다.
- **원소 테마 (10스테이지 블록마다 순환).** 11스테이지부터 블록마다 테마가 바뀌며(불 → 얼음 → 번개) 필드에 해저드 패치가 깔리고 **배경 음악도 테마별로 변주**됩니다(불: 어두운 D단조 소톱 베이스, 얼음: 느리고 유리 같은 C장조, 번개: 급박한 E단조). 그리는 중에 밟으면 —
  - **불 🔥**: 긋던 절개선이 통째로 타버리고 시작점으로 복귀. 불은 절대 뚫을 수 없으니 감싸서 정화하세요.
  - **얼음 ❄**: 3초간 이동속도 절반 + **얼음 위에서는 미끄러집니다** — 진행 방향으로 저절로 계속 나아가며, 막혔을 때만 방향키로 조향할 수 있습니다.
  - **번개 ⚡**: 1초간 완전 정지 — 하지만 번개가 **주변 미니언에게 체인**되어 그들을 2.5초간 감전 정지시킵니다. 추격당할 때 일부러 밟는 역이용 플레이도 가능합니다.
  - 해저드가 깔린 땅을 영역으로 감싸면 정화되어 사라집니다.
- **시계와 싸우세요.** 스테이지의 목숨 하나마다 **60초 타이머**가 돕니다. 시간이 줄수록 적이 빨라지고 — **20초 이하 +25%, 10초 이하 +50%** — HUD의 `TIME` 게이지가 시안 → 앰버 → 레드로 경고합니다. 0이 되면 목숨을 하나 잃고(그리던 트레일은 롤백) 새 목숨과 함께 시계가 리필됩니다.
- **코어는 반격합니다** — **5스테이지마다**(5, 10, …) 보스전: 보스가 쿨다운마다 조준 탄을 쏘고 *점유율이 오를수록 분노합니다*(40% 초과 시 연사, 65% 초과 시 3발 부채꼴). 탄은 점유 지역에 닿으면 무해하게 소멸하고(영토가 엄폐물) 그리는 중에만 위협적입니다. 다른 스테이지에서 보스는 배회만 합니다. 난이도는 스테이지마다 상승합니다.
- **80%**를 점유하면 클리어. 레이저로 보스를 잡으면 필드 전체를 즉시 합병하고 큰 보너스를 받습니다.

## 아키텍처

엔진은 **React/DOM 의존성이 전혀 없는 순수 TypeScript 모듈**이라 Vitest에서 헤드리스로 돌아갑니다. React는 불변 HUD 스냅샷만 구독하며, 프레임 단위 게임 상태를 들고 있지 않습니다.

```
                       ┌─────────────────────────────────────────┐
                       │            engine (pure TS)              │
                       │                                          │
  InputState  ───────▶ │  tick(input, dt)                         │
  (누른 키)             │    movement → claim → laser              │
                       │    → enemies → spark → collision → death │
                       │                                          │
  EngineAction ──────▶ │  dispatch(action)   (Enter/P/X)          │
                       │                                          │
                       │  GameState  (grid Uint8Array, player,    │
                       │   boss, minions, sparks, lasers, items)  │
                       │                                          │
                       │  subscribe / getSnapshot  ◀── HUD 값이   │
                       │       바뀔 때만 발행                      │
                       └───────┬───────────────────────┬──────────┘
                               │ getState()            │ getSnapshot()
                               ▼ (라이브, 렌더용)        ▼ (useSyncExternalStore)
                    ┌──────────────────────┐   ┌────────────────────────┐
                    │  renderer (Canvas 2D)│   │  React HUD / 화면들     │
                    │  정적 레이어:          │   │  Hud, Title, Pause,    │
                    │   트레일 커밋 시에만    │   │  StageClear, GameOver  │
                    │   다시 그림            │   │  (값이 바뀔 때만        │
                    │  동적 레이어:          │   │   리렌더, 프레임 아님)   │
                    │   매 프레임 그림        │   └────────────────────────┘
                    └──────────────────────┘
                               ▲
                    requestAnimationFrame + 60Hz 고정 타임스텝
                    누산기 (dt 클램프로 터널링 방지)
```

### 디렉토리 구조

```
src/
  engine/
    core/      types.ts · grid.ts · gameState.ts · rng.ts
    systems/   movement.ts · claim.ts · enemies.ts · spark.ts
               items.ts · laser.ts · collision.ts · scoring.ts · bossAttack.ts
    config/    constants.ts · stages.ts
    index.ts   createEngine(): { tick, dispatch, subscribe, getSnapshot, getState }
  ui/
    components/ GameCanvas · Hud · TitleScreen · PauseOverlay
                StageClearScreen · GameOverScreen · VictoryScreen
    hooks/      useGameEngine · useKeyboard · useRafLoop
    render/     renderer.ts · perf.ts
    fx/         audio.ts · fx.ts · watcher.ts
  App.tsx · main.tsx
electron/       main.ts · preload.ts (보안-강화 셸)
tests/          엔진 + electron 단위 테스트 (헤드리스, DOM 없음)
```

### 지켜지는 설계 규칙

- **상태는 엔진이 소유하고 React 밖에 둡니다.** `useSyncExternalStore`는 엔진이 *값이 바뀔 때만* 재발행하는 HUD 스냅샷을 읽으므로 HUD 컴포넌트가 프레임마다 리렌더되지 않습니다.
- **고정 타임스텝.** `requestAnimationFrame`이 60Hz 누산기를 구동하고 프레임 델타는 클램프(`MAX_FRAME_DT`)되어, 숨겨졌던 탭에서 돌아와도 엔티티가 벽을 뚫지 못합니다. `setInterval`은 쓰지 않습니다.
- **2-레이어 렌더링.** 그리드(점유/미점유/보더)는 오프스크린 캔버스에 래스터화해 **트레일 커밋 시에만** 다시 그리고(`gridVersion`으로 추적), 매 프레임은 그 레이어를 한 번 블릿한 뒤 움직이는 엔티티만 위에 그립니다.
- **O(1) 충돌.** 모든 히트 판정은 셀 인덱스 기반이거나 적 하나당 거리 검사입니다 — O(n²) 엔티티 스캔이 없습니다.
- **SOLID.** `systems/*` 파일은 각각 하나의 책임만 갖고, 엔진 코어는 렌더러를 임포트하지 않습니다. 적 행동은 종류별 테이블이라 새 적 타입은 상태 변형 하나 + 엔트리 하나면 됩니다(OCP).
- **`strict: true`, `any` 금지, 매직 넘버 금지** — 모든 튜닝 값은 `engine/config/constants.ts`, 스테이지별 난이도는 `stages.ts`에 있습니다.

### 점유 알고리즘 (`systems/claim.ts`)

커밋 시: 트레일 → 점유로 전환; 보스가 있는 셀에서 미점유 셀들을 플러드필; 필이 *닿지 못한* 미점유 셀을 전부 점유로 바꿉니다. 슬리버(평행 트레일이 남긴 1셀 틈)는 플러드필에서 자연히 걸러지므로 특수 처리 코드가 없습니다. 보스가 이미 죽었으면 시드가 없으니 필드 전체가 점유되고 스테이지가 클리어됩니다.

## 성능

- 목표는 안정적인 **60 fps**. `npm run dev`에서는 구석 오버레이가 실시간 FPS와 누적 **정적 레이어 다시 그리기 횟수**를 보여줍니다 — 이 횟수는 프레임 수가 아니라 트레일 커밋 수를 따라가야 하며, 그것이 2-레이어 캐시가 동작한다는 증거입니다.
- 고정 타임스텝 루프가 시뮬레이션과 프레임률을 분리하므로 렌더링이 잠시 처져도 물리는 안정적입니다.

## 테스트

116개의 헤드리스 엔진 테스트가 스펙의 핵심 경로를 커버합니다: 플러드필 점유(보스 양쪽 케이스, 1셀 슬리버, 보스 사망 시 전체 점유, 80% 초과 보너스), 트레일 규칙(자가 교차/역주행 차단, 커밋 전환), 적 이동과 가둠, 충돌과 사망 롤백(점유율 불변), 스파크 경로 추적, 레이저 히트와 보스 킬 클리어, 아이템 1회 획득, 보스전 탄막/분노, **스테이지 시계**(플레이 중 감소, 일시정지 시 정지, 타임아웃 → 목숨 차감 + 시계 리필)와 20초/10초 임계값의 **적 가속 램프**, 엔진 라이프사이클(타이틀/일시정지/스테이지 승계/승리 + 값 변경 시에만 스냅샷 발행).

```bash
npm test
```
