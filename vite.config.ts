import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      outDir: 'dist',
      include: ['src/**/*.ts'],
      root: process.cwd(),
      copyDtsFiles: true,
      rollupTypes: true
    }),
    {
      name: 'copy-css',
      closeBundle() {
        // Ensure dist directory exists
        const distDir = resolve(__dirname, 'dist')
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
        
        // Copy CSS file to dist
        const srcCss = resolve(__dirname, 'src/styles.css')
        const distCss = resolve(__dirname, 'dist/styles.css')
        
        if (existsSync(srcCss)) {
          try {
            copyFileSync(srcCss, distCss)
            console.log('✓ CSS file copied to dist/styles.css')
          } catch (error) {
            console.error('Failed to copy CSS file:', error)
            throw error
          }
        } else {
          console.warn('Warning: src/styles.css not found')
        }
      }
    }
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TailwindBreakpointIndicator',
      formats: ['es', 'cjs'],
      fileName: (format) => {
        if (format === 'es') return 'index.esm.js'
        if (format === 'cjs') return 'index.js'
        return 'index.js'
      }
    },
    rollupOptions: {
      output: {
        globals: {}
      }
    },
    sourcemap: true,
    emptyOutDir: true,
    cssCodeSplit: false,
    // Ensure CSS is extracted
    cssMinify: true
  }
})
