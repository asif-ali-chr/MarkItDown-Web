# MarkItDown in the browser (React + Vite + Pyodide)
# MarkItDown Web

Browser-based file-to-Markdown converter built with React, Vite and
[Microsoft MarkItDown](https://github.com/microsoft/markitdown) running on
[Pyodide](https://pyodide.org) (Python in WebAssembly).

- 100% client-side: no server, no uploads
- Supports PDF, DOCX, PPTX, XLSX/XLS, CSV, HTML, JSON, XML, EPUB, ZIP, TXT
- Conversion runs in a Web Worker, so the UI stays responsive
- Works around Pyodide's missing `onnxruntime` wheel by stubbing `magika`
  (file type comes from the extension)

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — host anywhere (no backend)
```

## How it works
- `src/worker/pyodide.worker.ts` loads Pyodide in a Web Worker (UI never freezes).
- Native wheels come from the Pyodide index (`lxml`, `pandas`, `pillow`, ...).
- `markitdown` is installed with `micropip` using `deps=False`, then its pure-Python
  deps are installed one by one.
- `src/worker/bootstrap.py` stubs the `magika` module (needs `onnxruntime`, no WASM wheel).
  File type is taken from the file extension instead.
- `pdfplumber` is installed with `deps=False` (its `pypdfium2` dep has no WASM wheel; not needed for text/tables).

## Not supported in browser
Images (EXIF/OCR via external binary / LLM), audio transcription, YouTube / URL fetch (CORS), Azure Document Intelligence.
