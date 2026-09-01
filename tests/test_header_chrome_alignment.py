import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STYLES = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")
ONBOARDING_STYLES = (ROOT / "src" / "onboarding.css").read_text(encoding="utf-8")
DETAIL_HTML = (ROOT / "detail.html").read_text(encoding="utf-8")


class HeaderChromeAlignmentTests(unittest.TestCase):
    def test_onboarding_uses_the_dashboard_navy(self):
        self.assertIn("--ob-navy: #0b1426;", ONBOARDING_STYLES)
        self.assertIn("background: var(--ob-navy);", ONBOARDING_STYLES)

    def test_dashboard_brand_line_matches_onboarding_inset_and_icon_size(self):
        alignment = STYLES[STYLES.rindex("/* Keep the Dashboard's wide-screen product bar"):]
        self.assertIn("padding-inline: clamp(24px, 4vw, 64px);", alignment)
        self.assertIn("@media (min-width: 1281px)", alignment)
        self.assertIn("height: 64px;", alignment)
        self.assertIn("min-height: 64px;", alignment)
        self.assertIn("padding-block: 10px;", alignment)
        self.assertIn("min-height: 44px;", alignment)
        self.assertIn(".brand-prism-icon", alignment)
        self.assertIn("width: 20px;", alignment)
        self.assertIn("height: 20px;", alignment)
        self.assertIn("border-inline-width: 0;", alignment)
        self.assertIn("@media (max-width: 820px)", alignment)
        self.assertIn("padding-inline: 18px;", alignment)

    def test_detail_header_uses_the_triage_gpt_workflow_label_style(self):
        header = DETAIL_HTML[DETAIL_HTML.index('<header class="topbar">'):]
        header = header.split("</header>", 1)[0]
        self.assertIn('<p class="eyebrow">GPT 2 · Full Scout</p>', header)
        self.assertNotIn("detail-brand-lockup", header)


if __name__ == "__main__":
    unittest.main()
