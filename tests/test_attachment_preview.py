import inspect
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from openpyxl import Workbook

import main
import document_pipeline


class AttachmentPreviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(main, "ATTACHMENTS_DIR", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def preview(self, filename, **metadata):
        attachment = {"id": "attachment", "filename": filename, "stored_path": f"/attachments/{filename}", **metadata}
        record = {"meta": {"output_filename_base": "audit", "attachments": [attachment]}}
        with patch.object(main, "load_records", return_value=[record]), patch.object(main, "save_records"):
            return main.preview_record_attachment("attachment", "audit")

    def test_text_preview_decodes_korean_legacy_encoding(self):
        (self.root / "mail.txt").write_bytes("한글 연락 이력".encode("cp949"))
        result = self.preview("mail.txt")
        self.assertEqual(result["preview_type"], "text")
        self.assertEqual(result["text"], "한글 연락 이력")

    def test_excel_preview_includes_sheet_names_and_cells(self):
        workbook = Workbook()
        workbook.active.title = "Assays"
        workbook.active.append(["Study", "Result"])
        workbook.active.append(["ADMET", "Complete"])
        workbook.save(self.root / "data.xlsx")
        workbook.close()
        result = self.preview("data.xlsx")
        self.assertEqual(result["preview_type"], "text")
        self.assertIn("[Sheet Assays]", result["text"])
        self.assertIn("ADMET | Complete", result["text"])

    def test_corrupt_office_files_fall_back_to_download(self):
        for suffix in ("xlsx", "docx", "pptx"):
            with self.subTest(suffix=suffix):
                filename = "broken." + suffix
                (self.root / filename).write_bytes(b"not an office archive")
                with patch.object(document_pipeline, "convert_office_to_pdf", return_value={"status": "failed", "pdf_path": None}):
                    result = self.preview(filename)
                self.assertEqual(result["preview_type"], "unsupported")
                self.assertEqual(result["url"], f"/attachments/{filename}")

    def test_office_text_fallback_does_not_require_libreoffice(self):
        for suffix, member in (("docx", "word/document.xml"), ("pptx", "ppt/slides/slide1.xml")):
            with self.subTest(suffix=suffix):
                filename = "report." + suffix
                with zipfile.ZipFile(self.root / filename, "w") as archive:
                    archive.writestr(member, '<root xmlns:w="urn:test"><w:t>Audit material</w:t></root>')
                with patch.object(document_pipeline, "convert_office_to_pdf", return_value={"status": "unavailable", "pdf_path": None}):
                    result = self.preview(filename)
                self.assertEqual(result["preview_type"], "text")
                self.assertIn("Audit material", result["text"])

    def test_missing_cached_office_pdf_is_regenerated(self):
        (self.root / "report.docx").write_bytes(b"fixture")
        replacement = self.root / "replacement.pdf"
        replacement.write_bytes(b"%PDF-fixture")
        with patch.object(document_pipeline, "convert_office_to_pdf", return_value={"pdf_path": str(replacement)}) as converter:
            result = self.preview("report.docx", preview_pdf_path="/attachments/deleted.pdf")
        converter.assert_called_once()
        self.assertEqual(result["preview_type"], "pdf")
        self.assertEqual(result["url"], "/attachments/replacement.pdf")

    def test_legacy_excel_uses_office_conversion(self):
        (self.root / "data.xls").write_bytes(b"fixture")
        converted = self.root / "sheet.pdf"
        converted.write_bytes(b"%PDF-fixture")
        with patch.object(document_pipeline, "convert_office_to_pdf", return_value={"pdf_path": str(converted)}):
            result = self.preview("data.xls")
        self.assertEqual(result["preview_type"], "pdf")

    def test_missing_file_returns_not_found(self):
        with self.assertRaises(HTTPException) as failure:
            self.preview("missing.pdf")
        self.assertEqual(failure.exception.status_code, 404)

    def test_blocking_preview_work_runs_in_fastapi_worker_thread(self):
        self.assertFalse(inspect.iscoroutinefunction(main.preview_record_attachment))

    def test_converter_failures_are_reported_without_escaping(self):
        for error in (OSError("converter unavailable"), subprocess.TimeoutExpired("soffice", 180)):
            with self.subTest(error=type(error).__name__):
                with patch.object(document_pipeline, "find_libreoffice", return_value=Path("soffice")), patch.object(document_pipeline.subprocess, "run", side_effect=error):
                    result = document_pipeline.convert_office_to_pdf(self.root / "report.docx")
                self.assertEqual(result["status"], "failed")
                self.assertIsNone(result["pdf_path"])
