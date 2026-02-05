import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { copyFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    }),
    {
      name: 'copy-css',
      closeBundle() {
        // Copy CSS file to dist
        try {
          copyFileSync(
            resolve(__dirname, 'src/styles.css'),
            resolve(__dirname, 'dist/styles.css')
          )
        } catch (error) {
          console.warn('Failed to copy CSS file:', error)
        }
      }
    }
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TailwindBreakpointIndicator',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'index.esm.js'
        if (format === 'cjs') return 'index.js'
        if (format === 'umd') return 'index.umd.js'
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
    cssCodeSplit: false
  }
})
