from __future__ import annotations

import unittest

import main


class DashboardFilterScrollUxTests(unittest.TestCase):
    def test_main_indication_uses_the_standard_single_select_control(self):
        markup = (main.ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('<select id="indicationFilter" aria-label="Main indication">', markup)
        self.assertNotIn('<select id="indicationFilter" multiple', markup)

    def test_indication_filter_keeps_all_option_and_filters_one_selected_value(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("indication: 'all'", source)
        self.assertIn("'<option value=\"all\">전체</option>'", source)
        self.assertIn("state.indication = event.target.value", source)
        self.assertIn("row.indicationList.includes(state.indication)", source)

    def test_priority_list_is_the_only_summary_body_with_vertical_scrolling(self):
        source = (main.ROOT / "src" / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".workflow-summary-grid > .panel > .priority-list {\n  min-height: 0;\n  overflow: hidden;", source)
        self.assertIn(".workflow-summary-grid > .panel > .workflow-priority-list {\n  max-height: none;", source)
        self.assertIn("overflow-y: auto;", source)
        self.assertIn("max-height: 230px;", source)

    def test_priority_lists_sort_by_latest_update_before_limiting_to_ten(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("b.completed_at || b.generated_at", source)
        self.assertIn("b.action_updated_at || b.completed_at", source)
        self.assertIn("visibleRows.slice(0, 10)", source)


if __name__ == "__main__":
    unittest.main()
