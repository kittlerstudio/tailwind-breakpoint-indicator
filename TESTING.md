# Testing Guide

Tento dokument popisuje různé způsoby testování balíčku před publikací na npm.

**⚠️ DŮLEŽITÉ:** HTML testovací soubory **NELZE** otevírat přímo přes `file:///` protokol. ES moduly vyžadují HTTP server kvůli CORS. Vždy používej `npm run test:server` pro lokální testování.

## 1. Build a základní kontrola

```bash
# Build projektu
npm run build

# Spustit test skript, který ověří build output
node test/test-build.js
```

Tento skript zkontroluje:
- ✅ Existence všech požadovaných souborů (index.js, index.esm.js, index.umd.js, index.d.ts, styles.css)
- ✅ Velikost souborů
- ✅ Existence source maps
- ✅ Správnost package.json exports

## 2. Lokální testování s HTML soubory

**⚠️ DŮLEŽITÉ:** HTML testovací soubory **NELZE** otevírat přímo přes `file:///` protokol, protože ES moduly vyžadují HTTP server kvůli CORS. Vždy používej vestavěný test server.

### Spuštění test serveru

```bash
# Spusť test server (automaticky zobrazí všechny dostupné testovací stránky)
npm run test:server
```

Server se spustí na `http://localhost:8000` a v terminálu uvidíš seznam všech dostupných testovacích stránek:

```
🚀 Test server running at http://localhost:8000

Available test pages:
  📄 http://localhost:8000/test/test-esm.html      - ES Module test
  📄 http://localhost:8000/test/test-umd.html     - UMD format test
  📄 http://localhost:8000/test/test-manual.html  - Manual initialization test
  📄 http://localhost:8000/example/index.html     - Example usage
```

### Testovací stránky

Otevři následující URL v prohlížeči:

- **ES Module test:** `http://localhost:8000/test/test-esm.html`
  - Testuje import ES modulu: `import { initBreakpointHelper } from '../dist/index.esm.js'`
  
- **UMD format test:** `http://localhost:8000/test/test-umd.html`
  - Testuje UMD formát pomocí `<script>` tagu
  
- **Manual initialization test:** `http://localhost:8000/test/test-manual.html`
  - Testuje manuální inicializaci s různými options
  
- **Example usage:** `http://localhost:8000/example/index.html`
  - Obecný příklad použití

**Poznámka:** Server automaticky servuje všechny potřebné soubory (JS, CSS) se správnými CORS hlavičkami pro ES moduly.

## 3. Testování pomocí npm link (doporučeno)

Toto je nejlepší způsob, jak otestovat balíček v reálném projektu:

### Krok 1: Vytvořit link v tomto projektu
```bash
cd /cesta/k/tool-tailwind-breakpoint-indicator
npm run build
npm link
```

### Krok 2: V jiném projektu použít link
```bash
cd /cesta/k/jinemu/projektu
npm link tailwind-breakpoint-indicator
```

### Krok 3: Použít v projektu
```javascript
// V main.js nebo podobném souboru
import 'tailwind-breakpoint-indicator/styles'
import 'tailwind-breakpoint-indicator'
```

### Krok 4: Po testování odlinkovat
```bash
# V testovacím projektu
npm unlink tailwind-breakpoint-indicator

# V projektu balíčku nic dalšího dělat nemusíš – „npm unlink“ se zde nespouští
```

## 4. Testování různých formátů

### ES Module (moderní projekty)
```javascript
import { initBreakpointHelper } from 'tailwind-breakpoint-indicator'
import 'tailwind-breakpoint-indicator/styles'
```

### CommonJS (Node.js)
```javascript
const { initBreakpointHelper } = require('tailwind-breakpoint-indicator')
require('tailwind-breakpoint-indicator/styles')
```

### UMD (script tag)
```html
<link rel="stylesheet" href="node_modules/tailwind-breakpoint-indicator/dist/styles.css">
<script src="node_modules/tailwind-breakpoint-indicator/dist/index.umd.js"></script>
<script>
  TailwindBreakpointIndicator.initBreakpointHelper()
</script>
```

## 5. Testování v různých bundlerech

### Vite
```bash
# Vytvořit testovací Vite projekt
npm create vite@latest test-vite -- --template vanilla
cd test-vite
npm install
npm link tailwind-breakpoint-indicator

# V main.js
import 'tailwind-breakpoint-indicator/styles'
import 'tailwind-breakpoint-indicator'
```

### Webpack
```bash
# Vytvořit testovací Webpack projekt
# (použijte vlastní setup nebo create-react-app)
npm link tailwind-breakpoint-indicator
```

## 6. Ověření TypeScript typů

```bash
# V TypeScript projektu
npm link tailwind-breakpoint-indicator

# V .ts souboru
import { initBreakpointHelper, BreakpointHelperOptions } from 'tailwind-breakpoint-indicator'
import 'tailwind-breakpoint-indicator/styles'

const options: BreakpointHelperOptions = {
  enabled: true,
  hideDuration: 30000
}

initBreakpointHelper(options)
```

TypeScript by měl správně rozpoznat typy bez chyb.

## 7. Kontrola před publikací

Před `npm publish` zkontrolujte:

- [x] `npm run build` proběhne bez chyb
- [x] `node test/test-build.js` projde všechny testy
- [x] Testovací HTML soubory fungují v prohlížeči
- [x] `npm link` funguje v testovacím projektu
- [x] TypeScript typy jsou správné
- [x] README.md obsahuje správné instrukce
- [x] package.json má správnou verzi
- [x] LICENSE soubor existuje
- [x] .npmignore obsahuje správné soubory

## 8. Dry-run publikace

```bash
# Ověřit, co by se publikovalo (bez skutečné publikace)
npm pack --dry-run

# Nebo vytvořit .tgz soubor pro kontrolu
npm pack
# Otevře se .tgz soubor, který můžete zkontrolovat
```

## 9. Testování v produkčním módu

Ověřte, že helper se **nezobrazuje** v produkčním módu:

```bash
# V projektu s Vite
NODE_ENV=production npm run build
# nebo
npm run build -- --mode production

# Helper by se neměl zobrazit
```

## Checklist před publikací

### Jak ověřit každý bod:

#### ✅ Build proběhne bez chyb
```bash
npm run build
# Mělo by proběhnout bez chyb a varování
```

#### ✅ Všechny formáty (ESM, CJS, UMD) fungují
```bash
# 1. Spusť test server
npm run test:server

# 2. Otevři v prohlížeči:
# - http://localhost:8000/test/test-esm.html (ES Module)
# - http://localhost:8000/test/test-umd.html (UMD format)
# - http://localhost:8000/example/index.html (obecný test)

# 3. Ověř, že helper se zobrazuje na všech stránkách
```

**Alternativně pomocí npm link:**
```bash
# V tomto projektu
npm run build
npm link

# V testovacím projektu
npm link tailwind-breakpoint-indicator

# Testuj různé importy:
# import 'tailwind-breakpoint-indicator' (ESM)
# require('tailwind-breakpoint-indicator') (CJS)
```

#### ✅ CSS se správně importuje
```bash
# 1. Spusť test server
npm run test:server

# 2. Otevři http://localhost:8000/test/test-esm.html
# 3. Zkontroluj v DevTools (F12):
#    - Network tab → měl by být načten styles.css
#    - Elements tab → helper element by měl mít správné CSS třídy
#    - Helper by měl mít správnou barvu podle breakpointu
```

**V kódu:**
```javascript
import 'tailwind-breakpoint-indicator/styles' // CSS se načte
import 'tailwind-breakpoint-indicator' // JS se načte
```

#### ✅ TypeScript typy jsou k dispozici
```bash
# 1. Vytvoř testovací TypeScript soubor test-types.ts:
cat > test-types.ts << 'EOF'
import { initBreakpointHelper, BreakpointHelperOptions } from './dist/index.esm.js'

const options: BreakpointHelperOptions = {
  enabled: true,
  hideDuration: 30000
}

initBreakpointHelper(options)
EOF

# 2. Zkontroluj typy
npx tsc --noEmit test-types.ts

# 3. Mělo by proběhnout bez chyb
# 4. Smaž test soubor
rm test-types.ts
```

**Nebo v IDE:**
- Otevři `src/index.ts` nebo `dist/index.d.ts`
- Zkontroluj, že IntelliSense nabízí `initBreakpointHelper` a `BreakpointHelperOptions`
- Zkontroluj, že autocomplete funguje

#### ✅ Auto-inicializace funguje v dev módu
```bash
# 1. Spusť test server
npm run test:server

# 2. Otevři http://localhost:8000/example/index.html
# 3. Helper by se měl automaticky zobrazit (bez manuálního volání initBreakpointHelper)
# 4. Zkontroluj v konzoli - neměly by být žádné chyby
```

**V kódu:**
```javascript
// Stačí importovat - helper se inicializuje automaticky
import 'tailwind-breakpoint-indicator/styles'
import 'tailwind-breakpoint-indicator'
```

#### ✅ Helper se nezobrazuje v produkčním módu
```bash
# V testovacím projektu s Vite:
NODE_ENV=production npm run build
# nebo
npm run build -- --mode production

# Spusť produkční build a ověř, že helper se NEzobrazuje
```

**Nebo v kódu:**
```javascript
// V produkčním buildu (NODE_ENV=production)
import 'tailwind-breakpoint-indicator/styles'
import 'tailwind-breakpoint-indicator'
// Helper by se neměl zobrazit
```

#### ✅ Hide button funguje správně
```bash
# 1. Spusť test server
npm run test:server

# 2. Otevři http://localhost:8000/example/index.html
# 3. Klikni na tlačítko s hodinami (hide button) v helperu
# 4. Helper by se měl skrýt
# 5. Po 20 sekundách by se měl automaticky zobrazit znovu
```

#### ✅ Breakpointy se správně zobrazují při resize
```bash
# 1. Spusť test server
npm run test:server

# 2. Otevři http://localhost:8000/example/index.html
# 3. Změň šířku okna prohlížeče (nebo použij DevTools responsive mode)
# 4. Ověř, že:
#    - < 640px: base (červená)
#    - ≥ 640px: sm (zelená)
#    - ≥ 768px: md (modrá)
#    - ≥ 1024px: lg (žlutá)
#    - ≥ 1280px: xl (fialová)
#    - ≥ 1536px: 2xl (růžová)
# 5. Vždy by měl být vidět jen JEDEN breakpoint
```

#### ✅ README.md je aktuální
```bash
# Manuální kontrola:
# 1. Otevři README.md
# 2. Ověř, že:
#    - Instrukce pro instalaci jsou správné
#    - Příklady použití odpovídají aktuálnímu API
#    - Verze v příkladech odpovídá aktuální verzi
#    - Odkazy fungují
#    - Nejsou tam zastaralé informace
```

#### ✅ Verze v package.json je správná
```bash
# Zkontroluj package.json:
cat package.json | grep '"version"'

# Měla by být správná verze (např. "1.0.0" pro první release)
# Pokud publikuješ aktualizaci, zvyš verzi podle semver:
# - PATCH (1.0.0 → 1.0.1): bugfixy
# - MINOR (1.0.0 → 1.1.0): nové funkce (backward compatible)
# - MAJOR (1.0.0 → 2.0.0): breaking changes
```

#### ✅ `npm pack` vytvoří správný balíček
```bash
# 1. Vytvoř balíček
npm pack

# 2. Měl by se vytvořit soubor: tailwind-breakpoint-indicator-1.0.0.tgz

# 3. Zkontroluj obsah balíčku
tar -tzf tailwind-breakpoint-indicator-1.0.0.tgz | head -20

# 4. Měl by obsahovat:
#    - dist/ (všechny build soubory)
#    - README.md
#    - LICENSE
#    - package.json
#    - NEMĚL by obsahovat: src/, node_modules/, test/, .git/, atd.

# 5. Otestuj instalaci z balíčku
mkdir test-install
cd test-install
npm init -y
npm install ../tailwind-breakpoint-indicator-1.0.0.tgz
# Zkontroluj, že soubory jsou správně nainstalované

# 6. Smaž test soubory
cd ..
rm -rf test-install
rm tailwind-breakpoint-indicator-1.0.0.tgz
```

### Rychlý test všeho najednou:
```bash
# Spusť všechny automatické testy
npm run test

# Spusť build test
npm run test:build

# Spusť test server a manuálně otestuj v prohlížeči
npm run test:server
```

### Finální kontrola před `npm publish`:
```bash
# 1. Build
npm run build

# 2. Build test
npm run test:build

# 3. Vytvoř balíček a zkontroluj
npm pack

# 4. Dry-run publikace (ukáže, co by se publikovalo)
npm publish --dry-run

# 5. Pokud vše vypadá dobře, publikuj
# npm publish
```
