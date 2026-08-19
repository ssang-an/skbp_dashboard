from __future__ import annotations

import unittest

import main


class DashboardFilterScrollUxTests(unittest.TestCase):
    def test_main_indication_uses_the_standard_multi_select_control(self):
        markup = (main.ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('<div id="indicationFilter" class="filter-multiselect" data-filter-key="indication">', markup)
        self.assertIn('id="indicationFilterMenu"', markup)
        self.assertIn('aria-multiselectable="true"', markup)

    def test_indication_filter_keeps_all_option_and_filters_selected_values(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("indication: []", source)
        self.assertIn('data-multi-filter-value="all"', source)
        self.assertIn("selectedFilterValues(state.indication).some", source)
        self.assertIn("function renderMultiFilter", source)

    def test_priority_list_is_the_only_summary_body_with_vertical_scrolling(self):
        source = (main.ROOT / "src" / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".workflow-summary-grid > .panel > .priority-list {\n  min-height: 0;\n  overflow: hidden;", source)
        self.assertIn(".workflow-summary-grid > .panel > .workflow-priority-list {\n  align-content: start;\n  min-height: 0;\n  height: 100%;", source)
        self.assertIn("overflow-y: scroll;", source)
        self.assertIn("scrollbar-gutter: stable;", source)
        self.assertIn("max-height: 230px;", source)

        markup = (main.ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="workflowPriorityList" role="region" tabindex="0"', markup)

    def test_priority_lists_sort_by_latest_update_before_limiting_to_ten(self):
        source = (main.ROOT / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("b.completed_at || b.generated_at", source)
        self.assertIn("b.action_updated_at || b.completed_at", source)
        self.assertIn("visibleRows.slice(0, 10)", source)


if __name__ == "__main__":
    unittest.main()
