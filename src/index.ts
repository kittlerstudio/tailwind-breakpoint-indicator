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
}

const DEFAULT_OPTIONS: Required<Omit<BreakpointHelperOptions, 'enabled' | 'containerSelector'>> = {
  hideDuration: 20000
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
 * Creates the breakpoint helper HTML element
 */
function createBreakpointHelperElement(): HTMLElement {
  const container = document.createElement('div')
  container.id = 'breakpoint-helper'
  container.className = 'breakpoint-helper'
  container.setAttribute('style', 'display: none')
  
  const content = document.createElement('div')
  content.className = 'breakpoint-helper-content'
  
  // Base breakpoint
  const baseSpan = document.createElement('span')
  baseSpan.className = 'breakpoint-helper-label breakpoint-helper-base'
  baseSpan.innerHTML = '<strong class="breakpoint-helper-badge">base</strong> 32rem (512px) @media (width >= 32rem)'
  
  // SM breakpoint
  const smSpan = document.createElement('span')
  smSpan.className = 'breakpoint-helper-label breakpoint-helper-sm'
  smSpan.innerHTML = '<strong class="breakpoint-helper-badge">sm</strong> 40rem (640px) @media (width >= 40rem)'
  
  // MD breakpoint
  const mdSpan = document.createElement('span')
  mdSpan.className = 'breakpoint-helper-label breakpoint-helper-md'
  mdSpan.innerHTML = '<strong class="breakpoint-helper-badge">md</strong> 48rem (768px) @media (width >= 48rem)'
  
  // LG breakpoint
  const lgSpan = document.createElement('span')
  lgSpan.className = 'breakpoint-helper-label breakpoint-helper-lg'
  lgSpan.innerHTML = '<strong class="breakpoint-helper-badge">lg</strong> 64rem (1024px) @media (width >= 64rem)'
  
  // XL breakpoint
  const xlSpan = document.createElement('span')
  xlSpan.className = 'breakpoint-helper-label breakpoint-helper-xl'
  xlSpan.innerHTML = '<strong class="breakpoint-helper-badge">xl</strong> 80rem (1280px) @media (width >= 80rem)'
  
  // 2XL breakpoint
  const xl2Span = document.createElement('span')
  xl2Span.className = 'breakpoint-helper-label breakpoint-helper-2xl'
  xl2Span.innerHTML = '<strong class="breakpoint-helper-badge">2xl</strong> 96rem (1536px) @media (width >= 96rem)'
  
  content.appendChild(baseSpan)
  content.appendChild(smSpan)
  content.appendChild(mdSpan)
  content.appendChild(lgSpan)
  content.appendChild(xlSpan)
  content.appendChild(xl2Span)
  
  // Hide button
  const hideButton = document.createElement('button')
  hideButton.id = 'breakpoint-helper-hide-btn'
  hideButton.type = 'button'
  hideButton.className = 'breakpoint-helper-hide-btn'
  hideButton.setAttribute('aria-label', 'Skrýt breakpoint helper na 20 sekund')
  
  hideButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="breakpoint-helper-icon">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  `
  
  content.appendChild(hideButton)
  container.appendChild(content)
  
  return container
}

/**
 * Initializes the breakpoint helper
 */
export function initBreakpointHelper(options: BreakpointHelperOptions = {}): void {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options
  }
  
  // Determine if enabled
  const enabled = opts.enabled !== undefined ? opts.enabled : isDevMode()
  
  if (!enabled) {
    return
  }
  
  // Check if element already exists or use custom selector
  let breakpointHelper: HTMLElement | null = null
  
  if (opts.containerSelector) {
    breakpointHelper = document.querySelector(opts.containerSelector)
  } else {
    breakpointHelper = document.getElementById('breakpoint-helper')
  }
  
  // Create element if it doesn't exist
  if (!breakpointHelper) {
    breakpointHelper = createBreakpointHelperElement()
    document.body.appendChild(breakpointHelper)
  }
  
  // Show the helper
  breakpointHelper.style.display = 'block'
  
  // Setup hide button functionality
  const hideButton = breakpointHelper.querySelector('#breakpoint-helper-hide-btn') as HTMLButtonElement | null
  
  if (hideButton) {
    hideButton.addEventListener('click', () => {
      if (breakpointHelper) {
        breakpointHelper.style.display = 'none'
        
        setTimeout(() => {
          if (breakpointHelper) {
            breakpointHelper.style.display = 'block'
          }
        }, opts.hideDuration)
      }
    })
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
