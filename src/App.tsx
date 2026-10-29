import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useConverter } from './useConverter'
import './App.css'

type Item = {
  id: number
  name: string
  size: number
  state: 'queued' | 'converting' | 'done' | 'error'
  markdown?: string
  error?: string
}

const ACCEPT = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.json,.xml,.html,.htm,.txt,.md,.epub,.ipynb,.zip,.msg'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/\.[^.]+$/, '') + '.md'
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const { status, ready, fatal, warnings, convert } = useConverter()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const nextId = useRef(1)
  const input = useRef<HTMLInputElement>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const patch = (id: number, p: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)))

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const added: Item[] = list.map((f) => ({
      id: nextId.current++,
      name: f.name,
      size: f.size,
      state: 'queued',
    }))
    setItems((cur) => [...cur, ...added])
    setSelected((s) => s ?? added[0]?.id ?? null)
    list.forEach((file, idx) => {
      const id = added[idx].id
      // Serialize: one conversion at a time (Pyodide is single-threaded).
      queue.current = queue.current.then(async () => {
        patch(id, { state: 'converting' })
        try {
          const markdown = await convert(file)
          patch(id, { state: 'done', markdown })
        } catch (e) {
          patch(id, { state: 'error', error: (e as Error).message })
        }
      })
    })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const current = items.find((i) => i.id === selected)

  return (
    <main className="app">
      <h1>MarkItDown in your browser</h1>
      <p className="sub">
        Files never leave your device. Conversion runs locally with Microsoft MarkItDown.
      </p>

      {fatal ? (
        <div className="banner err">Failed to start converter: {fatal}</div>
      ) : !ready ? (
        <div className="banner">⏳ {status} (first load ~20–40 MB, cached afterwards)</div>
      ) : (
        <div className="banner ok">Ready</div>
      )}
      {warnings.length > 0 && (
        <details className="banner warn">
          <summary>{warnings.length} optional package(s) failed — some formats may not convert</summary>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div
        className={`drop ${over ? 'over' : ''} ${ready ? '' : 'disabled'}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={ready ? onDrop : (e) => e.preventDefault()}
        onClick={() => ready && input.current?.click()}
      >
        Drop files here or click to choose
        <small>pdf · docx · pptx · xlsx · xls · csv · html · json · xml · epub · zip · txt</small>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="split">
          <ul className="files">
            {items.map((i) => (
              <li
                key={i.id}
                className={i.id === selected ? 'sel' : ''}
                onClick={() => setSelected(i.id)}
              >
                <span className="fname">{i.name}</span>
                <span className={`tag ${i.state}`}>{i.state}</span>
              </li>
            ))}
          </ul>

          <section className="out">
            {current?.state === 'done' && (
              <>
                <div className="actions">
                  <button onClick={() => navigator.clipboard.writeText(current.markdown ?? '')}>Copy</button>
                  <button onClick={() => download(current.name, current.markdown ?? '')}>Download .md</button>
                </div>
                <textarea readOnly value={current.markdown} />
              </>
            )}
            {current?.state === 'error' && <pre className="errtxt">{current.error}</pre>}
            {current && (current.state === 'queued' || current.state === 'converting') && (
              <p>Converting…</p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
