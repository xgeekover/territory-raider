# Reference — Advanced i18n (ICU / react-i18next)

Loaded on demand when a UI project **outgrows the type-safe core** in `SKILL.md`. The hand-rolled
`ko.ts`/`en.ts` pattern is perfect for small/medium apps: zero deps, full TypeScript completeness
checking. Reach for this only when you actually need one of:

- **Pluralization** — "1 item" vs "2 items" (and languages with more than two plural forms).
- **Interpolation with formatting** — "Welcome, {name}", "{count, number}", "{price, number, ::currency/KRW}".
- **Select / gender** — branching on a variable ("{gender, select, …}").
- **Locale-aware dates/numbers** — via the Intl API under the hood.

> Korean has **one** plural form (`other`) — nouns don't inflect for number — while English has
> `one`/`other`. ICU plural rules handle this per-locale automatically, which is exactly why you stop
> hand-writing string variants once counts enter the picture.

---

## Install (Vite + pnpm)
```bash
pnpm add i18next react-i18next i18next-icu intl-messageformat
# optional: language detection + lazy loading of translation bundles
pnpm add i18next-browser-languagedetector i18next-http-backend
```

## Setup
```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import LanguageDetector from 'i18next-browser-languagedetector';

import ko from './locales/ko.json';
import en from './locales/en.json';

i18n
  .use(ICU)                  // enables ICU MessageFormat (plural/select/number/date)
  .use(LanguageDetector)     // reads localStorage → navigator; key below
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    fallbackLng: 'ko',       // Korean default, matching the project convention
    supportedLngs: ['ko', 'en'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: { lookupLocalStorage: 'app-lang', caches: ['localStorage'] },
  });

export default i18n;
```
```tsx
// src/main.tsx — import once, before rendering
import './i18n/config';
```

## Translation files (ICU syntax)
```jsonc
// src/i18n/locales/en.json
{
  "cart": {
    "items": "{count, plural, one {# item} other {# items}}",
    "total": "Total: {amount, number, ::currency/USD}",
    "greeting": "Welcome, {name}!",
    "lastSeen": "Last seen {when, date, medium}"
  }
}
```
```jsonc
// src/i18n/locales/ko.json  — Korean has only the `other` plural form
{
  "cart": {
    "items": "{count, plural, other {상품 #개}}",
    "total": "합계: {amount, number, ::currency/KRW}",
    "greeting": "{name}님, 환영합니다!",
    "lastSeen": "마지막 접속 {when, date, medium}"
  }
}
```

## Usage
```tsx
import { useTranslation } from 'react-i18next';

function Cart({ count, amount, name }: { count: number; amount: number; name: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div>
      <p>{t('cart.greeting', { name })}</p>
      <p>{t('cart.items', { count })}</p>     {/* 0/1/2 → correct plural per locale */}
      <p>{t('cart.total', { amount })}</p>     {/* ₩ or $ formatting via Intl */}
      <button onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}>
        {i18n.language === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English'}
      </button>
    </div>
  );
}
```

## Type safety (keep the compiler on your side)
react-i18next can type-check keys against your JSON, restoring the safety you'd lose vs. the
type-safe core:
```typescript
// src/@types/i18next.d.ts
import 'i18next';
import type en from '../i18n/locales/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
```
Now `t('cart.itmes')` is a compile error, and key autocomplete works in the editor.

---

## Choosing between the two approaches

| | Type-safe core (`SKILL.md`) | ICU / react-i18next (this file) |
|---|---|---|
| Dependencies | none | i18next + react-i18next + i18next-icu |
| Plural / gender / number / date | ✗ (hand-written) | ✓ (ICU + Intl) |
| Lazy-loaded bundles, detection | ✗ | ✓ |
| Key completeness check | ✓ (TS `satisfies Locale`) | ✓ (via `i18next.d.ts`) |
| Best for | small/medium apps, fixed strings | apps with counts, currency, dates, many locales |

**Migration path:** start with the type-safe core; when the first `{count, plural, …}` need appears,
move the strings into JSON and switch the provider. Components keep calling a `t(...)`-style API, so
the blast radius is the config + the string files, not the whole component tree.

> **Don't translate** (same rule as the core): educational/domain content, proper nouns/brand names,
> and code values/enums stay as-is.
