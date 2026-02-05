#!/usr/bin/env node

/**
 * Test script to verify build output
 * Checks if all required files exist and have correct structure
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')

const requiredFiles = [
  'index.js',           // CommonJS
  'index.esm.js',       // ES Module
  'index.umd.js',       // UMD
  'index.d.ts',         // TypeScript definitions
  'styles.css'          // CSS
]

const errors = []
const warnings = []

console.log('🔍 Testing build output...\n')

// Check if dist directory exists
if (!existsSync(distDir)) {
  console.error('❌ dist/ directory does not exist!')
  console.error('   Run "npm run build" first.')
  process.exit(1)
}

// Check required files
console.log('📁 Checking required files:')
requiredFiles.forEach(file => {
  const filePath = join(distDir, file)
  if (existsSync(filePath)) {
    const stats = statSync(filePath)
    console.log(`   ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`)
    
    // Basic content checks
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const content = readFileSync(filePath, 'utf-8')
      
      // Check for empty files
      if (content.trim().length === 0) {
        errors.push(`${file} is empty`)
      }
      
      // Check for source maps
      if (file.endsWith('.js') && !existsSync(filePath + '.map')) {
        warnings.push(`${file} missing source map`)
      }
    }
  } else {
    console.log(`   ❌ ${file} - MISSING`)
    errors.push(`Missing required file: ${file}`)
  }
})

// Check package.json exports
console.log('\n📦 Checking package.json exports:')
try {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
  
  if (packageJson.exports) {
    console.log('   ✅ exports field exists')
    
    // Check main entry
    if (packageJson.main) {
      const mainPath = join(rootDir, packageJson.main)
      if (existsSync(mainPath)) {
        console.log(`   ✅ main: ${packageJson.main}`)
      } else {
        errors.push(`main entry point not found: ${packageJson.main}`)
      }
    }
    
    // Check module entry
    if (packageJson.module) {
      const modulePath = join(rootDir, packageJson.module)
      if (existsSync(modulePath)) {
        console.log(`   ✅ module: ${packageJson.module}`)
      } else {
        errors.push(`module entry point not found: ${packageJson.module}`)
      }
    }
    
    // Check types entry
    if (packageJson.types) {
      const typesPath = join(rootDir, packageJson.types)
      if (existsSync(typesPath)) {
        console.log(`   ✅ types: ${packageJson.types}`)
      } else {
        errors.push(`types entry point not found: ${packageJson.types}`)
      }
    }
  } else {
    warnings.push('package.json missing exports field')
  }
} catch (error) {
  errors.push(`Failed to read package.json: ${error.message}`)
}

// Summary
console.log('\n' + '='.repeat(50))
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed!')
  process.exit(0)
} else {
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`)
    errors.forEach(err => console.log(`   - ${err}`))
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`)
    warnings.forEach(warn => console.log(`   - ${warn}`))
  }
  
  process.exit(errors.length > 0 ? 1 : 0)
}
