#!/usr/bin/env node

/**
 * Simple HTTP server for testing HTML files
 * Usage: node test/server.js
 */

import { createServer } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = join(__dirname, '..')
const port = process.env.PORT || 8000

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json'
}

const server = createServer((req, res) => {
  let filePath = join(rootDir, req.url === '/' ? '/test/test-esm.html' : req.url)
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  
  // Default to index if directory
  try {
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
  } catch (e) {
    // File doesn't exist, continue to 404
  }
  
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>404 Not Found</title></head>
        <body>
          <h1>404 - File Not Found</h1>
          <p>Requested: ${req.url}</p>
          <ul>
            <li><a href="/test/test-esm.html">ES Module Test</a></li>
            <li><a href="/test/test-umd.html">UMD Test</a></li>
            <li><a href="/test/test-manual.html">Manual Init Test</a></li>
            <li><a href="/example/index.html">Example</a></li>
          </ul>
        </body>
      </html>
    `)
    return
  }
  
  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath)
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    
    // CORS headers for ES modules
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, headers)
      res.end()
      return
    }
    
    res.writeHead(200, headers)
    res.end(content)
  } catch (error) {
    res.writeHead(500)
    res.end(`Error: ${error.message}`)
  }
})

server.listen(port, () => {
  console.log(`
🚀 Test server running at http://localhost:${port}

Available test pages:
  📄 http://localhost:${port}/test/test-esm.html      - ES Module test
  📄 http://localhost:${port}/test/test-umd.html     - UMD format test
  📄 http://localhost:${port}/test/test-manual.html  - Manual initialization test
  📄 http://localhost:${port}/example/index.html     - Example usage

Press Ctrl+C to stop the server.
  `)
})
