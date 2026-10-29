"""Runs inside Pyodide after packages are installed.

Why the stub: markitdown imports `magika` at module load, and magika needs
`onnxruntime`, which has no Pyodide/WASM wheel. magika is only used to GUESS
file type from content. We always know the extension from the file name, so a
stub whose guess is "error" makes markitdown fall back to extension-based
detection (see MarkItDown._get_stream_info_guesses).
"""
import sys
import types


def _install_magika_stub():
    mod = types.ModuleType("magika")

    class _Result:
        status = "error"  # != "ok" -> markitdown uses the extension guess only

    class Magika:
        def __init__(self, *args, **kwargs):
            pass

        def identify_stream(self, stream):
            return _Result()

        def identify_bytes(self, data):
            return _Result()

        def identify_path(self, path):
            return _Result()

    mod.Magika = Magika
    sys.modules["magika"] = mod


_install_magika_stub()

from markitdown import MarkItDown  # noqa: E402

_md = MarkItDown(enable_plugins=False)


def convert(path: str) -> str:
    return _md.convert_local(path).markdown
