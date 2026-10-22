"""Agent 1 - Reader: PDF -> text. Falls back to OCR for scanned documents."""
from __future__ import annotations

import warnings

from .base import BaseAgent, Context, normalize

MIN_CHARS_PER_DOC = 200


class ReaderAgent(BaseAgent):
    name = "reader"

    def run(self, ctx: Context, llm=None) -> dict:  # no LLM needed
        import pymupdf

        with pymupdf.open(ctx.path) as doc:
            pages = [page.get_text("text") for page in doc]
            ocr_note = None
            has_images = any(page.get_images() for page in doc)
            # Only OCR when there is little real text AND the pages are pictures (a scan).
            if sum(len(p.strip()) for p in pages) < MIN_CHARS_PER_DOC and has_images:
                pages, ocr_note = self._ocr(doc, ctx)

        text = "\n\f\n".join(pages)
        if len(text.strip()) < 40:
            raise ValueError(ocr_note or "No extractable text in PDF")

        ctx.pages = pages
        ctx.text = text
        ctx.norm = normalize(text)
        note = f"{len(pages)} page(s), {len(ctx.norm):,} chars" + (" (OCR)" if ctx.ocr_used else "")
        return {"mode": "ocr" if ctx.ocr_used else "text", "note": note}

    def _ocr(self, doc, ctx: Context) -> tuple[list[str], str | None]:
        try:
            import io

            import pytesseract
            from PIL import Image

            pytesseract.get_tesseract_version()  # raises if the binary is missing
        except Exception:  # noqa: BLE001
            msg = "Scanned PDF and OCR is unavailable (install the tesseract binary + pytesseract)."
            ctx.warnings.append(msg)
            return [""] * len(doc), msg

        pages = []
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for page in doc:
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                pages.append(pytesseract.image_to_string(img))
        ctx.ocr_used = True
        return pages, None
