/** Breakpoint value in original form (e.g. "40rem", "1280px") */
export type BreakpointsMap = Record<string, string>

export interface ResolvedBreakpoint {
  name: string
  valuePx: number
  originalValue: string
}

export interface BreakpointHelperOptions {
  /**
   * Whether the helper is enabled. If not provided, will try to detect dev mode.
   * @default undefined (auto-detect)
   */
  enabled?: boolean

  /**
   * Duration in milliseconds to hide the helper when hide button is clicked.
   * @default 20000 (20 seconds)
   */
  hideDuration?: number

  /**
   * Custom container selector. If provided, will use existing element instead of creating one.
   * @default undefined (creates new element)
   */
  containerSelector?: string

  /**
   * Custom breakpoints (e.g. from tailwind.config.js theme.extend.screens).
   * If provided, overrides breakpoints read from CSS (Tailwind v4). Use for v3 or to override.
   * @example { xs: '30rem', '3xl': '120rem' }
   */
  breakpoints?: BreakpointsMap

  /**
   * Label for the "base" range (below first breakpoint). Use string to rename, or false to hide base row.
   * @default 'base'
   */
  baseLabel?: string | false
}

const DEFAULT_OPTIONS: Required<Omit<BreakpointHelperOptions, 'enabled' | 'containerSelector' | 'breakpoints' | 'baseLabel'>> = {
  hideDuration: 20000
}

/** Default Tailwind breakpoints (sm–2xl) when no CSS or options are used */
const DEFAULT_BREAKPOINTS: BreakpointsMap = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem'
}

/** Container background colors by breakpoint index (base, sm, md, …) */
const BREAKPOINT_COLORS = [
  '#ef4444', /* red - base */
  '#22c55e', /* green */
  '#3b82f6', /* blue */
  '#eab308', /* yellow */
  '#a855f7', /* purple */
  '#ec4899'  /* pink */
]

type HelperState = {
  resizeHandler?: () => void
  hideHandler?: () => void
  signature?: string
}

const HELPER_STATE = new WeakMap<HTMLElement, HelperState>()

function getRootFontSizePx(): number {
  if (typeof document === 'undefined') return 16
  const root = document.documentElement
  const computed = getComputedStyle(root).fontSize
  const parsed = parseFloat(computed)
  return Number.isNaN(parsed) ? 16 : parsed
}

/**
 * Try to resolve an arbitrary CSS length to pixels using layout measurement.
 * Used as a fallback for values like calc(), clamp(), vw, etc.
 */
function measureCssLengthPx(value: string): number {
  if (typeof document === 'undefined') return 0
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  el.style.top = '0'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  el.style.width = value
  el.style.height = '0'
  el.style.padding = '0'
  el.style.margin = '0'
  el.style.border = '0'
  el.style.boxSizing = 'content-box'

  document.documentElement.appendChild(el)
  const px = el.getBoundingClientRect().width
  el.remove()
  return Number.isFinite(px) ? px : 0
}

/**
 * Parse a breakpoint value (e.g. "40rem", "1280px") to pixels.
 */
function parseBreakpointValue(value: string, rootFontSizePx: number): number {
  const trimmed = value.trim()
  const match = trimmed.match(/^(-?\d*\.?\d+)(rem|em|px)$/i)
  if (!match) {
    // Fallback for calc()/clamp()/vw/etc.
    return measureCssLengthPx(trimmed)
  }
  const num = parseFloat(match[1])
  const unit = (match[2] || '').toLowerCase()
  if (unit === 'px') return num
  if (unit === 'rem' || unit === 'em') return num * rootFontSizePx
  return 0
}

const BREAKPOINT_RE = /--breakpoint-([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g

/**
 * Tolerant regex that matches Tailwind responsive-prefix selectors in multiple serialized forms:
 *   .desktop\:flex      (raw CSS text with backslash-colon)
 *   .desktop\3a flex    (CSSOM hex-escaped colon)
 *   .desktop\3a flex    (CSSOM hex-escaped with extra space)
 * Captures the breakpoint name (group 1).
 */
const RESPONSIVE_SELECTOR_RE = /\.([a-zA-Z][a-zA-Z0-9_-]*)(?:\\:|\\3a\s?|:)/g

/**
 * Parse breakpoint names from CSSOM CSSMediaRule nodes (preferred, structured approach).
 * Iterates CSSMediaRule → nested CSSStyleRule.selectorText and extracts responsive prefix names.
 * Falls back to text-based parsing when CSSOM is unavailable.
 */
function parseBreakpointsFromCssom(rules: CSSRuleList | undefined, into: BreakpointsMap): void {
  if (!rules) return
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as CSSRule & {
      media?: MediaList
      conditionText?: string
      cssRules?: CSSRuleList
      selectorText?: string
      styleSheet?: CSSStyleSheet
    }
    try {
      // Recurse into @layer, @supports, @import
      if (rule.styleSheet?.cssRules) {
        parseBreakpointsFromCssom(rule.styleSheet.cssRules, into)
      }

      // CSSMediaRule: extract width value and scan nested selectors for breakpoint names
      const mediaText = rule.conditionText ?? (rule.media && rule.media.mediaText)
      if (mediaText && rule.cssRules) {
        // Extract width value from media condition: (width >= 64rem) or (min-width: 64rem)
        const widthMatch = mediaText.match(/(?:width\s*>=\s*|min-width\s*:\s*)([^)]+)/)
        if (widthMatch) {
          const value = stripCssComment(widthMatch[1])
          if (value) {
            // Scan nested rules for responsive-prefix selectors
            for (let j = 0; j < rule.cssRules.length; j++) {
              const nested = rule.cssRules[j] as CSSRule & { selectorText?: string; cssRules?: CSSRuleList }
              try {
                if (nested.selectorText) {
                  RESPONSIVE_SELECTOR_RE.lastIndex = 0
                  let sel: RegExpExecArray | null
                  while ((sel = RESPONSIVE_SELECTOR_RE.exec(nested.selectorText)) !== null) {
                    const name = sel[1]
                    if (name && !into[name]) into[name] = value
                  }
                }
                // Recurse deeper (nested @media, @supports inside @media)
                if (nested.cssRules) {
                  parseBreakpointsFromCssom(nested.cssRules, into)
                }
              } catch { /* inaccessible */ }
            }
          }
        }
        // Recurse into nested grouping rules inside @media
        parseBreakpointsFromCssom(rule.cssRules, into)
      } else if (rule.cssRules) {
        // Other grouping rules (@layer, @supports, etc.)
        parseBreakpointsFromCssom(rule.cssRules, into)
      }
    } catch {
      // Cross-origin or inaccessible
    }
  }
}

/**
 * Text-based fallback: parse @media (width >= X) blocks for breakpoint names from CSS text.
 * Used when CSSOM is not available (e.g. raw text from fetch or textContent).
 */
function parseBreakpointsFromMediaQueries(text: string, into: BreakpointsMap): void {
  if (!text) return
  // Match @media (width >= X) or @media (min-width: X) - Tailwind v4/v3 formats
  const mediaRe = /@media\s*\(\s*(?:width\s*>=\s*|min-width\s*:\s*)([^)]+)\)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = mediaRe.exec(text)) !== null) {
    const value = stripCssComment(m[1])
    if (!value) continue
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      i++
    }
    const block = text.slice(start, i - 1)
    // Tolerant selector match: handles \: (raw text), \3a (CSSOM hex-escape), and plain :
    RESPONSIVE_SELECTOR_RE.lastIndex = 0
    let sel: RegExpExecArray | null
    while ((sel = RESPONSIVE_SELECTOR_RE.exec(block)) !== null) {
      const name = sel[1]
      if (name && !into[name]) into[name] = value
    }
  }
}

/**
 * Fetch same-origin <link> stylesheets and parse raw CSS for --breakpoint-*.
 * Catches any custom name when CSSOM / inline parse fails (e.g. Vue+Vite external CSS).
 */
function stripCssComment(val: string): string {
  return val.replace(/\/\*[\s\S]*?\*\//g, '').trim()
}

async function fetchBreakpointsFromLinks(): Promise<BreakpointsMap> {
  const result: BreakpointsMap = {}
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return result
  const origin = typeof location !== 'undefined' ? location.origin : ''
  const hrefs = new Set<string>()
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i] as CSSStyleSheet & { href?: string }
    const h = sheet.href
    if (!h) continue
    if (h.startsWith('blob:') || h.startsWith('data:') || (origin && h.startsWith(origin))) hrefs.add(h)
  }
  for (const el of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')) {
    const h = el.href
    if (h && (h.startsWith('blob:') || h.startsWith('data:') || (origin && h.startsWith(origin)))) hrefs.add(h)
  }
  const parseText = async (text: string, baseUrl: string): Promise<void> => {
    let m: RegExpExecArray | null
    BREAKPOINT_RE.lastIndex = 0
    while ((m = BREAKPOINT_RE.exec(text)) !== null) {
      const name = m[1]
      const val = stripCssComment(m[2])
      if (name && val) result[name] = val
    }
    parseBreakpointsFromMediaQueries(text, result)
    const importRe = /@import\s+(?:url\s*\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])\s*;?/g
    importRe.lastIndex = 0
    while ((m = importRe.exec(text)) !== null) {
      const importUrl = m[1] || m[2]
      if (importUrl && !importUrl.startsWith('http') && baseUrl) {
        try {
          const resolved = new URL(importUrl, baseUrl).href
          if (!hrefs.has(resolved)) {
            hrefs.add(resolved)
            const r = await fetch(resolved)
            const t = await r.text()
            await parseText(t, resolved)
          }
        } catch { /* ignore */ }
      }
    }
  }
  for (const href of hrefs) {
    try {
      const res = await fetch(href)
      const text = await res.text()
      await parseText(text, href)
    } catch {
      /* ignore */
    }
  }
  return result
}

/**
 * Collect all accessible CSSStyleSheets from the document, including:
 *   - document.styleSheets (from <link> and <style> elements)
 *   - document.adoptedStyleSheets (constructable stylesheets, used by some Vite plugins)
 *   - shadowRoot.adoptedStyleSheets (if applicable)
 */
function getAllStyleSheets(): CSSStyleSheet[] {
  const sheets: CSSStyleSheet[] = []
  if (typeof document === 'undefined') return sheets
  const origin = typeof location !== 'undefined' ? location.origin : ''

  // Standard document.styleSheets (from <link> and <style> elements)
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i] as CSSStyleSheet & { href?: string }
    // Skip cross-origin sheets
    if (sheet.href && origin && !sheet.href.startsWith(origin)) continue
    sheets.push(sheet)
  }

  // Constructable / adopted stylesheets (Vite plugins, modern toolchains)
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
  if (doc.adoptedStyleSheets) {
    for (const sheet of doc.adoptedStyleSheets) {
      sheets.push(sheet)
    }
  }

  return sheets
}

/**
 * Read --breakpoint-* custom properties from the document (Tailwind v4 @theme).
 * Also parses @media rules via CSSOM (structured) to find responsive-prefix class selectors.
 * Supports:
 *   - document.styleSheets + document.adoptedStyleSheets
 *   - CSSOM traversal for --breakpoint-* properties
 *   - CSSOM CSSMediaRule traversal for responsive selectors (.desktop\:flex etc.)
 *   - Raw textContent fallback for <style> elements (when CSSOM fails)
 */
function getBreakpointsFromCss(): BreakpointsMap {
  const result: BreakpointsMap = {}
  if (typeof document === 'undefined') return result

  const collectFromStyleDecl = (styleDecl: CSSStyleDeclaration): void => {
    for (let k = 0; k < (styleDecl.length || 0); k++) {
      const prop = styleDecl[k]
      if (prop && prop.startsWith('--breakpoint-')) {
        const name = prop.slice('--breakpoint-'.length)
        const val = styleDecl.getPropertyValue(prop).trim()
        if (name && val) result[name] = val
      }
    }
  }

  const collectFromRuleList = (rules: CSSRuleList | undefined): void => {
    if (!rules) return
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as CSSRule & { styleSheet?: CSSStyleSheet; style?: CSSStyleDeclaration; cssRules?: CSSRuleList }
      try {
        // CSSStyleRule: collect --breakpoint-* from any rule (Tailwind + custom names)
        if (rule.style) {
          collectFromStyleDecl(rule.style)
        }
        // CSSImportRule: recurse into imported sheet
        if (rule.styleSheet?.cssRules) {
          collectFromRuleList(rule.styleSheet.cssRules)
        }
        // Grouping rules: recurse into nested cssRules (@layer/@media/@supports)
        if (rule.cssRules) {
          collectFromRuleList(rule.cssRules)
        }
      } catch {
        // Cross-origin or inaccessible
      }
    }
  }

  const sheets = getAllStyleSheets()

  // Pass 1: CSSOM — collect --breakpoint-* custom properties from all rules
  for (const sheet of sheets) {
    try {
      collectFromRuleList(sheet.cssRules)
    } catch {
      // Cross-origin or inaccessible stylesheet
    }
  }

  // Pass 2: CSSOM — parse @media rules for responsive-prefix selectors (structured, reliable)
  // This finds custom breakpoints that Tailwind v4 inlines into @media but doesn't emit as --breakpoint-*
  for (const sheet of sheets) {
    try {
      parseBreakpointsFromCssom(sheet.cssRules, result)
    } catch {
      // Cross-origin or inaccessible
    }
  }

  // Pass 3: Fallback — parse raw CSS text for --breakpoint-* and @media blocks
  // Needed when Vite uses insertRule() (textContent empty) is covered by Pass 1+2 above,
  // but textContent parsing catches edge cases where CSSOM iteration fails.
  const parseCssText = (text: string): void => {
    if (!text) return
    let m: RegExpExecArray | null
    BREAKPOINT_RE.lastIndex = 0
    while ((m = BREAKPOINT_RE.exec(text)) !== null) {
      const name = m[1]
      const val = stripCssComment(m[2])
      if (name && val && !result[name]) result[name] = val
    }
    parseBreakpointsFromMediaQueries(text, result)
  }
  for (const sheet of sheets) {
    try {
      const owner = (sheet as CSSStyleSheet & { ownerNode?: Element }).ownerNode
      if (owner?.nodeName === 'STYLE') {
        parseCssText((owner as HTMLStyleElement).textContent || '')
      }
    } catch { /* ignore */ }
  }
  // Also scan <style> elements not yet associated with a stylesheet (edge case)
  for (const el of document.querySelectorAll('style')) {
    parseCssText(el.textContent || '')
  }

  return result
}

/**
 * Resolve breakpoints: options.breakpoints overrides CSS; otherwise CSS; else default set.
 * Returns sorted list including optional base row.
 */
function resolveBreakpoints(options: BreakpointHelperOptions): ResolvedBreakpoint[] {
  const baseLabel = options.baseLabel === undefined ? 'base' : options.baseLabel
  const rootFontSizePx = getRootFontSizePx()

  let raw: BreakpointsMap
  if (options.breakpoints && Object.keys(options.breakpoints).length > 0) {
    raw = { ...options.breakpoints }
  } else {
    const fromCss = getBreakpointsFromCss()
    // Tailwind v4 only emits used breakpoints; merge with defaults so missing md/lg/xl are filled
    raw = { ...DEFAULT_BREAKPOINTS, ...fromCss }
  }

  const listWithIndex: Array<ResolvedBreakpoint & { _i: number }> = []
  let idx = 0
  for (const [name, originalValue] of Object.entries(raw)) {
    const valuePx = parseBreakpointValue(originalValue, rootFontSizePx)
    // Skip invalid/unresolvable values (prevents valuePx=0 from breaking sorting/base range)
    if (!Number.isFinite(valuePx) || valuePx <= 0) {
      idx++
      continue
    }
    listWithIndex.push({ name, valuePx, originalValue, _i: idx })
    idx++
  }
  listWithIndex.sort((a, b) => (a.valuePx - b.valuePx) || (a._i - b._i))
  const list: ResolvedBreakpoint[] = listWithIndex.map(({ _i, ...bp }) => bp)

  const firstPx = list.length > 0 ? list[0].valuePx : 640
  if (baseLabel !== false) {
    list.unshift({
      name: baseLabel,
      valuePx: 0,
      originalValue: `0 – ${firstPx}px`
    })
  }

  return list
}

/**
 * Sanitize breakpoint name for use as CSS class (e.g. "2xl" -> "2xl").
 */
function breakpointNameToClass(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/gi, '-')
    .toLowerCase()
}

/**
 * Detects if we're in development mode
 */
function isDevMode(): boolean {
  // Vite
  const meta = import.meta as { env?: { DEV?: boolean } }
  if (typeof import.meta !== 'undefined' && meta.env?.DEV) {
    return true
  }
  
  // Node.js / Webpack / Other bundlers
  if (typeof globalThis !== 'undefined') {
    const proc = (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process
    if (proc?.env?.NODE_ENV === 'development') {
      return true
    }
  }
  
  // Fallback: check if we're in a development-like environment
  if (typeof window !== 'undefined') {
    // Check for common dev indicators
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return true
    }
  }
  
  return false
}

/**
 * Find the active breakpoint index for the given width.
 */
function getActiveBreakpointIndex(resolved: ResolvedBreakpoint[], widthPx: number): number {
  let index = 0
  for (let i = 0; i < resolved.length; i++) {
    if (widthPx >= resolved[i].valuePx) index = i
  }
  return index
}

/**
 * Update which breakpoint is shown as active and container background.
 */
function updateActiveBreakpoint(
  container: HTMLElement,
  resolved: ResolvedBreakpoint[],
  content: HTMLElement
): void {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0
  const index = getActiveBreakpointIndex(resolved, width)
  const color = BREAKPOINT_COLORS[index % BREAKPOINT_COLORS.length]
  container.style.backgroundColor = color

  const labels = content.querySelectorAll('.breakpoint-helper-label')
  labels.forEach((el, i) => {
    el.classList.toggle('breakpoint-helper-active', i === index)
  })
}

/**
 * Creates the breakpoint helper HTML element with dynamic breakpoints.
 */
function createBreakpointHelperElement(resolved: ResolvedBreakpoint[]): HTMLElement {
  const container = document.createElement('div')
  container.id = 'breakpoint-helper'
  container.className = 'breakpoint-helper'
  container.setAttribute('style', 'display: none')

  const content = buildBreakpointHelperContent(resolved)
  container.appendChild(content)

  updateActiveBreakpoint(container, resolved, content)
  return container
}

function buildBreakpointHelperContent(resolved: ResolvedBreakpoint[]): HTMLElement {
  const content = document.createElement('div')
  content.className = 'breakpoint-helper-content'

  for (let i = 0; i < resolved.length; i++) {
    const bp = resolved[i]
    const span = document.createElement('span')
    const classBase = breakpointNameToClass(bp.name)
    span.className = `breakpoint-helper-label breakpoint-helper-${classBase}`
    span.setAttribute('data-breakpoint-px', String(bp.valuePx))
    span.setAttribute('data-breakpoint-name', bp.name)

    const valueDisplay = bp.valuePx === 0
      ? bp.originalValue
      : `${bp.originalValue} (${Math.round(bp.valuePx)}px)`
    const mediaPart = bp.valuePx === 0
      ? `@media (width < ${resolved[1]?.originalValue ?? '40rem'})`
      : `@media (width >= ${bp.originalValue})`
    span.innerHTML = `<strong class="breakpoint-helper-badge">${escapeHtml(bp.name)}</strong> ${escapeHtml(valueDisplay)} ${mediaPart}`
    content.appendChild(span)
  }

  const hideButton = document.createElement('button')
  hideButton.id = 'breakpoint-helper-hide-btn'
  hideButton.type = 'button'
  hideButton.className = 'breakpoint-helper-hide-btn'
  hideButton.setAttribute('aria-label', 'Hide breakpoint helper for 20 seconds')

  hideButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="breakpoint-helper-icon">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  `
  content.appendChild(hideButton)

  return content
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Initializes the breakpoint helper
 */
export function initBreakpointHelper(options: BreakpointHelperOptions = {}): void {
  // Client-only: safe no-op in SSR or non-browser environments.
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const enabled = opts.enabled !== undefined ? opts.enabled : isDevMode()
  if (!enabled) return

  let resolved = resolveBreakpoints(opts)

  // Vue/Vite: fetch external <link> CSS (Tailwind loads async); retry + MutationObserver for dynamic injection
  const hasExplicitBreakpoints = opts.breakpoints && Object.keys(opts.breakpoints).length > 0
  if (!hasExplicitBreakpoints && typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    let lastFetchedCount = 0
    const doFetchAndInit = (): void => {
      fetchBreakpointsFromLinks().then((fetched) => {
        const n = Object.keys(fetched).length
        if (n > 0 && n > lastFetchedCount) {
          lastFetchedCount = n
          initBreakpointHelper({ ...options, breakpoints: { ...DEFAULT_BREAKPOINTS, ...fetched } })
        }
      }).catch(() => { /* keep current */ })
    }
    const run = (): void => {
      doFetchAndInit()
      setTimeout(doFetchAndInit, 300)
      setTimeout(doFetchAndInit, 1000)
      const observer = new MutationObserver(() => {
        doFetchAndInit()
      })
      observer.observe(document.head, { childList: true, subtree: true })
      setTimeout(() => observer.disconnect(), 5000)
    }
    if (document.readyState === 'complete') {
      run()
    } else {
      window.addEventListener('load', run, { once: true })
    }
  }
  const signature = JSON.stringify(resolved.map((bp) => [bp.name, bp.originalValue]))

  let breakpointHelper: HTMLElement | null = null
  if (opts.containerSelector) {
    breakpointHelper = document.querySelector(opts.containerSelector) as HTMLElement | null
  } else {
    breakpointHelper = document.getElementById('breakpoint-helper')
  }

  if (!breakpointHelper) {
    breakpointHelper = createBreakpointHelperElement(resolved)
    document.body.appendChild(breakpointHelper)
  } else {
    // Ensure base styles are present even for custom containers.
    if (!breakpointHelper.classList.contains('breakpoint-helper')) {
      breakpointHelper.classList.add('breakpoint-helper')
    }
  }

  breakpointHelper.style.display = 'block'

  const state: HelperState = HELPER_STATE.get(breakpointHelper) ?? {}

  // Remove previous listeners (safe re-init).
  if (state.resizeHandler) {
    window.removeEventListener('resize', state.resizeHandler)
    state.resizeHandler = undefined
  }

  // Rebuild helper content if missing or if breakpoints changed.
  const existingContent = breakpointHelper.querySelector('.breakpoint-helper-content') as HTMLElement | null
  if (!existingContent || state.signature !== signature) {
    if (existingContent) existingContent.remove()
    breakpointHelper.appendChild(buildBreakpointHelperContent(resolved))
    state.signature = signature
  }

  const contentEl = breakpointHelper.querySelector('.breakpoint-helper-content') as HTMLElement | null
  if (contentEl) updateActiveBreakpoint(breakpointHelper, resolved, contentEl)

  const resizeHandler = (): void => {
    const content = breakpointHelper?.querySelector('.breakpoint-helper-content') as HTMLElement | null
    if (breakpointHelper && content) updateActiveBreakpoint(breakpointHelper, resolved, content)
  }
  state.resizeHandler = resizeHandler
  window.addEventListener('resize', resizeHandler)

  const hideButton = breakpointHelper.querySelector('#breakpoint-helper-hide-btn') as HTMLButtonElement | null
  if (hideButton) {
    if (state.hideHandler) {
      hideButton.removeEventListener('click', state.hideHandler)
      state.hideHandler = undefined
    }
    const hideHandler = (): void => {
      breakpointHelper.style.display = 'none'
      window.setTimeout(() => {
        breakpointHelper.style.display = 'block'
      }, opts.hideDuration)
    }
    state.hideHandler = hideHandler
    hideButton.addEventListener('click', hideHandler)
  }

  HELPER_STATE.set(breakpointHelper, state)
}

/**
 * Debug: run detection and return results. Call from console to diagnose Vue/custom breakpoint issues.
 * @example import { debugBreakpointDetection } from '@kittler/tailwind-breakpoint-indicator'; console.log(await debugBreakpointDetection())
 */
export async function debugBreakpointDetection(): Promise<{
  fromCss: BreakpointsMap
  fromFetch: BreakpointsMap
  stylesheetHrefs: string[]
  adoptedStyleSheetsCount: number
  totalCssRulesCount: number
  sampleFromFirstSheet: string
  sampleFromInlineStyles: string
  sampleCssomMediaRules: string[]
}> {
  const fromCss = getBreakpointsFromCss()
  const fromFetch = await fetchBreakpointsFromLinks()
  const hrefs = new Set<string>()
  if (typeof document !== 'undefined') {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const h = (document.styleSheets[i] as CSSStyleSheet & { href?: string }).href
      if (h) hrefs.add(h)
    }
    for (const el of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')) {
      if (el.href) hrefs.add(el.href)
    }
  }
  const hrefList = Array.from(hrefs)

  // Count adopted stylesheets
  let adoptedStyleSheetsCount = 0
  if (typeof document !== 'undefined') {
    const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
    adoptedStyleSheetsCount = doc.adoptedStyleSheets?.length ?? 0
  }

  // Count total CSSOM rules and sample @media rules
  let totalCssRulesCount = 0
  const sampleCssomMediaRules: string[] = []
  const allSheets = getAllStyleSheets()
  for (const sheet of allSheets) {
    try {
      const rules = sheet.cssRules
      if (rules) {
        totalCssRulesCount += rules.length
        for (let i = 0; i < rules.length && sampleCssomMediaRules.length < 10; i++) {
          const rule = rules[i] as CSSRule & { conditionText?: string; media?: MediaList; cssRules?: CSSRuleList }
          const mediaText = rule.conditionText ?? (rule.media && rule.media.mediaText)
          if (mediaText && /width|min-width/i.test(mediaText) && rule.cssRules && rule.cssRules.length > 0) {
            const firstNested = rule.cssRules[0] as CSSRule & { selectorText?: string }
            sampleCssomMediaRules.push(`@media ${mediaText} { ${firstNested.selectorText ?? '?'} { ... } } (${rule.cssRules.length} rules)`)
          }
        }
      }
    } catch { /* cross-origin */ }
  }

  let sampleFromFirstSheet = ''
  if (hrefList.length > 0 && typeof fetch !== 'undefined') {
    try {
      const r = await fetch(hrefList[0])
      sampleFromFirstSheet = (await r.text()).slice(0, 3000)
    } catch {
      sampleFromFirstSheet = '(fetch failed)'
    }
  }
  let sampleFromInlineStyles = ''
  if (typeof document !== 'undefined') {
    const parts: string[] = []
    for (const el of document.querySelectorAll('style')) {
      const t = el.textContent || ''
      if (t) parts.push(t)
    }
    sampleFromInlineStyles = parts.join('\n').slice(0, 3000)
  }
  return {
    fromCss,
    fromFetch,
    stylesheetHrefs: hrefList,
    adoptedStyleSheetsCount,
    totalCssRulesCount,
    sampleFromFirstSheet,
    sampleFromInlineStyles,
    sampleCssomMediaRules
  }
}

/**
 * Auto-initialize if imported directly (for convenience)
 */
if (typeof window !== 'undefined') {
  // Only auto-init in browser environment
  // Check if we should auto-init (dev mode)
  if (isDevMode()) {
    // Use requestAnimationFrame to ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initBreakpointHelper()
      })
    } else {
      initBreakpointHelper()
    }
  }
}
