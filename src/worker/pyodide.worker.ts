/// <reference lib="webworker" />
import { loadPyodide, version } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import bootstrap from './bootstrap.py?raw'

export type WorkerIn =
  | { type: 'init' }
  | { type: 'convert'; id: number; name: string; data: Uint8Array }

export type WorkerOut =
  | { type: 'status'; text: string }
  | { type: 'ready'; warnings: string[] }
  | { type: 'fatal'; error: string }
  | { type: 'result'; id: number; markdown: string }
  | { type: 'error'; id: number; error: string }

// Packages that ship as Pyodide wheels (compiled or from the Pyodide index).
const PYODIDE_PKGS = [
  'micropip',
  'lxml',
  'pandas',
  'beautifulsoup4',
  'requests',
  'charset-normalizer',
  'certifi',
  'cryptography',
  'pillow',
  'xlrd',
]

// Pure-Python packages installed from PyPI with micropip (dependencies resolved).
const PYPI_PKGS = [
  'markdownify',
  'defusedxml',
  'mammoth', // .docx
  'python-pptx', // .pptx
  'openpyxl', // .xlsx
  'pdfminer.six', // .pdf
  'olefile', // .msg
]

const post = (m: WorkerOut) => self.postMessage(m)

let pyodide: PyodideInterface

async function pipInstall(spec: string, deps: boolean): Promise<string | null> {
  pyodide.globals.set('_spec', spec)
  pyodide.globals.set('_deps', deps)
  try {
    await pyodide.runPythonAsync(
      'import micropip\nawait micropip.install(_spec, deps=_deps)',
    )
    return null
  } catch (e) {
    return `${spec}: ${String(e).split('\n').slice(-2).join(' ')}`
  }
}

async function init() {
  post({ type: 'status', text: 'Wait...converter is loading' })
  pyodide = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
  })

  post({ type: 'status', text: 'Wait...converter is loading' })
  await pyodide.loadPackage(PYODIDE_PKGS)

  // markitdown itself: deps=False so micropip does NOT try to pull magika/onnxruntime.
  post({ type: 'status', text: 'Wait...converter is loading' })
  const fatal = await pipInstall('markitdown==0.1.9', false)
  if (fatal) throw new Error(fatal)

  const warnings: string[] = []
  for (const pkg of PYPI_PKGS) {
    post({ type: 'status', text: `Wait...converter is loading` })
    const err = await pipInstall(pkg, true)
    if (err) warnings.push(err)
  }
  // pdfplumber hard-requires pypdfium2 (no WASM wheel). markitdown only needs
  // its table/text API, so install it without deps; pdfminer.six + pillow are already present.
  post({ type: 'status', text: 'Wait...converter is loading' })
  const pl = await pipInstall('pdfplumber', false)
  if (pl) warnings.push(pl)

  post({ type: 'status', text: 'Starting converter…' })
  await pyodide.runPythonAsync(bootstrap)
  post({ type: 'ready', warnings })
}

function convert(id: number, name: string, data: Uint8Array) {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
  const path = `/tmp/in_${id}${ext}`
  try {
    pyodide.FS.writeFile(path, data)
    const fn = pyodide.globals.get('convert')
    const markdown: string = fn(path)
    fn.destroy()
    post({ type: 'result', id, markdown })
  } catch (e) {
    post({ type: 'error', id, error: String(e).split('\n').slice(-3).join('\n') })
  } finally {
    try {
      pyodide.FS.unlink(path)
    } catch {
      /* ignore */
    }
  }
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    init().catch((e) => post({ type: 'fatal', error: String(e) }))
  } else if (msg.type === 'convert') {
    convert(msg.id, msg.name, msg.data)
  }
}
