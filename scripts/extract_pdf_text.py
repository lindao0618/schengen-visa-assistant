#!/usr/bin/env python3

import json
import sys
from typing import Callable


def _extract_with_fitz(pdf_path: str) -> str:
    import fitz  # type: ignore

    doc = fitz.open(pdf_path)
    try:
        pages = []
        for page in doc:
            blocks = []
            for block in page.get_text("blocks", sort=True):
                text = str(block[4]).strip()
                if not text:
                    continue
                normalized = " ".join(line.strip() for line in text.splitlines() if line.strip())
                if normalized:
                    blocks.append(normalized)
            pages.append("\n".join(blocks))
        return "\n".join(pages).strip()
    finally:
        doc.close()


def _extract_with_pypdf(pdf_path: str) -> str:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
        if normalized:
            pages.append(normalized)
    return "\n".join(pages).strip()


def _run_first_available(pdf_path: str) -> str:
    extractors: list[tuple[str, Callable[[str], str]]] = []

    try:
        import fitz  # noqa: F401

        extractors.append(("fitz", _extract_with_fitz))
    except Exception:
        pass

    try:
        import pypdf  # noqa: F401

        extractors.append(("pypdf", _extract_with_pypdf))
    except Exception:
        pass

    if not extractors:
        raise RuntimeError("缺少 PDF 文本提取依赖，请安装 PyMuPDF 或 pypdf")

    last_error: Exception | None = None
    for _, extractor in extractors:
        try:
            text = extractor(pdf_path)
            if text:
                return text
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    return ""


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "missing_pdf_path"}))
        return 1

    pdf_path = sys.argv[1]

    try:
        text = _run_first_available(pdf_path)
        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
