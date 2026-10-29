import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkerIn, WorkerOut } from './worker/pyodide.worker'

type Pending = { resolve: (md: string) => void; reject: (e: Error) => void }

export function useConverter() {
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, Pending>())
  const nextId = useRef(1)
  const [status, setStatus] = useState('Starting…')
  const [ready, setReady] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const worker = new Worker(new URL('./worker/pyodide.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    const pend = pending.current

    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data
      switch (m.type) {
        case 'status':
          setStatus(m.text)
          break
        case 'ready':
          setWarnings(m.warnings)
          setReady(true)
          break
        case 'fatal':
          setFatal(m.error)
          break
        case 'result':
          pend.get(m.id)?.resolve(m.markdown)
          pend.delete(m.id)
          break
        case 'error':
          pend.get(m.id)?.reject(new Error(m.error))
          pend.delete(m.id)
          break
      }
    }
    worker.postMessage({ type: 'init' } satisfies WorkerIn)
    return () => {
      worker.terminate()
      pend.clear()
    }
  }, [])

  const convert = useCallback(async (file: File) => {
    const data = new Uint8Array(await file.arrayBuffer())
    const id = nextId.current++
    return new Promise<string>((resolve, reject) => {
      pending.current.set(id, { resolve, reject })
      workerRef.current?.postMessage(
        { type: 'convert', id, name: file.name, data } satisfies WorkerIn,
        [data.buffer],
      )
    })
  }, [])

  return { status, ready, fatal, warnings, convert }
}
