import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "src" / "app.js").read_text(encoding="utf-8")


def function_body(source: str, name: str) -> str:
    marker = f"function {name}("
    start = source.index(marker)
    signature_end = source.index(") {", start)
    brace = signature_end + 2
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[brace + 1:index]
    raise AssertionError(f"Unclosed function: {name}")


class ListingImportFeedbackTests(unittest.TestCase):
    def test_successful_http_response_requires_a_confirmed_listing_result(self):
        body = function_body(JS, "listingImportJsonResponse")
        self.assertIn("payload.ok === true", body)
        self.assertIn("서버가 Listing 저장 결과를 확인할 수 없는 형식", body)

    def test_progress_loader_can_report_refresh_failure_to_the_save_flow(self):
        body = function_body(JS, "loadStep0Progress")
        self.assertIn("async function loadStep0Progress({ renderOnlyWhenChanged = false, throwOnError = false } = {})", JS)
        self.assertIn("if (throwOnError) throw error;", body)

    def test_import_separates_saved_data_from_follow_up_table_refresh(self):
        body = function_body(JS, "importStep0Candidates")
        self.assertIn("const refreshed = await refreshListingProgressAfterSave({", body)
        self.assertIn("title: 'Listing 저장은 완료되었습니다'", body)
        self.assertIn("showListingImportRefreshDialog", body)

    def test_cancelled_save_prompts_for_result_reconciliation(self):
        body = function_body(JS, "importStep0Candidates")
        self.assertIn("title: '저장 취소를 요청했습니다'", body)
        self.assertIn("actionLabel: '저장 결과 확인'", body)
        self.assertIn("취소 요청 뒤 최신 Pipeline Table을 불러왔습니다", body)

    def test_stale_review_choice_is_explained_as_a_refreshable_conflict(self):
        body = function_body(JS, "listingImportFailureCopy")
        self.assertIn("status === 409", body)
        self.assertIn("Listing 목록이 변경되어 다시 확인이 필요합니다", body)
        self.assertIn("action: 'refresh'", body)


if __name__ == "__main__":
    unittest.main()
