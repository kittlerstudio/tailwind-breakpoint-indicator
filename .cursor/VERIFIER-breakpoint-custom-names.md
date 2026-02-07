# Verifier: Změny pro custom breakpoint názvy

## Verdict: ✅ Implementováno dle researchu

## Shrnutí problému
- **3xl** se detekuje (proměnná `--breakpoint-3xl` je v `:root`)
- **desktop** se nedetekuje – Tailwind v4 pro custom názvy **neemituje** `--breakpoint-desktop` do `:root`, ale inline hodnotu do `@media (width >= X) { .desktop\:flex { ... } }`

## Provedené změny

### 1. Nová funkce `parseBreakpointsFromMediaQueries(text, into)`
- Hledá bloky `@media (width >= X)` nebo `@media (min-width: X)`
- Z obsahu bloku extrahuje selektory typu `.desktop\:flex` (Tailwind escaping)
- Regex: `\.([a-zA-Z0-9_-]+)\\.:` pro variant prefix před `\:`
- Páruje název (desktop) s hodnotou (80rem) z media query
- Doplňuje do výsledku jen pokud klíč ještě neexistuje (priorita má `--breakpoint-*`)

### 2. Volání v obou parsing cestách
- V `fetchBreakpointsFromLinks` → `parseText()` volá `parseBreakpointsFromMediaQueries` po parsování `--breakpoint-*`
- V `getBreakpointsFromCss` → `parseCssText()` stejně

### 3. Research dokument
- `.cursor/RESEARCH-breakpoint-custom-names.md` – záznam analýzy a hypotéz

## Rizika
- **Kolize s container queries**: `@container (width >= X)` by mohl být chybně interpretován – náš regex vyžaduje `@media`, takže by neměl
- **Minifikace**: V minifikovaném CSS může být jiné formátování; regex používá volné `\s*` pro mezeru
- **Různé formáty**: Některé buildy mohou používat `min-width` místo `width >=` – obojí je podporováno

## Co ověřit ve Vue projektu
1. Zda se `desktop` (nebo jiný custom breakpoint) zobrazí v indikátoru
2. Zda používáš alespoň jednu třídu s daným prefixem (např. `desktop:flex`), aby Tailwind vygeneroval odpovídající CSS
