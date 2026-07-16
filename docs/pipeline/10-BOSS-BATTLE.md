# ⑩ 보스전 확장 — "The Core fights back"

> 첫 **엔진 확장** 이터레이션(이전 ⑨까지는 UI 레이어만). 설계→구현→테스트→연출 순으로 진행.
> 결과: 96 tests(기존 84 + 신규 12) 그린, verify·스모크 통과.

## 1. 디자인 결정

핵심 질문: *땅따먹기 장르에서 "보스전"은 무엇이어야 하는가?*

→ **점령이 곧 도발**: 보스는 쿨다운마다 플레이어 조준 탄환을 쏘고, **점령률이 오를수록 격노**한다.
이기고 있다는 사실 자체가 위협이 되므로 장르의 핵심 긴장(위험을 감수한 확장)과 정합.

| 단계 | 트리거 | 효과 |
|---|---|---|
| rage 0 | <40% | 단발 조준탄, 기본 쿨다운(스테이지별 3.4→2.0s) |
| rage 1 | ≥40% | 쿨다운 ×0.62 + HUD RAGE(orange) + 로어 연출 |
| rage 2 | ≥65% | 쿨다운 ×0.42 + **3-way 부채꼴** + FURY(rose) + 외곽 역회전 링 |

**공정성 규칙** (기존 게임 계약 유지):
- 탄환은 미점령 공간 전용 — 점령/경계 셀에서 스플래시 소멸 → *점령지가 엄폐물*이라는 전술 생성
- 드로잉 중에만 피격(실드 성역 불변), 리스폰 무적 존중
- Time Stop이 발사·비행 동결, 사망 시 탄환 클리어 + 발사 유예
- 스테이지 진입 직후 발사 없음(첫 발리는 한 쿨다운 후)

## 2. 구현 (engine — 이번엔 엔진 수정)

| 파일 | 변경 |
|---|---|
| `types.ts` | `BossProjectile`, `BossState.fireCooldown`, `StageConfig.bossFireCooldown?/projectileSpeed?`, 스냅샷 `bossHpMax/bossRage` |
| `constants.ts` | `BOSS_FIRE_COOLDOWN`·`BOSS_RAGE*`·`PROJECTILE_*` 7종 |
| `systems/bossAttack.ts` | **신규** — `bossRageLevel()`, `updateBossAttack()` (발사·비행·스플래시·피격) |
| `index.ts` | Time-Stop 게이트 안에 `updateBossAttack` 통합, 스냅샷 필드 추가 |
| `collision.ts` | `applyDeath`: 탄환 클리어 + 발사 유예 |
| `stages.ts` | 8스테이지 발리 쿨다운/탄속 난이도 곡선 |

결정성 유지: 조준각은 순수 기하(rng 미사용) — 테스트 재현성 보장.

## 3. 테스트 (12 신규, `tests/engine/bossattack.test.ts`)

격노 티어 임계값 · 쿨다운 후 조준 발사(속도 벡터 방향 검증) · 사망 보스 발사 금지 ·
rage2 3연발 · rage 쿨다운 단축 · 비행 적분 · 경계 스플래시 · 드로잉 피격(+탄환 소멸) ·
실드 면역 · 무적 면역 · 사망 클린업/유예 · **엔진 게이트 통합**(Time Stop 동결→해동 발사).

교훈: 해동 검증을 0.5초 뒤에 하면 탄환이 이미 경계에 스플래시해 소멸 — 발사 직후(3틱)로 검사 이동.

## 4. 연출

- **렌더러**: 탄환(로즈 오브+모션 테일+백색 코어), 보스 rage별 링 색(fuchsia→orange→rose)·회전 가속·FURY 외곽 역회전 링
- **HUD**: `CORE ■■■` HP 핍(레이저 명중 시 감소 시각화), rage별 라벨·색, FURY 펄스
- **워처/사운드**: 발사 pew · 명중 히트음+`CORE 2/3` 팝업 · 격노 로어+"THE CORE AWAKENS"/"CORE FURY" 팝업+플래시+셰이크 · 스플래시 스파클(탄환 소멸 위치 추적 — id 기반 diff)

## 5. 검증

- `npm run verify` ✅ (typecheck·lint·96 tests·build)
- 패키지드/dev 부팅 스모크 ✅
- 시각: 탄환 조준 비행 + CORE 바 스크린샷 확인 ✅

---

## 6. 확장: 캠페인 스테이지 + 보스전 5주기 (현재 STAGE_COUNT=30)

**요구**: 스테이지 추가 · 보스전은 5스테이지마다 · 진행할수록 난이도 상승.

**설계**: 보스는 flood-fill 기준점이라 모든 스테이지에 존재. "보스전"(탄막+격노)만
`StageConfig.bossBattle`로 게이팅 → **5·10·15·20**에서만 발동. 일반 스테이지의 보스는
배회+접촉 위협만(원작 동작). 이로써 보스 스테이지가 특별한 클라이맥스로 느껴진다.

**생성 방식** (`config/stages.ts`): 8개 수작업 배열 → **인덱스 함수 기반 생성기**(`STAGE_COUNT` 한 줄로 조절).
현재 30 스테이지(보스전 6회). 모든 파라미터가 i에 대해 단조 비감소이며, 엔티티 수(hp≤12·와일더≤10·크롤러≤6)는
가독성을 위해 상한이 있으나 **보스/스파크/탄속은 30스테이지까지 계속 상승**(보스속도 18.5→24, 탄속 21.5→26.5,
쿨다운 하한 1.2s)해 후반 난이도를 유지. 보스 스테이지는 추가 화력 스케일.

| 게이팅 지점 | 변경 |
|---|---|
| `bossAttack.ts` | `updateBossAttack`/`bossRageLevel`가 `stage.bossBattle` 확인 |
| `stages.ts` | `makeStage(i)` 생성기 + `isBossStage`/`STAGE_COUNT`/`BOSS_STAGE_INTERVAL` export |
| `StageBanner` | 20종 이름 + 보스 스테이지 "⚠ CORE ASSAULT ⚠" 적색 배너 |
| `VictoryScreen` | `ALL {STAGE_COUNT} STAGES`로 동적화 |
| `useGameEngine` | **DEV 전용** `?stage=N` 스테이지 셀렉트(긴 캠페인 QA용, 프로덕션 제거) |
| 엔진 | `StateOptions.startPlaying`(타이틀 건너뛰기 — 테스트/DEV 셀렉트) |

**신규 테스트** (`stages.test.ts`, 6): 스테이지 수·보스 5주기·L 아이템 상시·단조 난이도·
보스 심화(쿨다운↓/탄속↑)·최종 보스 스테이지. 기존 `engine.test.ts`의 "8 스테이지/고유색"
단정은 새 캠페인(생성기, 보스 공통색)에 맞게 갱신.

**검증**: `npm run verify` ✅ (102 tests) · 부팅 스모크 ✅ · 스테이지 5/15 보스 배너 스크린샷 확인 ✅.
