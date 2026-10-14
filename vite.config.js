import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Forward /api requests to the RENET backend during development.
const apiProxy = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
}

/*
  The homepage hero (largest paint) is rendered by React, so the browser would
  only discover it after the JS runs. This adds a homepage-only preload with the
  real hashed responsive file names at build time.
*/
function preloadHeroImage() {
  return {
    name: 'renet-preload-hero',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const files = Object.keys(ctx.bundle || {})
        .map((name) => name.match(/^assets\/renet-hero-(\d+)-[\w-]+\.webp$/))
        .filter(Boolean)
        .sort((a, b) => a[1] - b[1])
      if (!files.length) return html
      const srcset = files.map(([file, width]) => `/${file} ${width}w`).join(', ')
      const script = `<script>if(location.pathname==="/"){var l=document.createElement("link");l.rel="preload";l.as="image";l.setAttribute("imagesrcset",${JSON.stringify(srcset)});l.setAttribute("imagesizes","100vw");l.setAttribute("fetchpriority","high");document.head.appendChild(l)}</script>`
      return html.replace('</head>', `    ${script}\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadHeroImage()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    rolldownOptions: {
      output: {
        // React + router rarely change: a separate chunk stays cached across deploys.
        advancedChunks: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
})
