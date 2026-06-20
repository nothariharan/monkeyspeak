const fs = require('fs')
const path = require('path')

// keep public/ ort wasm in sync with onnxruntime-web after npm install

const dist = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist')
const out = path.join(__dirname, '..', 'public')

const files = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
]

for (const name of files) {
  const src = path.join(dist, name)
  if (!fs.existsSync(src)) {
    console.warn(`[copy-ort-assets] skip missing ${name}`)
    continue
  }
  fs.copyFileSync(src, path.join(out, name))
}
