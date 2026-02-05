// Show breakpoint helper only in dev mode
if (import.meta.env.DEV) {
  const breakpointHelper = document.getElementById('breakpoint-helper')
  const hideButton = document.getElementById('breakpoint-helper-hide-btn')
  
  if (breakpointHelper) {
    breakpointHelper.style.display = 'block'
  }

  // Hide breakpoint helper for 20 seconds on button click
  if (hideButton && breakpointHelper) {
    hideButton.addEventListener('click', () => {
      breakpointHelper.style.display = 'none'
      
      setTimeout(() => {
        if (breakpointHelper) {
          breakpointHelper.style.display = 'block'
        }
      }, 20000) // 20 seconds
    })
  }
}
