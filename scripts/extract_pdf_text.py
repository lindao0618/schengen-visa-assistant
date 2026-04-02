#!/usr/bin/env python3

import json
import sys

import fitz


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "missing_pdf_path"}))
        return 1

    pdf_path = sys.argv[1]

    try:
        doc = fitz.open(pdf_path)
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
        text = "\n".join(pages).strip()
        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
