# Research: Custom Breakpoint Names (desktop, small) Not Detected in Vue

## 1. Problem Framing

**Hlavní zjištění uživatele:** Fetch funguje (breakpoint-3xl se zachytí). Problém NENÍ v načítání CSS. Problém je, že **custom názvy** jako `desktop`, `small`, `verybig` se nezaznamenají, zatímco `3xl` ano.

**Hypotéza:** Tailwind v4 může vygenerovat proměnné `--breakpoint-*` odlišně pro:
- **Rozšíření defaultu** (xs, 3xl) → emituje se do `:root`
- **Čistě custom breakpointy** (desktop, small) → hodnota se **inline** do `@media`, proměnná **není** v `:root`

## 2. Findings

### 2.1 Tailwind v4 výstup
- Default theme (sm, md, lg, xl, 2xl) je vždy v outputu jako `--breakpoint-sm: 40rem` v `:root` (Radu.link, Tailwind docs)
- Custom breakpointy přes `@theme { --breakpoint-desktop: 80rem }` – **nejasné**, zda se proměnná emituje do `:root`
- `@media` a `@container` v CSS **nepodporují CSS proměnné** – Tailwind musí hodnoty **inline** do media queries (GitHub Discussion #17597)
- Custom breakpointy generují třídy typu `.desktop\:flex` uvnitř `@media (width >= 80rem) { ... }`

### 2.2 Důsledek
Pokud Tailwind pro custom breakpointy **neemituje** `--breakpoint-desktop` do `:root`, ale pouze:
```css
@media (width >= 80rem) {
  .desktop\:flex { display: flex; }
  .desktop\:grid { ... }
}
```
pak náš regex `--breakpoint-([a-zA-Z0-9_-]+)\s*:` v takovém CSS **nic nenajde** – není tam žádná taková proměnná.

### 2.3 Proč 3xl funguje
- `3xl` je často používané rozšíření (známé jméno)
- Možná je v default theme variables reference
- Nebo Tailwind pro „standardní“ rozšíření (xs, 3xl) emituje proměnné, pro „volné“ názvy (desktop, small) nikoli

### 2.4 Řešení: Parsovat i `@media` + třídy
Přidat druhou fázi parsování:
1. Hledat `@media (width >= X)` nebo `@media (min-width: X)`
2. Uvnitř bloku hledat selektory typu `.(název)\:...` (escaped breakpoint prefix)
3. Spojit název (desktop, small) s hodnotou (80rem, 30rem)
4. Doplnit do výsledku

**Regex návrh:**
- Media: `@media\s*\(\s*width\s*>=\s*([^)]+)\)|@media\s*\(\s*min-width\s*:\s*([^)]+)\)`
- Selektor: `\.([a-zA-Z0-9_-]+)\\[`:]` (variant před dvojtečkou)
- Nutné spárovat media blok s obsahem (např. přes `\{[\s\S]*?\}`)

## 3. Recommendations

1. **Doplnit parsování z @media bloků** – hlavní doporučení
2. Zachovat stávající parsování `--breakpoint-*` – funguje pro default/rozšířené breakpointy
3. Merge: obě metody, výsledek spojit (bez duplicit)

## 4. Risks / Gotchas

- Regex na vnořené `@media` bloky může být křehký u složitějšího CSS
- Možné kolize názvů (např. container query `@sm` vs. breakpoint `sm`)
- Různé formáty: `min-width`, `width >=`, `width: 80rem` vs `80rem`

## 5. What to Ask Next

1. Může uživatel zkontrolovat v DevTools → Network → CSS soubor, jestli obsahuje `--breakpoint-desktop` nebo jen `@media` s `.desktop\:`?
2. Jak přesně má definovaný custom breakpoint v `@theme`?
