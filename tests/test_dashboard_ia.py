import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
DETAIL_HTML = (ROOT / "detail.html").read_text(encoding="utf-8")
DETAIL_JS = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
TRIAGE_DETAIL_HTML = (ROOT / "triage_detail.html").read_text(encoding="utf-8")
TRIAGE_DETAIL_JS = (ROOT / "src" / "triage-detail.js").read_text(encoding="utf-8")
JS = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
CSS = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")


def function_body(source: str, name: str) -> str:
    marker = f"function {name}("
    start = source.index(marker)
    brace = source.index("{", start)
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[brace + 1:index]
    raise AssertionError(f"Unclosed function: {name}")


class DashboardInformationArchitectureTests(unittest.TestCase):
    def test_header_action_pills_use_restrained_semantic_palette(self):
        palette = CSS[CSS.index("/* Soft-bright semantic header palette") : CSS.index("/* Match response copy/full-view")]
        self.assertIn("#criteriaDrawerButton", palette)
        self.assertIn("#triageCriteriaDrawerButton { --header-pill-rgb: 214, 178, 113; }", palette)
        self.assertIn("#dataUploadShortcutButton { --header-pill-rgb: 88, 178, 166; }", palette)
        self.assertIn("#copyPromptTopButton { --header-pill-rgb: 170, 151, 205; }", palette)
        self.assertIn("#editJsonButton { --header-pill-rgb: 148, 158, 205; }", palette)
        self.assertIn(".theme-toggle { --header-pill-rgb: 108, 181, 187; }", palette)
        self.assertIn("#triageDeleteRecordButton { --header-pill-rgb: 214, 127, 139; }", palette)
        self.assertIn("rgba(var(--header-pill-rgb), 0.14)", palette)

    def test_ai_qualitative_entries_use_soft_green_without_left_accent(self):
        section = CSS[CSS.index(".qualitative-ai-badge {") : CSS.index(".qualitative-add-criterion {")]
        badge = section[: section.index(".qualitative-entry > p")]
        ai_entry = section[section.index(".qualitative-entry.is-ai {") :]
        self.assertIn("#42b883 10%", badge)
        self.assertNotIn("#7c5cce", badge)
        self.assertNotIn("#5135a6", badge)
        self.assertIn("#42b883 8%", ai_entry)
        self.assertNotIn("border-left", ai_entry)

    def test_qualitative_ai_actions_use_matching_star_icon_tooltips(self):
        panel = function_body(DETAIL_JS, "renderQualitativeReview")
        criterion = function_body(DETAIL_JS, "renderQualitativeCriterionSection")
        self.assertIn('class="qualitative-ai-generate-all-button help-tooltip"', panel)
        self.assertIn('data-tooltip="전체 AI 생성"', panel)
        self.assertIn('aria-label="전체 AI 생성"', panel)
        self.assertIn('<span aria-hidden="true">✨</span>', panel)
        self.assertNotIn('>✨ 전체 AI 생성</button>', panel)
        self.assertIn('class="qualitative-ai-generate-button help-tooltip"', criterion)
        self.assertIn('data-tooltip="AI 생성"', criterion)
        self.assertIn('aria-label="AI 생성"', criterion)
        self.assertIn('<span aria-hidden="true">✨</span>', criterion)
        self.assertNotIn('>✨ AI 생성</button>', criterion)

        single_generation = function_body(DETAIL_JS, "generateQualitativeAiOpinion")
        all_generation = function_body(DETAIL_JS, "generateAllQualitativeAiOpinions")
        self.assertNotIn("button.textContent = 'AI 생성 중…'", single_generation)
        self.assertNotIn("button.textContent = `AI 생성 중", all_generation)
        self.assertIn("button.dataset.tooltip = 'AI 생성 중…'", single_generation)
        self.assertIn("button.dataset.tooltip = `전체 AI 생성 중", all_generation)

        controls = CSS[CSS.index("Qualitative AI actions use one stable icon-only geometry") :]
        self.assertIn("width: 28px", controls)
        self.assertIn("min-width: 28px", controls)
        self.assertIn("height: 28px", controls)
        self.assertIn("min-height: 28px", controls)
        button_rule = controls[: controls.index(".qualitative-ai-generate-all-button:hover")]
        self.assertIn("border: 0", button_rule)
        self.assertIn("border-radius: 0", button_rule)
        self.assertIn("background: transparent", button_rule)
        self.assertIn("box-shadow: none", button_rule)
        hover_rule = controls[
            controls.index(".qualitative-ai-generate-all-button:hover") :
            controls.index(".qualitative-ai-generate-all-button.help-tooltip::after")
        ]
        self.assertIn("background: transparent", hover_rule)
        self.assertIn("filter: brightness(1.08)", hover_rule)
        self.assertIn("transform: scale(1.08)", hover_rule)
        self.assertIn("width: max-content", controls)
        self.assertIn("content: attr(data-tooltip)", CSS)
    def test_all_agent_response_actions_use_compact_right_aligned_icon_tooltips(self):
        message = JS[JS.index("function addAgentMessage") : JS.index("let activeAgentResponseText")]
        self.assertIn("help-tooltip", message)
        self.assertIn("data-tooltip=\"복사\"", message)
        self.assertIn("data-tooltip=\"전체보기\"", message)
        self.assertIn("<svg", message)

        detail_message = DETAIL_JS[DETAIL_JS.index("function addMessage") : DETAIL_JS.index("function sourceLabel")]
        self.assertIn("agent-message-actions", detail_message)
        self.assertIn("help-tooltip", detail_message)
        self.assertIn('data-tooltip="복사"', detail_message)
        self.assertIn('data-tooltip="전체보기"', detail_message)
        self.assertIn("<svg", detail_message)
        self.assertNotIn("agent-message-header-actions", detail_message)
        self.assertNotIn("agent-message-open-window", detail_message)

        actions = CSS[CSS.rindex(".agent-message-actions button {") :]
        self.assertIn("position: absolute", CSS[CSS.index(".agent-message-actions {") :])
        self.assertIn("right: 8px", CSS[CSS.index(".agent-message-actions {") :])
        self.assertIn("width: 28px", actions)
        self.assertIn("min-width: 28px", actions)
        self.assertIn("height: 28px", actions)
        self.assertIn("border: 0", actions)
        self.assertIn("background: transparent", actions)
        self.assertIn("box-shadow: none", actions)
        self.assertIn("width: 15px", actions)
        self.assertIn("stroke-width: 1.8", actions)
        self.assertIn("background: var(--surface-soft)", actions)
        self.assertIn("color: var(--accent)", actions)
        self.assertIn(".agent-message-actions .help-tooltip::after", CSS)
        self.assertIn("content: attr(data-tooltip)", CSS)

    def test_dashboard_agent_uses_tab_and_filter_scope_label(self):
        self.assertIn('<p class="eyebrow">현재 탭·필터 전체</p>', HTML)
        self.assertNotIn('비교 모드 ·', HTML)
        self.assertNotIn('<p class="eyebrow">Obsidian + Agentic Search</p>', HTML)
        self.assertIn('<h2 id="aiDrawerTitle">All Pipelines Agent</h2>', HTML)
        launcher = HTML[HTML.index('id="aiDrawerButton"') - 40 : HTML.index('id="aiDrawerButton"') + 500]
        self.assertIn("hidden", launcher)
        identity = function_body(JS, "renderAgentIdentity")
        self.assertIn("activeTableMode() !== 'triage'", identity)
        self.assertIn("const title = 'All Pipelines Agent'", identity)
        self.assertNotIn("Pipeline Discovery Agent", HTML)
        self.assertNotIn("Pipeline Discovery Agent", JS)
        self.assertIn("elements.aiDrawerButton.hidden = !isAvailable", identity)
        self.assertIn("floatingAgentController?.close()", identity)
        self.assertIn("setAttribute('aria-label', title)", identity)
        self.assertNotIn("후보 선별 Agent", identity)
        self.assertNotIn("집중 관리 Agent", identity)
        submit = JS[JS.index("elements.agentForm.addEventListener('submit'") :]
        self.assertIn("if (activeTableMode() === 'triage') return", submit)
        context = function_body(JS, "buildDashboardAgentContext")
        for field in (
            "oi_partnership=",
            "action_plan=",
            "focus_note=",
            "team_review_count=",
            "latest_team_review=",
        ):
            self.assertIn(field, context)

    def test_floating_agent_window_controls_share_centered_svg_geometry(self):
        for markup in (HTML, DETAIL_HTML):
            self.assertEqual(markup.count('class="floating-agent-window-icon"'), 3)
            self.assertIn('<path d="M5 12h14" />', markup)
            self.assertIn('<rect x="5" y="5" width="14" height="14" rx="1.5" />', markup)
            self.assertIn('<path d="m6 6 12 12M18 6 6 18" />', markup)
        controls = CSS[CSS.index(".floating-agent-window-actions {") :]
        self.assertIn("align-items: center", controls.split("}", 1)[0])
        icon = controls[controls.index(".floating-agent-window-icon {") :]
        self.assertIn("place-items: center", icon.split("}", 1)[0])
        svg = controls[controls.index(".floating-agent-window-icon svg {") :]
        self.assertIn("width: 15px", svg.split("}", 1)[0])
        self.assertIn("height: 15px", svg.split("}", 1)[0])

    def test_expanded_summary_heading_has_no_top_or_side_lines(self):
        heading = CSS[CSS.index("Hide the top and side lines around only the expanded Summary Dashboard") :]
        self.assertIn('.visual-dashboard-toggle-bar[aria-expanded="true"]', heading)
        self.assertIn('.visual-dashboard-toggle-bar[aria-expanded="true"]:hover', heading)
        self.assertIn("border-top-color: transparent", heading)
        self.assertIn("border-right-color: transparent", heading)
        self.assertIn("border-left-color: transparent", heading)
        self.assertIn("Continue the expanded heading surface without a second outer rectangle", heading)
        self.assertIn('.visual-dashboard-toggle-bar[aria-expanded="true"] + .workflow-summary-grid', heading)
        self.assertIn("border-bottom-color: transparent", heading)
        self.assertNotIn(".workflow-summary-grid > .panel:hover", heading)
        self.assertNotIn(".summary-grid .workflow-metric", heading)

    def test_summary_subtitles_do_not_repeat_chart_type(self):
        self.assertIn('<small id="summaryScopeNote">현재 Tab·Filter 기준</small>', HTML)
        self.assertIn("'현재 Tab·Filter 기준'", JS)
        self.assertNotIn("현재 Tab,Filter 기준", HTML)
        self.assertNotIn("현재 Tab,Filter 기준", JS)
        self.assertIn('id="indicationSummarySubtitle">현재 탭 전체 asset · 적응증 6개 · Others</span>', HTML)
        self.assertIn('id="modalitySummarySubtitle">상위 6개 · 나머지는 Others</span>', HTML)
        self.assertIn("'현재 탭 전체 asset · 적응증 6개 · Others'", JS)
        self.assertIn("`Filter 결과 ${distributionAssets}개 · 적응증 6개 · Others`", JS)
        self.assertIn("mode === 'full'", JS)
        self.assertIn("'상위 6개 · 나머지와 Unknown은 Others'", JS)
        self.assertNotIn("· 파이차트", HTML)
        self.assertNotIn("· 파이차트", JS)

    def test_tab1_and_tab2_tr_groups_have_subtle_frames(self):
        self.assertEqual(HTML.count('aria-label="Target Relevance priority indications and themes"'), 2)
        tr_group_styles = CSS[CSS.index("Gently frame the three TR indication/theme groups") :]
        self.assertIn(".target-parameter-card > .parameter-evidence-list > li", tr_group_styles)
        self.assertIn("border: 1px solid color-mix", tr_group_styles)
        self.assertIn("var(--line) 62%", tr_group_styles)
        self.assertIn("border-radius: 10px", tr_group_styles)

    def test_detail_judgment_and_delete_actions_match_dashboard_pills(self):
        judgment = DETAIL_HTML[DETAIL_HTML.index('id="criteriaDrawerButton"'):]
        delete = DETAIL_HTML[DETAIL_HTML.index('id="deleteRecordButton"'):]
        self.assertIn('class="detail-header-action-pill help-tooltip"', judgment)
        self.assertIn('detail-header-delete-pill', delete)
        self.assertIn('<svg viewBox="0 0 24 24"', delete)
        self.assertNotIn('id="detailStatus"', DETAIL_HTML)
        self.assertNotIn("elements.status.textContent = 'Loaded'", DETAIL_JS)
        detail_action_styles = CSS[CSS.index("Detail header actions use the same pill") :]
        self.assertIn("border-radius: 999px", detail_action_styles)
        self.assertIn("border-radius: 50%", detail_action_styles)
        self.assertIn("flex: 0 0 22px", detail_action_styles)

    def test_team_comment_favorite_uses_clean_borderless_svg_circle(self):
        favorite = DETAIL_HTML[
            DETAIL_HTML.index('id="detailFocusToggle"') :
            DETAIL_HTML.index('id="detailCommentCount"')
        ]
        self.assertIn('class="focus-star-icon"', favorite)
        self.assertIn('<svg', favorite)
        self.assertNotIn('>☆<', favorite)
        self.assertNotIn('>★<', favorite)

        collaboration = function_body(DETAIL_JS, "renderCollaborationPanel")
        self.assertIn("classList.toggle('add', !tracked)", collaboration)
        self.assertIn("classList.toggle('remove', tracked)", collaboration)
        self.assertNotIn("detailFocusToggle.innerHTML", collaboration)

        styles = CSS[CSS.index("Review workspace favorite matches the adjacent borderless circular badge") :]
        self.assertIn("width: 30px", styles)
        self.assertIn("height: 30px", styles)
        self.assertIn("border: 0", styles)
        self.assertIn("border-radius: 999px", styles)
        self.assertIn(".focus-star-icon", styles)
        self.assertIn("fill: none", styles)
        self.assertIn("stroke-width: 1.7", styles)
        self.assertIn("fill: currentColor", styles)
    def test_workflow_navigation_is_connected_inside_header(self):
        home = HTML.index('class="topbar-home-link"')
        header_end = HTML.index("</header>")
        navigation = HTML.index('class="workflow-navigation-shell"')
        actions = HTML.index('class="top-actions"')
        main = HTML.index('<main id="pipelineContent"')
        self.assertLess(home, navigation)
        self.assertLess(navigation, actions)
        self.assertLess(navigation, header_end)
        self.assertLess(header_end, main)
        for mode in ("triage", "full", "focus"):
            self.assertIn(f'data-table-mode="{mode}"', HTML)

    def test_header_data_upload_shortcut_uses_current_tab_upload_panel(self):
        primary_group = re.search(
            r'<div class="top-action-group top-primary-actions".*?</div>',
            HTML,
            re.S,
        )
        self.assertIsNotNone(primary_group)

        data_group = re.search(
            r'<div class="top-action-group top-data-actions".*?</div>',
            HTML,
            re.S,
        )
        self.assertIsNotNone(data_group)
        self.assertIn('id="refreshButton"', primary_group.group(0))
        self.assertLess(primary_group.group(0).index('id="refreshButton"'), primary_group.group(0).index('id="criteriaDrawerButton"'))
        self.assertNotIn('id="copyTriagePromptTopButton"', primary_group.group(0))
        self.assertNotIn('id="copyPromptTopButton"', primary_group.group(0))
        self.assertNotIn('id="refreshButton"', data_group.group(0))
        self.assertIn('id="copyTriagePromptTopButton"', data_group.group(0))
        self.assertIn('id="copyPromptTopButton"', data_group.group(0))
        self.assertLess(data_group.group(0).index('id="copyPromptTopButton"'), data_group.group(0).index('id="dataUploadShortcutButton"'))
        self.assertIn('id="dataUploadShortcutButton"', data_group.group(0))
        self.assertIn('PIPELINE 업로드', data_group.group(0))
        self.assertIn('aria-label="PIPELINE 업로드"', data_group.group(0))
        self.assertNotIn('GPT 결과 업로드', data_group.group(0))
        self.assertIn('aria-controls="dataUploadPanel"', data_group.group(0))
        self.assertNotIn('data-status-segment', data_group.group(0))
        self.assertEqual(data_group.group(0).count('<svg viewBox="0 0 24 24"'), 1)
        brand_group = re.search(r'<div class="topbar-brand-cluster">.*?</div>', HTML, re.S)
        self.assertIsNotNone(brand_group)
        self.assertIn('class="brand-record-status"', brand_group.group(0))
        self.assertIn('id="dataStatus"', brand_group.group(0))
        self.assertIn('class="top-action-group top-personal-actions"', HTML)
        self.assertIn('class="panel paste-panel" id="dataUploadPanel"', HTML)
        triage_prompt_button = re.search(r'<button\s+id="copyTriagePromptTopButton".*?</button>', HTML, re.S)
        self.assertIsNotNone(triage_prompt_button)
        self.assertRegex(triage_prompt_button.group(0), r'\bhidden\b')

        workflow = function_body(JS, "renderWorkflowMode")
        self.assertIn("elements.dataUploadShortcutButton.hidden = mode === 'focus'", workflow)
        self.assertIn("elements.copyTriagePromptTopButton.hidden = mode !== 'triage'", workflow)
        self.assertIn("elements.copyPromptTopButton.hidden = mode !== 'full'", workflow)
        self.assertIn("elements.dataUploadShortcutButton?.closest('.top-data-actions')", workflow)
        self.assertIn("topDataActions.hidden = mode === 'focus'", workflow)
        self.assertIn("mode === 'focus' ? summary?.kpis?.pipelines : summary?.kpis?.assets", workflow)
        self.assertIn("elements.dataStatus.textContent = `총 ${pipelineCount}건 로드됨`", workflow)

        shortcut = function_body(JS, "scrollToDataUpload")
        self.assertIn("activeTableMode() === 'focus'", shortcut)
        self.assertIn("scrollIntoView", shortcut)
        self.assertIn("behavior: reducedMotion ? 'auto' : 'smooth'", shortcut)
        self.assertIn("elements.gptResponseInput.focus({ preventScroll: true })", shortcut)
        self.assertIn("is-shortcut-highlighted", shortcut)
        self.assertIn("elements.dataUploadShortcutButton?.addEventListener('click', scrollToDataUpload)", JS)
        self.assertNotIn('elements.dataStatus.innerHTML = `<span class="data-status-count">', JS)

        criteria_button_styles = CSS[CSS.index(".topbar #criteriaDrawerButton {") : CSS.index(".topbar #copyTriagePromptTopButton {")]
        self.assertIn("border-color: rgba(148, 163, 184, 0.28)", criteria_button_styles)
        self.assertIn("background: rgba(148, 163, 184, 0.12)", criteria_button_styles)
        self.assertNotIn("251, 191, 36", criteria_button_styles)

        utility_styles = CSS[CSS.rindex("Final dashboard data utility cascade") :]
        rounded_styles = CSS[CSS.rindex("Match the data controls to the rounded Guide pill group") :]
        self.assertIn(".top-data-actions #copyTriagePromptTopButton", rounded_styles)
        self.assertIn(".top-data-actions #copyPromptTopButton", rounded_styles)
        self.assertNotIn(".top-data-actions #refreshButton", rounded_styles)
        self.assertIn("border-radius: 999px", rounded_styles)
        self.assertIn("gap: 3px", rounded_styles)
        self.assertIn("position: relative", rounded_styles)
        status_layout = CSS[CSS.rindex("Brand-adjacent record status replaces the right-side database segment") :]
        self.assertIn("grid-template-columns: minmax(360px, 1fr) minmax(380px, 520px) minmax(360px, 1.2fr)", status_layout)
        self.assertIn("grid-column: 2", rounded_styles)
        self.assertIn("max-width: 520px", rounded_styles)
        self.assertIn("grid-column: 3", rounded_styles)
        self.assertIn("transform: none", rounded_styles)
        self.assertIn(".brand-record-status", status_layout)
        self.assertIn("color: rgba(203, 213, 225, 0.62)", status_layout)
        self.assertIn("font-size: 10.5px", status_layout)
        self.assertIn("@media (max-width: 1280px) and (min-width: 721px)", utility_styles)
        self.assertIn(".top-personal-actions", utility_styles)
        self.assertIn(".paste-panel.is-shortcut-highlighted", CSS)

    def test_header_brand_is_centered_and_uses_detail_title_size(self):
        home_rule = re.search(
            r"\.app-shell:not\(\.detail-shell\).*?> \.topbar \.topbar-home-link\s*\{(.*?)\n\}",
            CSS,
            re.S,
        )
        self.assertIsNotNone(home_rule)
        self.assertIn("align-items: center", home_rule.group(1))
        title_rule = re.search(
            r"\.app-shell:not\(\.detail-shell\).*?> \.topbar \.topbar-home-link h1\s*\{(.*?)\n\}",
            CSS,
            re.S,
        )
        self.assertIsNotNone(title_rule)
        self.assertIn("font-size: clamp(15px, 1.4vw, 18px)", title_rule.group(1))
        self.assertIn("align-items: center", CSS[CSS.index(".topbar-home-link {"):])

    def test_filter_order_and_only_due_date_removed_from_common_filters(self):
        controls = re.search(r'<div class="controls">(.*?)</div>\s*</section>', HTML, re.S)
        self.assertIsNotNone(controls)
        block = controls.group(1)
        expected = [
            "searchInput",
            "countryFilter",
            "modalityFilter",
            "themeFilter",
            "clusterFilter",
            "indicationFilter",
            "stageFilter",
            "passFilter",
            "resetFiltersButton",
        ]
        positions = [block.index(f'id="{element_id}"') for element_id in expected]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn('id="dueDateFilter"', block)

    def test_summary_has_exactly_the_three_workflow_surfaces(self):
        for element_id in ("indicationChart", "modalityChart", "workflowPriorityList"):
            self.assertIn(f'id="{element_id}"', HTML)
        for removed_id in ("resultChart", "themeChart", "countryChart", "priorityList", "dueDateList"):
            self.assertNotIn(f'id="{removed_id}"', HTML)

    def test_summary_cards_share_geometry_without_internal_scrollbars(self):
        block = CSS[CSS.index("/* Precision-align Summary cards"):CSS.index(".pass-rate-chart .donut-center small")]
        self.assertRegex(block, r"\.visual-grid\.workflow-summary-grid > \.panel\s*\{[^}]*grid-template-rows: 64px minmax\(0, 1fr\);[^}]*height: 332px;")
        self.assertRegex(block, r"\.workflow-summary-grid \.donut\s*\{[^}]*width: 144px;[^}]*height: 144px;")
        self.assertRegex(block, r"\.workflow-summary-grid \.donut-wrap\s*\{[^}]*grid-template-columns: 144px minmax\(0, 190px\);[^}]*justify-content: center;")
        self.assertIn("overflow: hidden", block)
        self.assertNotIn("overflow-y: auto", block)

    def test_summary_donut_legend_keeps_values_close_to_labels(self):
        legend = CSS[CSS.index("Keep Summary donut values in a compact, left-aligned column") :]
        self.assertIn(".workflow-summary-grid .donut-legend", legend)
        self.assertIn("width: min(100%, 190px)", legend)
        self.assertIn("display: grid", legend)
        self.assertIn("grid-template-columns: minmax(0, 1fr) 28px", legend)
        self.assertIn("gap: 10px", legend)
        self.assertIn("text-align: left", legend)

    def test_triage_parameter_guide_removes_repeated_target_theme_explanations(self):
        self.assertNotIn('class="criteria-rule target-theme-note"', HTML)
        self.assertNotIn('class="criteria-theme-grid"', HTML)
        self.assertNotIn("Target Relevance — Theme / Cluster 근거", HTML)
        start = HTML.index('class="criteria-parameter-guide triage-parameter-guide')
        end = HTML.index('class="criteria-rule criteria-full-rule"', start)
        triage_parameter = HTML[start:end]
        self.assertEqual(triage_parameter.count("<h3>Parameter Guide</h3>"), 1)
        self.assertEqual(triage_parameter.count('class="criteria-parameter-heading criteria-parameter-title-row"'), 3)
        self.assertEqual(triage_parameter.count("R&amp;D Theme 1 · E/I Balance"), 1)

    def test_parameter_guides_label_rd_themes_and_clusters(self):
        self.assertEqual(HTML.count("R&amp;D Theme 1 · E/I Balance"), 2)
        self.assertEqual(HTML.count("R&amp;D Theme 2 · Neuroimmune"), 2)
        self.assertEqual(HTML.count("<span>Ion Channel</span>"), 2)
        self.assertEqual(HTML.count("<span>Glial homeostasis</span>"), 2)
        self.assertGreaterEqual(HTML.count('class="criteria-keyword-list"'), 4)

    def test_triage_moa_and_data_parameter_cards_share_row_height(self):
        self.assertRegex(CSS, r"\.triage-parameter-grid > article\s*\{[^}]*align-self: stretch;")

    def test_shortlisting_uses_star_step_instead_of_number_three(self):
        tab = re.search(
            r'<button id="focusManagementTableTab".*?</button>',
            HTML,
            re.S,
        )
        self.assertIsNotNone(tab)
        self.assertIn('class="tab-step tab-step-star"', tab.group(0))
        self.assertNotRegex(tab.group(0), r'class="tab-step"[^>]*>\s*3\s*<')
        self.assertIn('button[data-table-mode="focus"]:hover .tab-step-star', CSS)
        self.assertIn('button[data-table-mode="focus"].active .tab-step-star', CSS)
        self.assertIn('fill: #fbbf24', CSS)
        self.assertIn('stroke: #f59e0b', CSS)
        self.assertRegex(CSS, r"\.topbar-top \.workflow-navigation-shell \.pipeline-table-tabs \.tab-step,[\s\S]*?border-radius: 999px;")

    def test_table_filter_render_recalculates_summary_from_visible_rows(self):
        body = function_body(JS, "renderFilteredDashboard")
        self.assertIn("renderTable()", body)
        self.assertIn("renderMetrics()", body)
        self.assertIn("renderCharts()", body)
        active_summary = function_body(JS, "activeTabSummary")
        self.assertIn("activeSummaryFilterCount() > 0", active_summary)
        self.assertIn("fallbackTabSummary(mode, getVisibleRows(false))", active_summary)
        self.assertIn("/api/dashboard-summary", JS)

    def test_full_scout_uses_one_management_cell_for_both_actions(self):
        actions = function_body(JS, "fullScoutRowActions")
        table = function_body(JS, "renderTable")

        self.assertIn("rubricReevaluationButton(row)", actions)
        self.assertIn("focusActionButton(row, 'full')", actions)
        self.assertIn("mode === 'triage' ? plainHeader('재평가'", table)
        self.assertIn("mode === 'full' ? plainHeader('관리'", table)
        self.assertIn("mode === 'full' ? `<td class=\"focus-action-cell\">${fullScoutRowActions(row)}</td>`", table)

    def test_sortable_headers_cycle_back_to_original_row_order(self):
        sort_body = function_body(JS, "sortByColumn")
        rows_body = function_body(JS, "getVisibleRows")
        normalize_body = function_body(JS, "normalizeSortForMode")

        self.assertIn("state.sortKey = null", sort_body)
        self.assertIn("state.sortDirection = null", sort_body)
        self.assertIn("if (!state.sortKey || !state.sortDirection) return rows", rows_body)
        self.assertIn("if (!state.sortKey) return", normalize_body)
        self.assertIn("오름차순/내림차순/원본 순서", JS)

    def test_full_scout_source_and_team_review_histories_are_separated(self):
        detail_js = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        meta_body = function_body(detail_js, "renderMetaInfoBar")
        team_body = function_body(detail_js, "renderEditHistory")

        self.assertIn("sourceReportEditLabel(sourceReportEdit)", meta_body)
        self.assertIn("entry?.field !== 'source_report.raw_markdown'", team_body)
        self.assertIn("Team Review 변경 이력", team_body)
        return

        self.assertIn("entry?.field === 'source_report.raw_markdown'", meta_body)
        self.assertNotIn("entry?.source === 'dashboard_rubric_refresh'", meta_body)
        self.assertIn("GPT 원문·Score 마지막 갱신", meta_body)
        self.assertIn("entry?.field !== 'source_report.raw_markdown'", team_body)
        self.assertIn("Team Review 변경 이력", team_body)
        self.assertNotIn(".slice(-10)", team_body)

    def test_full_scout_source_report_header_is_title_only_without_theme_and_cluster(self):
        detail_js = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        source_report = function_body(detail_js, "renderSourceReport")

        self.assertIn("elements.detailViewerTitle.textContent = 'GPT ORIGINAL REPORT'", source_report)
        self.assertIn("elements.subtitle.textContent = ''", source_report)
        self.assertIn("elements.subtitle.hidden = true", source_report)
        self.assertIn("rawMarkdown", source_report)
        self.assertIn("buildReadableSourceReport(record)", source_report)
        self.assertNotIn("dashboardThemeLabel(summary.theme)", source_report)
        self.assertNotIn("dashboardClusterLabel(summary.cluster", source_report)

    def test_detail_score_chips_navigate_to_matching_source_report_heading(self):
        detail_js = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
        collaboration = function_body(detail_js, "renderCollaborationPanel")
        navigate = function_body(detail_js, "navigateToCriterionReportSection")
        scroll = function_body(detail_js, "scrollReportHeadingIntoView")

        self.assertIn('data-report-criterion=', collaboration)
        for criterion_id in (
            "target_relevance",
            "competitive_landscape",
            "moa_validity",
            "platform_attractiveness",
            "expansion_potential",
            "data_maturity",
            "marketability",
        ):
            self.assertIn(f"{criterion_id}:", detail_js)
        self.assertIn("if (activeAttachmentId) renderSourceReport(currentRecord)", navigate)
        self.assertIn("reportCriterionHeading(criterionId)", navigate)
        self.assertIn("scrollIntoView({ behavior: 'smooth', block: 'start' })", scroll)
        self.assertIn("criterion-jump-highlight", CSS)

    def test_summary_uses_sorted_indication_and_modality_bars(self):
        body = function_body(JS, "renderCharts")
        self.assertGreaterEqual(body.count("donutChart("), 2)
        self.assertIn("summary.indication_distribution", body)
        self.assertIn("summary.modality_distribution", body)
        self.assertIn(".sort((a, b) => b[1] - a[1]", body)
        self.assertIn("Number(/^Others$/i.test(a[0])) - Number(/^Others$/i.test(b[0]))", body)

    def test_shortlisting_chart_fallback_uses_only_shortlisted_pool(self):
        fallback = function_body(JS, "fallbackTabSummary")
        workflow = function_body(JS, "renderWorkflowMode")

        self.assertIn("indication_distribution: indicationDistribution(focusRows)", fallback)
        self.assertIn("modality_distribution: fallbackModalityDistribution(focusRows)", fallback)
        self.assertIn("hasFilteredRows ? 'filtered_rows' : 'shortlisted_pool'", fallback)
        self.assertIn("'현재 Tab·Filter 기준'", workflow)
        self.assertIn("'현재 탭 전체 asset · 적응증 6개 · Others'", workflow)
        self.assertNotIn("Shortlisted Pool ${distributionAssets}개 · SKBP 관심 적응증", workflow)
        self.assertIn("Shortlisted Pool ${distributionAssets}개 · 상위 6개와 Others", workflow)
        self.assertIn("`Filter 결과 ${distributionAssets}개 · 상위 6개와 Others`", workflow)
        self.assertNotIn("Full Scout 전체", workflow)

    def test_summary_dashboard_ignores_search_query_but_keeps_filters(self):
        visible = function_body(JS, "getVisibleRows")
        summary = function_body(JS, "activeTabSummary")
        summary_filters = function_body(JS, "activeSummaryFilterCount")
        self.assertIn("includeQuery ? state.query.trim().toLowerCase() : ''", visible)
        self.assertIn("activeSummaryFilterCount() > 0", summary)
        self.assertIn("getVisibleRows(false)", summary)
        self.assertNotIn("state.query", summary_filters)
        for key in ("state.modality", "state.theme", "state.cluster", "state.country", "state.indication", "state.stage", "state.pass"):
            self.assertIn(key, summary_filters)

    def test_partnership_tbd_uses_chart_only_neutral_color(self):
        body = function_body(JS, "donutChart")
        descriptions = function_body(JS, "distributionDescription")
        self.assertIn("kind === 'partnership'", body)
        self.assertIn("/^TBD$/i", body)
        self.assertIn("return DONUT_OTHERS_COLOR", body)
        self.assertIn("kind === 'partnership' && /^TBD$/i.test(value)", descriptions)
        self.assertIn("Shortlisting 후 OI Partnership 분류가 아직 이루어지지 않은 그룹입니다.", descriptions)

    def test_grouped_chart_legends_explain_their_contents_on_hover(self):
        descriptions = function_body(JS, "distributionDescription")
        donut = function_body(JS, "donutChart")
        self.assertIn("Cell Therapy와 Gene Therapy", descriptions)
        self.assertIn("Other·Unknown·N/A", descriptions)
        self.assertIn("SKBP 우선 관심 적응증 6개에 포함되지 않은 적응증과 Unknown", descriptions)
        self.assertIn('title="${escapeHtml(tooltip)}"', donut)
        self.assertNotIn('data-tooltip=', donut)
        self.assertRegex(CSS, r'\.donut-legend > span\.has-description::after\s*\{\s*content: none;')

    def test_judgment_guide_opens_as_a_centered_large_modal(self):
        self.assertIn('role="dialog" aria-modal="true"', HTML)
        self.assertIn('.ai-drawer.criteria-drawer {', CSS)
        self.assertIn('left: 50%', CSS)
        self.assertIn('width: min(1180px, calc(100vw - 48px))', CSS)
        self.assertIn('height: min(880px, calc(100dvh - 48px))', CSS)
        self.assertIn('transform: translate(-50%, -50%) scale(1)', CSS)

    def test_target_relevance_lists_render_as_keyword_chips(self):
        self.assertGreaterEqual(HTML.count('class="criteria-keyword-list"'), 6)
        self.assertIn("<span>Alzheimer's disease</span>", HTML)
        self.assertIn('<span>Ion Channel</span>', HTML)
        self.assertIn('<span>Glial homeostasis</span>', HTML)
        self.assertIn('.target-parameter-card .criteria-keyword-list > span', CSS)
        self.assertIn('border-radius: 999px', CSS)
        keyword_weight = re.search(
            r'\.target-parameter-card \.criteria-keyword-list > span\s*\{([^}]*)\}',
            CSS,
        ).group(1)
        self.assertIn('font-weight: 400', keyword_weight)
        self.assertNotIn('font-weight: 650', keyword_weight)

    def test_even_full_scout_parameter_cards_have_no_accent_top_line(self):
        self.assertRegex(
            CSS,
            r'\.full-parameter-guide \.compact-criteria-detail-grid > article:nth-child\(2n\)\s*\{[^}]*border-top: 1px solid color-mix',
        )

    def test_full_scout_parameter_guide_uses_shared_icon_card_system(self):
        start = HTML.index('class="criteria-parameter-guide full-parameter-guide')
        end = HTML.index('class="criteria-rule criteria-other-header', start)
        section = HTML[start:end]
        cards = re.findall(r'<article class="[^"]*full-parameter-card[^"]*">', section)

        self.assertEqual(len(cards), 7)
        self.assertEqual(section.count('class="criteria-parameter-heading criteria-parameter-title-row"'), 7)
        self.assertEqual(section.count('<svg viewBox="0 0 24 24"'), 7)
        self.assertEqual(section.count('parameter-card-wide'), 1)
        self.assertIn('class="target-parameter-card parameter-breakdown-card full-parameter-card"', section)
        self.assertIn('class="parameter-card-wide marketability-parameter-card parameter-horizontal-card parameter-breakdown-card full-parameter-card"', section)

        parameters = (
            ('TR', 'Target Relevance'),
            ('COMP', 'Competitive Landscape'),
            ('MoA', 'MoA Validity'),
            ('PLATFORM', 'Platform Attractiveness'),
            ('EXPANSION', 'Expansion Potential'),
            ('DATA', 'Data Maturity'),
            ('MARKET', 'Marketability'),
        )
        positions = []
        for abbreviation, title in parameters:
            token = f'<h3><b>{abbreviation}</b><span>{title}</span></h3>'
            self.assertIn(token, section)
            positions.append(section.index(token))
        self.assertEqual(positions, sorted(positions))
        self.assertIn(
            "<p>Target/MoA의 biological plausibility와 functional, independent class-level 및 asset-specific mechanism validation 수준을 평가합니다.</p>",
            section,
        )
        self.assertNotIn("작용기전이 얼마나 구체적으로 정의되어 있고", section)

        for field in (
            'similar_pipeline_count',
            'high / medium / low similarity',
            'matched dimensions',
            'shared data points',
            'differentiating data points',
            'evidence source',
        ):
            self.assertNotIn(field, section)
        self.assertNotIn('class="criteria-parameter-keywords"', section)
        self.assertNotIn('class="parameter-keywords-panel"', section)
        self.assertNotIn('<strong>KEYWORDS</strong>', section)
        self.assertIn('competitive-parameter-card full-parameter-card', section)
        self.assertIn('class="parameter-formula-panel"', section)
        self.assertIn('class="parameter-evidence-list marketability-formula-list"', section)
        self.assertEqual(section.count('class="criteria-keyword-list marketability-formula-components"'), 4)
        self.assertIn('<strong>D. Global Obtainable Peak Sales</strong>', section)
        self.assertNotIn('<strong>Global</strong>', section)
        for component in (
            'US Patient Pool',
            'Treatable Subgroup Rate',
            'Benchmark Annualized Net Price',
            'Treatment Duration Factor',
            'Competition Haircut',
            'US Obtainable Peak Sales',
            '1.5',
        ):
            self.assertIn(f'<span>{component}</span>', section)
        self.assertNotIn('Expansion Capacity Adjustment', section)

        styles = CSS[CSS.rindex("Full Scout Parameter Guide shares the Fast Triage parameter-card system") :]
        self.assertIn('grid-template-columns: repeat(2, minmax(0, 1fr))', styles)
        self.assertIn('grid-column: 1 / -1', styles)
        self.assertIn('background: var(--readable-surface)', styles)
        self.assertIn('border-radius: 11px', styles)
        self.assertIn('color: var(--text)', styles)
        self.assertIn('.marketability-parameter-card .parameter-evidence-list', styles)
        self.assertIn('.parameter-horizontal-card.full-parameter-card', styles)
        self.assertIn('grid-template-columns: minmax(0, 0.9fr) minmax(340px, 1.1fr)', styles)
        self.assertIn('border-radius: 999px', styles)
        self.assertIn('var(--criteria-section-accent) 11%', styles)
        self.assertIn('@media (max-width: 760px)', styles)
        self.assertIn('grid-template-columns: 1fr', styles)
        pair_styles = CSS[CSS.rindex("Pair Full Scout parameters two-up; Target Relevance and Marketability span both columns") :]
        self.assertIn('.target-parameter-card.full-parameter-card', pair_styles)
        self.assertIn('grid-column: 1 / -1', pair_styles)
        self.assertIn('grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(0, 1fr))', pair_styles)
        self.assertIn('.marketability-parameter-card.full-parameter-card', pair_styles)
        self.assertIn('grid-column: 1 / -1', pair_styles)
        self.assertIn('.parameter-formula-panel', pair_styles)

    def test_full_scoring_table_uses_icon_criterion_labels(self):
        start = HTML.index('class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full"')
        end = HTML.index('class="criteria-parameter-guide full-parameter-guide', start)
        scoring = HTML[start:end]
        self.assertEqual(scoring.count('class="criteria-table-criterion"'), 7)
        for abbreviation, label in (
            ("TR", "Target Relevance"),
            ("COMP", "Competitive Landscape"),
            ("MoA", "MoA Validity"),
            ("PLATFORM", "Platform Attractiveness"),
            ("EXPANSION", "Expansion Potential"),
            ("DATA", "Data Maturity"),
            ("MARKET", "Marketability"),
        ):
            self.assertIn(f'<b>{abbreviation}</b>{label}', scoring)
        full_table_styles = CSS[CSS.index('.criteria-scoring-section[data-criteria-tab="full"] .criteria-table tbody th {') :]
        self.assertIn("var(--criteria-section-accent) 3%", full_table_styles)
        self.assertIn("border-radius: 50%", full_table_styles)
        self.assertIn('.marketability-formula-list > li', CSS)
        self.assertIn('.marketability-formula-components > span', CSS)
        marketability_component_styles = re.search(
            r'\.marketability-formula-components > span \{(.*?)\}',
            CSS,
            re.S,
        ).group(1)
        self.assertIn('font-weight: 400', marketability_component_styles)
        self.assertIn('border: 0', marketability_component_styles)
        self.assertIn('var(--criteria-tab-accent, var(--fluent-blue)) 9%', marketability_component_styles)
        self.assertIn('box-shadow: none', marketability_component_styles)

    def test_evidence_rules_are_nested_under_step_four(self):
        section = re.search(
            r'<section class="criteria-rule criteria-other-header criteria-guide-section criteria-records-section[^"]*".*?</section>',
            HTML,
            re.S,
        ).group(0)
        self.assertIn('<span class="criteria-guide-step-number" aria-hidden="true">4</span>', section)
        self.assertIn('<h3>Evidence &amp; Record Rules</h3>', section)
        self.assertIn('근거 수준과 판단 추적성을 위한 기록 원칙', section)
        self.assertIn('점수와 별도로 근거·출처·불확실성을 기록해', section)
        self.assertIn('기록해 판단 과정을', section)
        self.assertNotIn('기록해<br>판단 과정을', section)
        self.assertIn('class="criteria-records-grid criteria-records-grid-three"', section)
        self.assertIn('<h3>Evidence Type</h3>', section)
        self.assertIn('<h3>점수별 기록</h3>', section)
        self.assertIn('<h3>경쟁사 유사도</h3>', section)
        self.assertNotIn('※ 기준 설명은 <code>rubric</code>에만 유지합니다.', section)
        self.assertEqual(section.count('class="criteria-record-subcard"'), 3)
        self.assertEqual(section.count('class="criteria-record-card-heading"'), 3)
        self.assertEqual(section.count('class="criteria-record-card-helper"'), 3)
        for copy in (
            "E0</strong><span>근거 없음·평가 불가",
            "E1</strong><span>회사 주장·이론",
            "E2</strong><span>class-level·간접 근거",
            "E3</strong><span>asset-specific 전임상·기술 근거",
            "E4</strong><span>asset-specific 임상 근거",
            "Definition</strong><span>무엇을 평가하는지",
            "Rule</strong><span>선택된 점수의 핵심 조건",
            "Basis</strong><span>왜 해당 점수인지",
            "Evidence</strong><span>핵심 근거와 출처",
            "Gap</strong><span>why_not_higher 및 불확실성",
            "High</strong><span>동일 indication + target/MoA + 유사 modality",
            "Medium</strong><span>동일 indication + pathway/biology",
            "Low</strong><span>동일 indication",
            "Search Scope</strong><span>검색 범위 및 limitation",
            "Sources</strong><span>판단 근거 출처",
        ):
            self.assertIn(copy, section)
        records_style = CSS[CSS.rindex("Tab 2 evidence records use the same concise three-card rhythm") :]
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", records_style)
        self.assertIn(".criteria-record-pairs", records_style)
        self.assertIn(".criteria-record-card-heading", records_style)
        self.assertIn(".criteria-record-card-helper", records_style)

    def test_step_one_and_four_share_the_same_outer_card_style(self):
        full_status = re.search(
            r'<section class="criteria-pass-grid full-status-grid[^"]*".*?</section>',
            HTML,
            re.S,
        ).group(0)
        records = re.search(
            r'<section class="criteria-rule criteria-other-header[^"]*".*?</section>',
            HTML,
            re.S,
        ).group(0)
        self.assertIn('criteria-pass-grid full-status-grid criteria-guide-section', full_status)
        self.assertIn('criteria-rule criteria-other-header criteria-guide-section', records)
        shared_outline = CSS[CSS.index("/* Judgment card outlines mirror") : CSS.index("/* OI Partnership option boxes")]
        self.assertIn('.criteria-drawer-body > .criteria-pass-grid', shared_outline)
        self.assertIn('.criteria-drawer-body > .criteria-rule', shared_outline)
        self.assertIn("border-radius: 14px", shared_outline)
        self.assertIn("background: var(--readable-surface)", shared_outline)

    def test_fast_triage_judgment_guide_is_a_dashboard_native_reference(self):
        triage_start = HTML.index('class="criteria-rule criteria-triage-rule"')
        triage_end = HTML.index('class="criteria-rule criteria-full-rule"', triage_start)
        triage = HTML[triage_start:triage_end]
        evidence_start = HTML.index('class="criteria-rule triage-evidence-note criteria-guide-section"')
        evidence_end = HTML.index('class="criteria-rule criteria-other-header criteria-guide-section', evidence_start)
        evidence = HTML[evidence_start:evidence_end]
        scope = function_body(JS, "updateCriteriaDrawerScope")
        cosmetic = CSS[CSS.index("/* Fast Triage judgment guide"):]

        self.assertIn('id="criteriaDrawerVersionBadge"', HTML)
        self.assertIn('id="criteriaDrawerSubtitle"', HTML)
        self.assertIn('class="criteria-drawer-close"', HTML)
        self.assertIn("TAB 1 · FAST TRIAGE · SCORING GUIDE", JS)
        self.assertIn("Full Scout 검토 후보를 선별하기 위한 3-point screening 기준", JS)
        self.assertIn("LATEST_TRIAGE_RUBRIC_VERSION", scope)
        self.assertIn(".triage-evidence-note .criteria-evidence-definitions", CSS)
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", CSS)
        self.assertIn("dataset.activeCriteriaTab = mode", scope)

        for status in ("select", "reject", "unverified"):
            self.assertIn(f'data-triage-status="{status}"', triage)
        self.assertEqual(triage.count('class="criteria-status-heading"'), 3)
        self.assertNotIn('class="criteria-score-number"', triage)
        for score in ("0점", "1점", "2점", "3점"):
            self.assertIn(f'<th>{score}</th>', triage)
        for criterion in ("Target Relevance", "MoA Validity", "Data Maturity"):
            self.assertIn(f'{criterion}</span>', triage)
        self.assertEqual(triage.count('criteria-parameter-title-row'), 3)
        self.assertEqual(evidence.count('<dt><span class="criteria-guide-icon"'), 3)
        self.assertIn('<span>평가 원칙</span>', evidence)
        self.assertNotIn('[평가 원칙]', evidence)

        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", cosmetic)
        self.assertIn("min-width: 900px", cosmetic)
        self.assertIn("criteria-table th:nth-child(5)", cosmetic)
        self.assertIn("order: 6", cosmetic)
        self.assertIn("position: relative", cosmetic)
        self.assertIn("grid-template-columns: 1fr", cosmetic)

    def test_judgment_guides_use_quick_guide_numbered_section_flow(self):
        self.assertNotIn('class="criteria-guide-step-number" aria-hidden="true">01</span>', HTML)
        self.assertNotIn('class="criteria-guide-step-number" aria-hidden="true">02</span>', HTML)

        for step in ("1", "2", "3", "4"):
            self.assertGreaterEqual(
                HTML.count(f'class="criteria-guide-step-number" aria-hidden="true">{step}</span>'),
                2,
            )

        for title in (
            "Final Status",
            "Scoring Table",
            "Parameter Guide",
            "Evidence Level",
            "Evidence &amp; Record Rules",
            "OI Partnership Type",
            "Priority &amp; Exceptions",
        ):
            self.assertIn(f'<h3>{title}</h3>', HTML)

        self.assertIn("Judgment guide section flow", CSS)
        self.assertIn(".criteria-guide-step-number {", CSS)
        self.assertIn("width: 24px", CSS[CSS.index(".criteria-guide-step-number {"):])
        self.assertIn("border-radius: 50%", CSS[CSS.index(".criteria-guide-step-number {"):])
        self.assertNotIn('class="criteria-guide-section-icon"', HTML)
        self.assertIn(".criteria-scoring-helpers", CSS)
        self.assertIn(".criteria-record-pairs", CSS)
        self.assertIn('.criteria-focus-section[data-criteria-tab="focus"]', CSS)

    def test_judgment_cards_match_gpt_response_outline_without_status_top_rules(self):
        outline = CSS[CSS.index("/* Judgment card outlines mirror") :]
        self.assertIn(".criteria-drawer-body > .criteria-rule", outline)
        self.assertIn("border-color: color-mix(in srgb, var(--line) 90%, var(--muted))", outline)
        self.assertIn("background: var(--readable-surface)", outline)
        self.assertIn("box-shadow: 0 8px 22px rgba(15, 23, 42, 0.055)", outline)
        self.assertIn(".criteria-pass-grid .criteria-status-card", outline)
        self.assertIn("border: 1px solid", outline)
        self.assertNotIn("border-top: 3px", outline)
        self.assertIn("color: var(--criteria-status-color)", outline)
        self.assertIn("background: color-mix(in srgb, var(--criteria-status-color) 9%", outline)
        self.assertIn("margin-bottom: 0", CSS[CSS.index(".criteria-pass-grid.criteria-guide-section > .criteria-guide-section-heading"):])

        status_start = HTML.index('class="criteria-pass-grid triage-status-grid')
        status_end = HTML.index('class="criteria-scoring-section', status_start)
        status_markup = HTML[status_start:status_end]
        self.assertNotIn('class="criteria-guide-section-icon"', status_markup)
        self.assertIn('<h3>Final Status</h3><p>SELECT / REJECT / UNVERIFIED의 최종 판정 기준</p>', status_markup)
        self.assertIn('content: "·"', CSS)

    def test_parameter_and_evidence_cards_share_status_card_visual_family(self):
        shared = CSS[CSS.index("/* Parameter and Evidence cards share") :]
        self.assertIn(".criteria-parameter-guide .compact-criteria-detail-grid > article", shared)
        self.assertIn(".triage-evidence-note .criteria-evidence-definitions > div", shared)
        self.assertIn(".triage-evidence-note .criteria-evidence-footnote", shared)
        self.assertIn("border: 1px solid color-mix(in srgb, var(--line) 86%, var(--muted))", shared)
        self.assertIn("border-radius: 12px", shared)
        self.assertIn("background: color-mix(in srgb, var(--criteria-tab-accent) 4%", shared)
        self.assertIn("box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.025)", shared)
        self.assertIn(".criteria-parameter-heading .criteria-guide-icon", shared)
        self.assertIn("border-radius: 50%", shared)
        self.assertNotIn("border-top: 3px", shared)

    def test_parameter_checkpoint_summaries_are_removed(self):
        for label in (
            "작용기전의 구체성",
            "기능적 근거 수준",
            "과학적 타당성",
            "asset-specific validation 여부",
            "공개 asset-specific 결과 존재 여부",
            "개발 단계 적합성",
            "정량 데이터 여부",
            "상호보완 evidence domain",
            "해석 가능성과 신뢰도",
        ):
            self.assertNotIn(label, HTML)
        self.assertNotIn("criteria-checkpoint-list", HTML)
        self.assertNotIn("criteria-checkpoint-list", CSS)

    def test_triage_parameter_titles_match_scoring_table_labels(self):
        start = HTML.index('class="criteria-parameter-guide triage-parameter-guide')
        end = HTML.index('class="criteria-rule criteria-full-rule"', start)
        parameter = HTML[start:end]
        styles = CSS[CSS.index("/* Tab 1 Parameter titles mirror") :]

        self.assertEqual(parameter.count('class="criteria-parameter-heading criteria-parameter-title-row"'), 3)
        for short_label, title in (("TR", "Target Relevance"), ("MoA", "MoA Validity"), ("Data", "Data Maturity")):
            self.assertIn(f'<h3><b>{short_label}</b><span>{title}</span></h3>', parameter)
        self.assertNotIn("1. Target Relevance", parameter)
        self.assertNotIn("2. MoA Validity", parameter)
        self.assertNotIn("3. Data Maturity", parameter)
        self.assertIn("display: flex", styles)
        self.assertIn("align-items: center", styles)
        self.assertIn("flex: 1", styles)
        self.assertIn("white-space: nowrap", styles)
        self.assertIn("font-size: 9px", styles)
        self.assertIn("font-size: 12px", styles)

    def test_triage_status_summaries_are_separate_soft_helper_panels(self):
        helper = CSS[CSS.rindex("Color-code the three Tab 1 status helper panels") :]
        self.assertEqual(HTML.count('class="criteria-status-subtitle"'), 3)
        self.assertIn('.triage-status-grid[data-criteria-tab="triage"] .criteria-status-subtitle', helper)
        self.assertIn("min-height: 0", helper)
        self.assertIn("height: auto", helper)
        self.assertIn("align-self: start", helper)
        self.assertIn("border: 0", helper)
        self.assertIn("background: color-mix(in srgb, var(--criteria-status-color) 8%", helper)
        self.assertIn("box-shadow: none", helper)
        for status, color in (("select", "#16836f"), ("reject", "#b05258"), ("unverified", "#987222")):
            self.assertIn(f'.criteria-status-card[data-triage-status="{status}"]', CSS)
            self.assertIn(f"--criteria-status-color: {color}", CSS)

    def test_full_scout_scoring_table_uses_shared_table_display_without_helper(self):
        full_start = HTML.index('class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full"')
        full_end = HTML.index('class="criteria-parameter-guide full-parameter-guide', full_start)
        full = HTML[full_start:full_end]
        styles = CSS[CSS.index("/* Full Scout scoring table shares") :]

        self.assertNotIn("criteria-full-scoring-helpers", full)
        self.assertEqual(full.count('class="criteria-table-criterion"'), 7)
        for abbreviation, criterion in (
            ("TR", "Target Relevance"),
            ("COMP", "Competitive Landscape"),
            ("MoA", "MoA Validity"),
            ("PLATFORM", "Platform Attractiveness"),
            ("EXPANSION", "Expansion Potential"),
            ("DATA", "Data Maturity"),
            ("MARKET", "Marketability"),
        ):
            self.assertIn(f"<b>{abbreviation}</b>{criterion}</span>", full)
        self.assertIn('.criteria-scoring-section[data-criteria-tab="full"] .criteria-table-wrap', styles)
        self.assertIn("border-radius: 10px", styles)
        self.assertIn("padding: 12px", styles)
        self.assertIn("background: var(--readable-soft)", styles)
        self.assertIn("min-width: 900px", styles)

    def test_evidence_record_rules_header_has_compact_following_spacing(self):
        compact = CSS[CSS.index("/* Keep Evidence & Record Rules compact") :]
        self.assertIn(".criteria-records-section > .criteria-guide-section-heading", compact)
        self.assertIn("margin-bottom: 7px", compact)
        self.assertIn("padding-bottom: 8px", compact)
        self.assertIn(".criteria-records-section > p", compact)
        self.assertIn("margin: 0", compact)
        self.assertIn(".criteria-records-section > .criteria-records-grid", compact)
        self.assertIn("margin-top: 10px", compact)

    def test_tab_one_and_two_section_titles_share_one_content_gap(self):
        spacing = CSS[CSS.index("/* Tab 1/2 numbered section titles use one consistent content gap") :]
        self.assertIn('[data-criteria-tab="triage"].criteria-guide-section > .criteria-guide-section-heading', spacing)
        self.assertIn('[data-criteria-tab="full"].criteria-guide-section > .criteria-guide-section-heading', spacing)
        self.assertIn("margin-bottom: 12px", spacing)
        self.assertIn("padding-bottom: 10px", spacing)
        self.assertIn('.criteria-pass-grid[data-criteria-tab="triage"]', spacing)
        self.assertIn('.criteria-pass-grid[data-criteria-tab="full"]', spacing)
        self.assertIn("row-gap: 0", spacing)

    def test_tab_one_evidence_cards_share_one_consistent_gap(self):
        spacing = CSS[CSS.index("/* Tab 1 Evidence source cards use the same gap") :]
        self.assertIn("--criteria-evidence-card-gap: 16px", spacing)
        self.assertIn(".triage-evidence-note > .criteria-evidence-definitions", spacing)
        self.assertIn("margin: var(--criteria-evidence-card-gap) 0 0", spacing)
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", spacing)
        self.assertIn("display: grid !important", spacing)
        self.assertIn("gap: var(--criteria-evidence-card-gap) !important", spacing)
        self.assertIn("> .criteria-evidence-definitions > div + div", spacing)
        self.assertIn("margin-top: 0 !important", spacing)

    def test_score_mutations_refresh_priority_summary_before_render(self):
        refresh = function_body(JS, "refreshDashboardSummary")
        initial_load = function_body(JS, "loadRecords")
        manual_save = function_body(JS, "saveManualReviewEdit")
        rubric_recalculation = function_body(JS, "recalculateLatestRubric")

        self.assertIn("fetch(DASHBOARD_SUMMARY_URL, { cache: 'no-store' })", refresh)
        self.assertIn("requestId !== state.dashboardSummaryRequestId", refresh)
        self.assertIn("state.dashboardSummary = null", refresh)
        self.assertIn("refreshDashboardSummary()", initial_load)
        for mutation in (manual_save, rubric_recalculation):
            self.assertIn("await refreshDashboardSummary()", mutation)
            self.assertLess(mutation.index("await refreshDashboardSummary()"), mutation.index("render()"))

    def test_export_flags_and_responsive_summary_contract(self):
        export_table = function_body(JS, "exportPipelineTable")
        self.assertIn('class="excel-export-button help-tooltip"', HTML)
        self.assertIn("countryDisplayMarkup(row.countryRaw || row.country)", JS)
        self.assertIn("function countryFlagSvg(country)", JS)
        self.assertIn("function countryTableCode(country)", JS)
        self.assertIn("record_asset_identities", JS)
        self.assertIn("'Target Relevance Score'", export_table)
        self.assertIn("'Market Score'", export_table)
        self.assertIn("'Target Relevance Evidence Type'", export_table)
        self.assertIn("'Market Why Not Higher'", export_table)
        self.assertIn("'Data Sources'", export_table)
        self.assertIn(".workflow-summary-grid.visual-grid { grid-template-columns: repeat(3", CSS)
        self.assertIn("@media (max-width: 1100px)", CSS)
        self.assertIn("@media (max-width: 720px)", CSS)

    def test_fast_triage_summary_shows_average_total_score_out_of_nine(self):
        metrics = function_body(JS, "renderMetrics")
        fallback = function_body(JS, "fallbackTabSummary")
        self.assertIn("평균 총점 / 9", metrics)
        self.assertIn("average_total_score: average(triageRows.map(fastTriageRowTotal))", fallback)
        self.assertIn("max_score: 9", fallback)
        self.assertIn("grid-template-columns: repeat(5, minmax(0, 1fr))", CSS)

    def test_workflow_switcher_stays_connected_to_sticky_navy_header(self):
        self.assertRegex(
            CSS,
            r"\.app-shell:not\(\.detail-shell\).*?> \.topbar\s*\{\s*position: sticky;\s*top: 0;",
        )
        final_header_start = CSS.index("/* Final dashboard data utility cascade")
        final_header_end = CSS.index("/* Soft-bright semantic header palette", final_header_start)
        final_header = CSS[final_header_start:final_header_end]
        desktop_start = final_header.index("@media (min-width: 1281px)")
        desktop_end = final_header.index("@media (max-width: 1280px) and (min-width: 721px)", desktop_start)
        desktop_navigation = final_header[desktop_start:desktop_end]
        self.assertIn("position: absolute", desktop_navigation)
        self.assertIn("left: 50%", desktop_navigation)
        self.assertIn("transform: translateX(-50%)", desktop_navigation)

        tablet_start = desktop_end
        tablet_end = final_header.index("@media (max-width: 720px)", tablet_start)
        tablet_navigation = final_header[tablet_start:tablet_end]
        self.assertIn("position: relative", tablet_navigation)
        self.assertIn("grid-row: 2", tablet_navigation)
        self.assertIn("justify-self: center", tablet_navigation)
        self.assertIn("transform: none", tablet_navigation)
        self.assertIn("min-height: 38px", CSS)
        self.assertIn("min-height: 72px", CSS)
        barless = CSS[CSS.index("/* Keep workflow selection clear without underline"):]
        self.assertIn("button + button", barless)
        self.assertIn("border-left: 0", barless)
        self.assertIn("button.active::before", barless)
        self.assertIn("button.active::after", barless)
        self.assertIn("display: none", barless)
        self.assertIn("border: 0", barless)
        self.assertIn("background: rgba(255, 255, 255, 0.1)", barless)

    def test_home_workflow_active_tabs_are_borderless(self):
        barless = CSS[CSS.index("/* Keep workflow selection clear without underline") :]
        active_rule = re.search(r"pipeline-table-tabs button\.active\s*\{([^}]*)\}", barless)
        self.assertIsNotNone(active_rule)
        self.assertIn("border: 0", active_rule.group(1))
        self.assertIn("background: rgba(255, 255, 255, 0.1)", active_rule.group(1))

    def test_workflow_description_is_a_connected_information_panel(self):
        description = re.search(
            r'<section id="workflowModeDescription".*?</section>', HTML, re.S
        )
        self.assertIsNotNone(description)
        self.assertIn('role="note"', description.group(0))
        self.assertIn('data-workflow-mode="full"', description.group(0))
        self.assertIn('class="workflow-description-icon"', description.group(0))
        self.assertIn('class="workflow-description-copy"', description.group(0))
        self.assertIn('class="workflow-description-filter">Filter 2', description.group(0))

        render = function_body(JS, "renderWorkflowMode")
        self.assertIn('class="workflow-description-icon"', render)
        self.assertIn('class="workflow-description-copy"', render)
        self.assertIn('escapeHtml(copy.stage)', render)
        self.assertIn('escapeHtml(copy.description)', render)
        self.assertIn('escapeHtml(copy.filterLabel)', render)
        self.assertIn('elements.workflowModeDescription.dataset.workflowMode = mode', render)
        self.assertIn('aria-hidden="true">·</span>', render)
        self.assertNotIn('aria-hidden="true">:</span>', render)

        panel_rule = re.search(r"\.workflow-mode-description\s*\{(.*?)\n\}", CSS, re.S)
        self.assertIsNotNone(panel_rule)
        self.assertIn("grid-template-columns: 30px minmax(0, 1fr) auto", panel_rule.group(1))
        self.assertIn("border-top: 1px solid var(--line)", panel_rule.group(1))
        self.assertIn("border-radius: 0 0 11px 11px", panel_rule.group(1))
        self.assertIn("font-size: 13px", panel_rule.group(1))
        self.assertIn(".workflow-description-filter", CSS)
        self.assertIn("font-size: 12px", CSS[CSS.index(".workflow-description-filter"):])
        focus_icon_rule = re.search(
            r'\.workflow-mode-description\[data-workflow-mode="focus"\] \.workflow-description-icon\s*\{(.*?)\n\}',
            CSS,
            re.S,
        )
        self.assertIsNotNone(focus_icon_rule)
        self.assertIn('#d6a21f', focus_icon_rule.group(1))
        self.assertIn('#f6c84b', focus_icon_rule.group(1))
        self.assertIn('#b77908', focus_icon_rule.group(1))
        self.assertIn("margin-bottom: 0", CSS[CSS.index("/* Keep workflow selection clear without underline"):])

    def test_scoring_tables_keep_only_criterion_titles_in_first_column(self):
        title_with_description = re.compile(
            r"<th><span>(Target Relevance|MoA Validity|Data Maturity)</span><small>",
        )
        for source in (HTML, DETAIL_HTML, TRIAGE_DETAIL_HTML):
            self.assertNotRegex(source, title_with_description)
        self.assertIn(".criteria-drawer-body .criteria-scoring-intro", CSS)
        self.assertIn(".criteria-drawer-body code", CSS)
        self.assertIn("width: 200px", CSS)

    def test_judgment_guides_fit_viewport_without_horizontal_scroll(self):
        self.assertIn("width: 100vw", CSS)
        self.assertIn("overflow-x: hidden", CSS)
        self.assertRegex(
            CSS,
            r"\.criteria-drawer-body \.criteria-scoring-section \.criteria-table\s*\{[^}]*min-width: 0;",
        )
        self.assertIn("criteria-parameter-guide full-parameter-guide", HTML)
        self.assertIn("criteria-parameter-guide triage-parameter-guide", HTML)
        self.assertIn("parameter-breakdown-card", TRIAGE_DETAIL_HTML)

    def test_data_upload_guidance_and_validation_state_follow_active_tab(self):
        status = function_body(JS, "setDataUploadStatus")
        guide = function_body(JS, "renderDataUploadGuide")
        step_body = function_body(JS, "dataUploadStepBodyMarkup")
        preview = function_body(JS, "previewPastedReportParsing")

        self.assertIn("<h2>Data Upload</h2>", HTML)
        self.assertNotIn('id="dataUploadDescription"', HTML)
        self.assertIn('id="dataUploadRecommendation"', HTML)
        self.assertIn('id="dataUploadGuideSteps"', HTML)
        self.assertRegex(HTML, r'id="previewInputButton"[^>]* disabled')
        self.assertRegex(HTML, r'id="saveJsonButton"[^>]* disabled')
        self.assertIn("TAB1 전용 · GPT High · 권장 10–20개/회", JS)
        self.assertIn("TAB2 전용 · GPT High · 1개/회", JS)
        self.assertEqual(JS.count("새 GPT 창 열기 및 모드 선택"), 2)
        self.assertEqual(JS.count("새 브라우저 탭에서 GPT를 열고 High 이상의 추론 모드를 선택합니다."), 2)
        self.assertIn("지침 1은 최대 50개까지 처리할 수 있으나", JS)
        self.assertIn("새 브라우저 탭에서 GPT를 열고, 오른쪽 Fast Triage 실행 가이드 순서대로 조사를 완료한 뒤", JS)
        self.assertIn("새 브라우저 탭에서 GPT를 열고, 오른쪽 Full Scout 실행 가이드 순서대로 심층조사를 완료한 뒤", JS)
        self.assertIn("생성된 전체 응답을 그대로 붙여넣으세요.", JS)
        self.assertIn("생성된 전체 응답을 그대로 붙여넣으세요.", HTML)
        self.assertNotIn("응답을 아래에 그대로", JS)
        self.assertNotIn("응답을 아래에 그대로", HTML)
        self.assertNotIn("생성된 Markdown + JSON 전체 응답", JS)
        self.assertIn("관련 NCDP 파일이 있다면 GPT 실행 시 GPT 지침 2와 함께 첨부할 수 있습니다.", JS)
        self.assertNotIn("관련 NCDP 파일이 있다면 GPT 실행 시 GPT 지침 1과 함께 첨부할 수 있습니다.", JS)
        self.assertIn("{{prompt}} 입력 후, 심층 검토할 Asset명을 1개 입력합니다. 회사명을 함께 입력하면 더 좋습니다.", JS)
        self.assertNotIn("GPT 검색창에", JS)
        self.assertIn("promptKind: 'triage'", JS)
        self.assertIn("promptKind: 'full'", JS)
        self.assertIn("label: '입력 검토'", JS)
        self.assertIn("label: '검증 후 저장'", JS)
        self.assertIn("kind: 'focus-input', icon: 'clipboard', label: 'GPT 지침 1 전체 응답'", JS)
        self.assertIn("kind: 'focus-input', icon: 'clipboard', label: 'GPT 지침 2 전체 응답'", JS)
        self.assertIn("{{input}}에 붙여넣습니다.", JS)
        self.assertIn("Compact JSON 배열 전체", JS)
        self.assertIn("Compact JSON 객체 전체", JS)
        self.assertIn('\"ingestion_format\": \"compact_v2\"', JS)
        self.assertIn("Put complete citations and evidence detail in Markdown.", JS)
        self.assertIn("action.kind === 'focus-input'", step_body)
        self.assertIn("dataUploadIconMarkup(action.kind === 'focus-input'", step_body)
        self.assertIn('class="data-upload-prompt-chip data-upload-guide-action-chip"', JS)
        self.assertIn('data-upload-guide-action=', JS)
        self.assertIn("copyPromptToClipboard(kind)", JS)
        self.assertIn("elements.previewInputButton.click()", JS)
        self.assertIn("elements.saveJsonButton.click()", JS)
        self.assertIn("if (action === 'focus-input')", JS)
        self.assertIn("scrollToDataUpload()", JS)
        self.assertIn("elements.dataUploadPanel.hidden = isFocusMode", guide)
        for label in (
            "응답 붙여넣기 대기",
            "입력 검토 필요",
            "검증 중",
            "검증 완료 · 저장 가능",
            "수정 필요 · 오류",
            "저장 완료",
        ):
            self.assertIn(label, status)
        self.assertIn("setDataUploadStatus('validating')", preview)
        self.assertIn("elements.saveJsonButton.disabled = !result.canSave", preview)
        self.assertIn("grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.75fr)", CSS)
        self.assertIn(".data-upload-guide-steps li::before", CSS)
        self.assertIn(".data-upload-prompt-chip", CSS)
        prompt_chip_start = CSS.index(".data-upload-prompt-chip {")
        prompt_chip_end = CSS.index(".data-upload-prompt-chip > span", prompt_chip_start)
        prompt_chip_styles = CSS[prompt_chip_start:prompt_chip_end]
        self.assertIn("min-height: 26px", prompt_chip_styles)
        self.assertIn("padding: 3px 7px 3px 3px", prompt_chip_styles)
        self.assertIn('.data-upload-prompt-chip[data-upload-guide-action="focus-input"]', CSS)
        self.assertIn("var(--data-upload-accent-strong)", CSS)

    def test_data_upload_visual_polish_uses_vector_icons_and_mode_accents(self):
        visual_styles = CSS[CSS.index("/* Data Upload visual polish"):]
        icon_markup = function_body(JS, "dataUploadIconMarkup")
        guide = function_body(JS, "renderDataUploadGuide")

        self.assertIn('class="data-upload-textarea-shell"', HTML)
        self.assertIn('class="data-upload-input-label"', HTML)
        self.assertIn('class="data-upload-icon"', HTML)
        actions = re.search(r'<div class="editor-actions">(.*?)</div>', HTML, re.S)
        self.assertIsNotNone(actions)
        self.assertEqual(actions.group(1).count("<svg"), 3)
        self.assertEqual(actions.group(1).count('class="data-upload-action-icon"'), 2)

        for icon_name in ("sparkles", "external-link", "file-text", "clipboard", "paperclip", "shield-check", "save", "code"):
            self.assertIn(icon_name, icon_markup)
        self.assertIn('class="data-upload-step-icon"', guide)
        self.assertIn("stepIcons", guide)
        self.assertIn("dataUploadIconMarkup('sparkles')", guide)
        self.assertIn("['external-link', 'file-text', 'clipboard', 'shield-check']", guide)
        self.assertIn("['external-link', 'file-text', 'paperclip', 'shield-check']", guide)
        action_markup = function_body(JS, "dataUploadStepBodyMarkup")
        self.assertIn("action.kind === 'review' ? 'shield-check' : 'save'", action_markup)
        self.assertIn("data-upload-action-icon", action_markup)
        self.assertIn('M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6', HTML)
        self.assertIn('M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6', icon_markup)

        self.assertIn('html[data-workflow-mode="triage"] .paste-panel', visual_styles)
        self.assertIn('html[data-workflow-mode="full"] .paste-panel', visual_styles)
        self.assertIn("border-radius: 12px", visual_styles)
        self.assertIn("grid-template-columns: 25px 29px minmax(0, 1fr)", visual_styles)
        self.assertIn(".data-upload-status[data-state=\"validating\"] .data-upload-icon", visual_styles)
        self.assertIn(".data-upload-guide {\n    order: -1", visual_styles)
        self.assertRegex(
            visual_styles,
            r"\.paste-panel \.editor-actions \.header-action-button\s*\{[^}]*border-radius: 999px;",
        )
        self.assertRegex(
            visual_styles,
            r"\.paste-panel \.editor-actions \.header-action-button > span\s*\{[^}]*width: 22px;[^}]*height: 22px;[^}]*border-radius: 50%;",
        )
        self.assertRegex(
            CSS,
            r'\.data-upload-prompt-chip\[data-upload-guide-action="save"\] > span\s*\{[^}]*width: 18px;[^}]*height: 18px;[^}]*border-radius: 999px;',
        )
        self.assertIn("The workspace and Quick Guide actions share one vector family; guide pills stay compact", CSS)
        self.assertRegex(
            CSS,
            r"\.paste-panel \.data-upload-action-icon\s*\{[^}]*width: 22px;[^}]*height: 22px;[^}]*border-radius: 50%;",
        )
        self.assertRegex(
            CSS,
            r"\.paste-panel \.data-upload-guide-action-chip \.data-upload-action-icon\s*\{[^}]*width: 18px;[^}]*height: 18px;",
        )

    def test_dashboard_filters_and_data_upload_use_neutral_shadow_focus(self):
        filter_styles = CSS[CSS.index("Dashboard filters: keep the resting edge"):]

        self.assertIn(".controls input:hover", filter_styles)
        self.assertIn(".controls select:hover", filter_styles)
        self.assertIn(".controls input:focus-visible", filter_styles)
        self.assertIn(".controls select:focus-visible", filter_styles)
        self.assertIn("outline: none", filter_styles)
        self.assertNotIn("border-color: #0a84ff", filter_styles)
        self.assertIn("box-shadow: 0 5px 14px rgba(15, 23, 42, 0.16)", filter_styles)
        self.assertIn(".paste-panel .data-input-box:focus-within", filter_styles)
        self.assertIn(".paste-panel #gptResponseInput:focus-visible", filter_styles)
        self.assertIn('font-family: Tahoma, "Malgun Gothic", "맑은 고딕", sans-serif', filter_styles)


    def test_excel_and_upload_mode_badges_use_soft_green_accents(self):
        self.assertIn("#exportExcelButton.excel-export-button", CSS)
        self.assertIn("background: color-mix(in srgb, #42b883 10%, var(--surface))", CSS)
        self.assertRegex(CSS, r"\.data-upload-recommendation\s*\{[^}]*color: #247457")
        self.assertRegex(CSS, r"#exportExcelButton\.excel-export-button:disabled\s*\{[^}]*opacity: 0\.7")
        self.assertRegex(CSS, r"\.data-upload-guide-steps li::before\s*\{[^}]*border-radius: 999px")
        self.assertRegex(CSS, r"\.data-upload-guide-steps li::before\s*\{[^}]*background: color-mix\(in srgb, #42b883 11%, var\(--surface\)\)")
        self.assertIn('.data-upload-prompt-chip[data-upload-guide-action="save"]', CSS)
        self.assertIn("background: rgba(255, 255, 255, 0.16)", CSS)

        save_start = CSS.index('.data-upload-prompt-chip[data-upload-guide-action="save"] {')
        save_end = CSS.index('.data-upload-guide-steps pre {', save_start)
        save_styles = CSS[save_start:save_end]
        self.assertIn("var(--data-upload-accent)", save_styles)
        self.assertIn("var(--data-upload-accent-light)", save_styles)
        self.assertNotIn("background: var(--accent)", save_styles)
        self.assertIn("--data-upload-accent-light: #38a8df", CSS)

    def test_data_upload_actions_and_status_guide_the_next_step(self):
        actions = re.search(r'<div class="editor-actions">(.*?)</div>', HTML, re.S)
        self.assertIsNotNone(actions)
        block = actions.group(1)
        self.assertLess(block.index('id="clearJsonButton"'), block.index('id="previewInputButton"'))
        self.assertLess(block.index('id="previewInputButton"'), block.index('id="saveJsonButton"'))
        self.assertIn('id="saveJsonButton"', block)
        self.assertIn("disabled", block[block.index('id="saveJsonButton"'):])
        self.assertEqual(block.count("header-action-button"), 2)
        self.assertIn("waiting: '응답 붙여넣기 대기'", JS)
        for label in ('입력 검토 필요', '검증 중', '검증 완료 · 저장 가능', '수정 필요 · 오류', '저장 완료'):
            self.assertIn(label, JS)
        self.assertIn(".data-upload-clear-button", CSS)
        self.assertIn("#saveJsonButton:disabled", CSS)
        self.assertRegex(CSS, r"\.paste-panel \.editor-actions \.header-action-button\s*\{[^}]*min-height: 38px;[^}]*border-radius: 999px;")

    def test_data_upload_placeholders_use_prominent_spaced_body_copy(self):
        self.assertIn("오른쪽 Fast Triage 실행 가이드 순서대로", JS)
        self.assertIn("이 입력란은 Fast Triage 형식만 검증합니다.", JS)
        self.assertIn("지침 1은 최대 50개까지 처리할 수 있으나 안정적인 조사를 위해 10~20개씩 실행하는 것을 권장합니다.", JS)
        self.assertIn(".paste-panel #gptResponseInput::placeholder", CSS)
        placeholder_styles = CSS[CSS.index(".paste-panel #gptResponseInput::placeholder"):]
        self.assertIn("font-size: 16px", placeholder_styles)
        self.assertIn("font-weight: 500", placeholder_styles)
        self.assertIn("opacity: 0.96", placeholder_styles)

    def test_data_upload_labels_omit_format_suffix(self):
        self.assertIn("inputLabel: 'GPT 지침 1 전체 응답'", JS)
        self.assertIn("inputLabel: 'GPT 지침 2 전체 응답'", JS)
        self.assertNotIn("전체 응답 · Markdown + JSON", JS)
        self.assertIn('id="dataUploadInputLabel">GPT 지침 2 전체 응답</b>', HTML)

    def test_triage_parameter_guide_uses_requested_one_line_summaries(self):
        start = HTML.index('class="criteria-parameter-guide triage-parameter-guide')
        end = HTML.index('class="criteria-rule criteria-full-rule"', start)
        parameter = HTML[start:end]
        for summary in (
            "SKBP 우선 관심 적응증 및 R&amp;D Theme/Cluster와의 적합성을 평가합니다.",
            "Target·작용기전이 얼마나 명확히 정의되어 있고, 기능적·독립적·asset-specific 근거로 어느 수준까지 검증됐는지를 평가합니다.",
            "해당 asset의 개발 단계에 맞는 공개 정량 데이터가 얼마나 충분하고, 서로 보완되어 해석 가능한지를 평가합니다.",
        ):
            self.assertIn(f"<p>{summary}</p>", parameter)

    def test_oi_partnership_boxes_match_gpt_response_outline(self):
        oi_styles = CSS[CSS.index("OI Partnership option boxes use the same outline language"):]
        self.assertIn("border: 1px solid color-mix(in srgb, var(--line) 86%, var(--muted))", oi_styles)
        self.assertIn("border-left-width: 1px", oi_styles)
        self.assertIn("border-radius: 12px", oi_styles)
        self.assertIn("box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.025)", oi_styles)

    def test_shortlisting_decision_guide_uses_three_step_shared_structure(self):
        start = HTML.index('class="criteria-rule criteria-focus-rule"')
        end = HTML.index('</aside>', start)
        focus = HTML[start:end]
        scope = function_body(JS, "updateCriteriaDrawerScope")

        self.assertIn("TAB 3 · SHORTLISTING · DECISION GUIDE", JS)
        self.assertIn("Shortlisted 후보의 OI Partnership Type 자동분류 및 후속 관리 기준", JS)
        self.assertIn("state.latestOiPartnershipCriteriaVersion", scope)
        self.assertIn("Filter 3 — OI Partnership 자동 분류 · v1.3 기준", focus)
        intro = (
            "Tab 3는 Full Scout 검토 후 Shortlisting에 등록된 후보를 대상으로, "
            "SKBP 우선 관심 적응증 여부와 확인된 modality·stage·Platform Attractiveness·"
            "In-vivo·In-vitro·ADMET 값을 사용해 투자, Value Up, 공동연구, Unknown 또는 N/A로 자동 분류합니다."
        )
        self.assertIn(f"<p>{intro}</p>", focus)

        sections = (
            ("eligibility", "1", "Eligibility &amp; Input Basis", "자동분류 대상과 사용하는 정보"),
            ("partnership", "2", "OI Partnership Type", "투자·Value Up·공동연구의 핵심 자동분류 조건"),
            ("exceptions", "3", "Priority &amp; Exceptions", "중복 조건과 정보 부족 처리 기준"),
        )
        for key, step, title, subtitle in sections:
            self.assertIn(f'data-focus-section="{key}"', focus)
            section_start = focus.index(f'data-focus-section="{key}"')
            next_section = focus.find('data-focus-section="', section_start + 1)
            section = focus[section_start: next_section if next_section >= 0 else len(focus)]
            self.assertIn(f'class="criteria-guide-step-number" aria-hidden="true">{step}</span>', section)
            self.assertIn('class="criteria-focus-section-icon"', section)
            self.assertIn(f'<h3>{title}</h3><p>{subtitle}</p>', section)

        for indication in (
            "Alzheimer’s disease",
            "Parkinson’s disease",
            "Amyotrophic lateral sclerosis",
            "Multiple sclerosis",
            "Neuropathic pain",
            "Epilepsy",
        ):
            self.assertIn(f"<span>{indication}</span>", focus)

        for decision in ("investment", "value-up", "joint-research"):
            self.assertIn(f'data-focus-decision="{decision}"', focus)
        self.assertEqual(focus.count('class="criteria-focus-condition-list"'), 3)
        self.assertEqual(focus.count('class="criteria-focus-result"'), 0)
        self.assertNotIn("<b>AND</b>", focus)
        for formula in (
            "Stage ≥ IND-enabling",
            "Stage &lt; IND-enabling",
            "In-vivo = O",
            "In-vitro = O",
            "ADMET uploaded + scored",
            "Platform Attractiveness = 3",
        ):
            self.assertIn(formula, focus)
        self.assertIn('<li class="criteria-focus-condition-inline"><strong>In-vivo = O, In-vitro = O</strong></li>', focus)
        self.assertNotIn('<strong>In-vivo = O</strong></li><li><strong>In-vitro = O</strong>', focus)
        self.assertIn('.criteria-focus-condition-inline', CSS)
        self.assertIn('white-space: nowrap', CSS[CSS.index('.criteria-focus-condition-inline') :])
        self.assertNotIn("canonical stage가 정확히 <code>IND-enabling</code>인 경우만 해당", focus)
        self.assertNotIn("Pipeline이 정확히 <code>IND-enabling</code>인 경우만 해당", focus)
        self.assertNotIn("Stage rank 비교를 사용하지 않음", focus)
        self.assertIn("IND filed/cleared 및 Phase 1 이상 포함", focus)
        self.assertNotIn("IND-enabling planned 등 향후 계획은 현재 단계로 처리하지 않음", focus)
        self.assertNotIn("충족 시 <strong>→ 투자</strong>", focus)
        self.assertNotIn("충족 시 <strong>→ Value Up</strong>", focus)
        self.assertNotIn("충족 시 <strong>→ 공동연구</strong>", focus)
        self.assertNotIn("Stage = IND-enabling", focus)
        self.assertIn("Full Scout 및 Partner Materials 정보를 사용", focus)

        self.assertIn("공동연구</strong><span>&gt;</span><span>투자 · Value Up", focus)
        priority_pills = CSS[CSS.index(".criteria-focus-priority-formula {") : CSS.index(".criteria-focus-comparison-strip")]
        self.assertIn(".criteria-focus-priority-formula strong", priority_pills)
        self.assertIn(".criteria-focus-priority-formula span:last-child", priority_pills)
        self.assertIn("border-radius: 999px", priority_pills)
        self.assertIn("var(--focus-card-accent) 12%", priority_pills)
        self.assertIn("font-weight: 450", priority_pills)
        self.assertIn("span:first-of-type", priority_pills)
        self.assertIn("SKBP 우선 관심 적응증 경우에는 해당하지만, 아래 분류에 대한 값을 확인하지 못한 경우입니다.", focus)
        self.assertIn('class="criteria-focus-keyword-list"', focus)
        for keyword in ("modality", "ADMET 정보", "Platform Attractiveness"):
            self.assertIn(f"<li>{keyword}</li>", focus)
        self.assertNotIn("Stage 및 Platform Attractiveness", focus)
        self.assertNotIn("Modality group 확인 불가", focus)
        self.assertNotIn("Small molecule의 ADMET 값 미확인", focus)
        self.assertNotIn("필요한 stage 또는 platform 값 미확인", focus)
        self.assertNotIn("<strong>Unknown</strong> = 자동분류에 필요한 정보 부족", focus)
        self.assertNotIn("<strong>N/A</strong> = 대상 외 또는 확인된 정보상 조건 미충족", focus)
        self.assertNotIn('data-focus-section="review"', focus)
        self.assertNotIn("Review &amp; Recalculation", focus)
        self.assertNotIn("AUTO 결과 저장과 HUMAN 수정 원칙", focus)
        self.assertNotIn("Action date</strong>는 후속관리 일정이며 Filter 3 자동분류 조건에는 포함되지 않습니다.", focus)

        styles = CSS[CSS.rindex("Tab 3 Shortlisting uses the same numbered decision-guide system") :]
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", styles)
        self.assertIn(".criteria-focus-keyword-list", styles)
        shared_chips = styles[styles.index(".criteria-focus-chip-list > span,") :]
        self.assertIn(".criteria-focus-keyword-list > li", shared_chips.split("{", 1)[0])
        self.assertIn("font-weight: 450", shared_chips.split("}", 1)[0])
        self.assertIn("border-radius: 999px", styles)
        self.assertIn("grid-template-rows: auto minmax(62px, auto) auto auto", styles)
        self.assertIn("background: var(--readable-surface)", styles)
        self.assertIn("border-radius: 11px", styles)
        self.assertIn("@media (max-width: 1100px) and (min-width: 641px)", styles)
        self.assertIn("@media (max-width: 640px)", styles)
        bullet_styles = CSS[CSS.rindex("OI Partnership decision cards mirror the Final Status helper-and-bullet hierarchy") :]
        self.assertIn(".criteria-focus-condition-list", bullet_styles)
        self.assertIn("padding-left: 18px", bullet_styles)
        self.assertIn("gap: 7px", bullet_styles)
        self.assertIn("color: var(--text)", bullet_styles)
        self.assertIn(".criteria-focus-result", bullet_styles)
        final_status_match = CSS[CSS.index("OI Partnership Type cards exactly follow the Final Status") :]
        self.assertIn("grid-template-rows: auto minmax(88px, auto) 1fr", final_status_match)
        self.assertIn("background: color-mix(in srgb, var(--surface) 92%, transparent)", final_status_match)
        self.assertIn("var(--focus-card-accent) 8%", final_status_match)
        self.assertIn("font-weight: 650 !important", final_status_match)
        self.assertIn("font-weight: 400", final_status_match)
        self.assertIn("box-shadow: none", final_status_match)
        exact_match = CSS[CSS.index("Match OI decision colors and icon treatment") :]
        for color in ("#16836f", "#987222", "#b05258"):
            self.assertIn(color, exact_match)
        self.assertIn("grid-template-rows: auto 68px 1fr", exact_match)
        compact_summary = exact_match[exact_match.index('.criteria-focus-card-summary {') :]
        compact_summary = compact_summary.split('}', 1)[0]
        self.assertIn("min-height: 0", compact_summary)
        self.assertIn("height: auto", compact_summary)
        self.assertIn("align-self: start", compact_summary)
        self.assertIn("width: 29px", exact_match)
        self.assertIn("height: 29px", exact_match)
        self.assertIn("var(--focus-card-accent) 22%", exact_match)
        self.assertIn("var(--focus-card-accent) 9%", exact_match)
        self.assertIn("font-weight: 800", exact_match)
        self.assertIn("font-weight: 620 !important", exact_match)

    def test_triage_scoring_rows_match_full_scout_hover_feedback(self):
        hover = "box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--criteria-section-accent) 3%, transparent)"
        self.assertGreaterEqual(CSS.count(hover), 2)
        self.assertIn(
            '.criteria-scoring-section[data-criteria-tab="triage"] .criteria-table tbody tr:hover td',
            CSS,
        )
        self.assertIn(
            '.criteria-scoring-section[data-criteria-tab="full"] .criteria-table tbody tr:hover td',
            CSS,
        )

    def test_collapsed_summary_uses_shadow_without_a_visible_border(self):
        collapsed = CSS[CSS.index('.visual-dashboard-toggle-bar[aria-expanded="false"] {'):]
        self.assertIn("border: 0", collapsed)
        self.assertIn("box-shadow: 0 8px 16px -8px rgba(15, 23, 42, 0.18)", collapsed)
        self.assertIn("box-shadow: 0 10px 20px -10px rgba(15, 23, 42, 0.24)", collapsed)
        self.assertIn('.visual-dashboard-toggle-bar[aria-expanded="false"]:hover', collapsed)


    def test_all_judgment_tabs_share_one_cosmetic_system(self):
        cosmetic = CSS[CSS.index("Judgment guide cosmetic unification"):]
        for tab, color in (("triage", "#0f8f83"), ("full", "#2f73c9"), ("focus", "#7657c9")):
            self.assertIn(f'[data-criteria-tab="{tab}"] {{ --criteria-tab-accent: {color}; }}', cosmetic)
        self.assertIn(".criteria-drawer-body .criteria-scoring-section", cosmetic)
        self.assertIn(".criteria-drawer-body .criteria-parameter-guide", cosmetic)
        self.assertIn(".criteria-drawer-body .oi-partnership-guide", cosmetic)
        self.assertIn("border-radius: 12px", cosmetic)
        self.assertIn("background: var(--readable-soft)", cosmetic)
        self.assertIn("box-shadow: none", cosmetic)

    def test_auth_signout_typography_matches_admin_menu_action(self):
        rule = re.search(r"\.topbar \.auth-menu button\s*\{([^}]*)\}", CSS, re.S)
        self.assertIsNotNone(rule)
        for declaration in ("font-family: inherit", "font-size: 13px", "font-weight: 800", "text-align: center"):
            self.assertIn(declaration, rule.group(1))

    def test_auth_trigger_matches_round_theme_icon_geometry(self):
        rule = re.search(r"\.topbar \.auth-trigger\s*\{([^}]*)\}", CSS, re.S)
        self.assertIsNotNone(rule)
        for declaration in ("width: 38px", "min-width: 38px", "height: 38px", "border-radius: 50%"):
            self.assertIn(declaration, rule.group(1))

    def test_triage_scoring_table_uses_formal_headers_and_clear_grid_lines(self):
        shared = CSS[CSS.index("Keep Tab 1 scoring table visually identical") :]
        self.assertIn("border: 1px solid var(--presentation-border)", shared)
        self.assertIn("border-radius: 10px", shared)
        self.assertIn("background: var(--readable-soft)", shared)
        self.assertIn("background: var(--readable-surface)", shared)
        self.assertIn("border-bottom-width: 1px", shared)

    def test_triage_scoring_notes_highlight_unverified_and_cover_inactive_assets(self):
        self.assertIn('class="triage-status-badge unverified criteria-footnote-status">UNVERIFIED</span>', HTML)
        self.assertIn("inactive·discontinued(개발 중단) 상태이면 해당 항목을 0점", HTML)
        self.assertIn(".criteria-table-footnote .criteria-footnote-status", CSS)

    def test_priority_pipeline_shows_top_ten_with_scroll_and_breaks_ties_by_latest_search(self):
        render = function_body(JS, "renderWorkflowPriorityList")
        self.assertIn("Number(b.total_score ?? -1) - Number(a.total_score ?? -1)", render)
        self.assertIn("Date.parse(b.completed_at || b.generated_at || '')", render)
        self.assertIn("visibleRows.slice(0, 10)", render)
        self.assertNotIn("data-priority-more", render)
        self.assertNotIn("priorityPipelineModal", HTML)
        self.assertIn('<h2 id="workflowPriorityTitle">Priority Pipeline</h2>', HTML)
        self.assertIn("Number(a.action_rank ?? 99) - Number(b.action_rank ?? 99)", render)
        self.assertIn("Date.parse(b.action_updated_at || b.completed_at || '')", render)
        self.assertIn("priorityTitle: 'F/U Action'", JS)
        self.assertIn("최대 10개 · Total score · 동점 시 최신 조사 순", JS)
        self.assertIn("최대 10개 · 동점 시 최신 업데이트 순", JS)
        self.assertNotIn("Action 우선순위", JS)
        priority_scroll = CSS[CSS.index(".workflow-priority-list {") :]
        self.assertIn("max-height: 260px", priority_scroll)
        self.assertIn("overflow-y: auto", priority_scroll)
        self.assertIn("scrollbar-width: thin", priority_scroll)


    def test_full_scout_criteria_uses_concise_competitor_similarity_record_note(self):
        start = HTML.index('class="criteria-rule criteria-other-header criteria-guide-section criteria-records-section"')
        end = HTML.index('class="criteria-rule criteria-focus-rule"', start)
        records = HTML[start:end]
        self.assertIn("<h3>경쟁사 유사도</h3>", records)
        self.assertIn("유사도와 검색 범위·제약을 같은 기준으로 정리합니다.", records)
        self.assertIn("동일 indication + target/MoA + 유사 modality", records)
        self.assertIn("동일 indication + pathway/biology", records)
        self.assertIn("검색 범위 및 limitation", records)
        self.assertIn("판단 근거 출처", records)
        self.assertNotIn("유사도 수준, 일치 요소, 공통·차별 데이터와 출처를 기록합니다.", records)
        self.assertNotIn("similar_pipeline_count", records)
        self.assertIn("<h3>근거 보존 원칙</h3>", DETAIL_HTML)
        self.assertIn("점수 근거, 출처, 조사 과정과 why-not-higher는 Markdown 리포트에 보존합니다.", DETAIL_HTML)
        self.assertIn("테이블·시각화·필터에 쓰는 값과 criterion 점수만 저장합니다.", DETAIL_HTML)

    def test_full_scout_scoring_table_has_no_preliminary_application_note(self):
        start = HTML.index('class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full"')
        end = HTML.index('class="criteria-parameter-guide full-parameter-guide', start)
        scoring = HTML[start:end]
        self.assertIn("<h3>Scoring Table</h3><p>7개 criteria의 0–3점 평가 기준</p>", scoring)
        self.assertNotIn("지침 1은 TR/MOA/Data만 예비 적용", scoring)
        self.assertNotIn("criteria-section-supporting-copy", HTML)
        self.assertNotIn("criteria-section-supporting-copy", CSS)
        self.assertRegex(scoring, r'</div>\s*<div class="criteria-table-wrap">')

    def test_full_scout_status_summaries_precede_unchanged_rule_bullets(self):
        start = HTML.index('class="criteria-pass-grid full-status-grid')
        end = HTML.index('class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full"', start)
        status_section = HTML[start:end]
        expected = {
            "pass": (
                "Full Scout의 총점과 필수 기준을 모두 충족하고 active development가 확인된 후속 BD 우선 검토 후보입니다.",
                ("Total Score ≥ 15", "Target Relevance ≥ 2", "MoA Validity ≥ 2", "Data Maturity ≥ 2", "Asset identity verified", "Active development program confirmed"),
            ),
            "review": (
                "잠재력은 있으나 총점, 필수 기준 또는 active status와 핵심 근거가 충분하지 않아 추가 확인이 필요한 후보입니다.",
                ("Total Score 9–14", "또는 Total Score ≥ 15이지만 TR, MoA 또는 Data 필수조건 미충족", "또는 active status, stage 또는 핵심 evidence 불확실", "추가 diligence 후 PASS/FAIL 재판정"),
            ),
            "fail": (
                "현재 확인된 근거 또는 개발 상태가 Full Scout 통과 기준에 미달하거나 명확한 제외 조건에 해당하는 후보입니다.",
                ("Total Score ≤ 8", "또는 Target Relevance ≤ 1", "또는 Asset identity not verified", "또는 Discontinued / Terminated / Withdrawn / Inactive / Clearly failed"),
            ),
        }
        for status, (summary, bullets) in expected.items():
            card_start = status_section.index(f'data-full-status="{status}"')
            next_card = status_section.find('data-full-status="', card_start + 1)
            card = status_section[card_start: next_card if next_card >= 0 else len(status_section)]
            self.assertIn(f'<div class="criteria-full-status-summary-slot"><p class="criteria-full-status-summary">{summary}</p></div>', card)
            self.assertLess(card.index('criteria-full-status-summary'), card.index("<ul>"))
            for bullet in bullets:
                self.assertIn(f"<li>{bullet}</li>", card)
        self.assertEqual(status_section.count('class="criteria-full-status-summary"'), 3)
        self.assertEqual(status_section.count('class="criteria-full-status-summary-slot"'), 3)
        hierarchy = CSS[CSS.rindex("Match the Tab 1 neutral-card and status-colored-helper hierarchy") :]
        self.assertIn('.full-status-grid[data-criteria-tab="full"] .criteria-status-card', hierarchy)
        self.assertIn("border: 1px solid color-mix(in srgb, var(--line) 76%, transparent)", hierarchy)
        self.assertIn("border-radius: 11px", hierarchy)
        self.assertIn("background: color-mix(in srgb, var(--surface) 92%, transparent)", hierarchy)
        styles = CSS[CSS.rindex("Full Scout status summaries sit between the status name and unchanged rules") :]
        self.assertIn("var(--criteria-status-color) 8%", styles)
        self.assertIn("font-size: 12px", styles)
        self.assertIn("font-weight: 650", styles)
        self.assertIn("margin: 0 0 13px", styles)
        self.assertNotIn("최종 BD recommendation", status_section)

    def test_tab2_full_scout_guide_matches_current_instruction(self):
        start = HTML.index('class="criteria-pass-grid full-status-grid')
        end = HTML.index('class="criteria-rule criteria-focus-rule"', start)
        guide = HTML[start:end]

        for required in (
            "Total Score ≥ 15",
            "Target Relevance ≥ 2",
            "Total Score 9–14",
            "Asset identity not verified",
            "Discontinued / Terminated / Withdrawn / Inactive / Clearly failed",
            "Platform-derived Asset FPD",
            "<b>DATA</b><span>Data Maturity</span>",
            "US Obtainable Peak Sales",
            "<span>1.5</span>",
            "Evidence Type",
        ):
            self.assertIn(required, guide)

        for removed in (
            "Total Score ≥ 14",
            "Target Relevance ≥ 3",
            "hard blocker",
            "Expansion Capacity Adjustment",
            "같은 biology, target, platform",
            ">= USD 2B + 확장성/가격/차별성 우수",
            "Competitor stage · Quantitative differentiation · Realistic entry space · Search sufficiency",
            "Reusable technical principle · Comparator · Quantitative technical advantage · Repeated validation",
            "공식 pipeline의 적응증별 프로그램",
            "Complementary evidence domains · Program progression support",
            "Calculation · External Forecast · Both · Insufficient Evidence",
            "Public Web · User Uploaded File · User Text",
        ):
            self.assertNotIn(removed, guide)

    def test_full_scout_status_cards_align_summaries_and_bullets_like_triage(self):
        styles = CSS[CSS.rindex("Full Scout Final Status mirrors the Fast Triage card rhythm and alignment") :]
        self.assertIn('grid-template-rows: auto minmax(88px, auto) 1fr', styles)
        self.assertIn('.criteria-full-status-summary', styles)
        self.assertIn('min-height: 88px', styles)
        self.assertIn('color: var(--text)', styles)
        self.assertIn('.criteria-status-card > ul', styles)
        self.assertIn('margin: 12px 0 0', styles)
        self.assertIn('padding-left: 18px', styles)
        self.assertIn('gap: 7px', styles)
        self.assertIn('color: var(--text)', styles)
        self.assertIn('@media (max-width: 900px) and (min-width: 641px)', styles)
        self.assertIn('@media (max-width: 640px)', styles)
        self.assertNotIn('data-tooltip="Hard blocker', HTML)


    def test_triage_evidence_level_uses_current_source_and_scoring_rules(self):
        evidence_start = HTML.index("<h3>Evidence Level</h3>")
        evidence_end = HTML.index('data-criteria-tab="full"', evidence_start)
        evidence = HTML[evidence_start:evidence_end]

        combined = "확인된 사용자 입력정보 또는 공개자료만 사용하며, 미확인 항목은 <code>Unknown</code>으로 기록하고, 출처 개수 자체로 점수를 결정하지 않습니다."
        self.assertIn(f'<p class="criteria-evidence-intro">{combined}</p>', evidence)

        for copy in (
            "점수에 사용되는 근거와 출처 원칙",
            "TR 평가에 사용 가능",
            "판단에 사용된 출처와 핵심 사실 표시",
            "TR: 사용자 입력정보 및 공개자료 모두 사용 가능",
            "MoA·Data 2점 이상: 공개 asset-specific 근거 필요",
            "출처 개수 자체로 점수를 결정하지 않습니다.",
        ):
            self.assertIn(copy, evidence)

        self.assertIn("<span>평가 원칙</span>", evidence)
        self.assertNotIn("[평가 원칙]", evidence)
        principle = evidence[evidence.index("<span>평가 원칙</span>") :]
        self.assertNotIn("출처 개수 자체로 점수를 결정하지 않습니다.", principle)
        intro_style = CSS[CSS.rindex("Keep the combined Tab 1 Evidence Level policy on one desktop line") :]
        self.assertIn("white-space: nowrap", intro_style)

        balance = CSS[CSS.rindex("Give the longer Tab 1 evaluation-principle copy more horizontal room") :]
        self.assertIn("@media (min-width: 761px)", balance)
        self.assertIn("minmax(0, 0.875fr) minmax(0, 0.875fr) minmax(0, 1.25fr)", balance)
        self.assertNotIn("TR: 사용자 입력정보 및 공개자료 모두 사용 가능.</li>", evidence)


    def test_triage_evidence_definition_cards_use_bullet_lists(self):
        evidence_start = HTML.index('<dl class="criteria-evidence-definitions">')
        evidence_end = HTML.index("</dl>", evidence_start)
        evidence = HTML[evidence_start:evidence_end]
        self.assertEqual(evidence.count("<dd><ul>"), 3)
        self.assertEqual(evidence.count("<li>"), 6)
        self.assertEqual(evidence.count("<li>"), evidence.count("<dd><ul>") * 2)
        self.assertNotIn("<br>", evidence)
        bullet_styles = CSS[CSS.index("Evidence Level card copy is a consistent") :]
        self.assertIn("padding-left: 17px", bullet_styles)
        self.assertIn("li::marker", bullet_styles)

    def test_full_status_conditions_match_triage_body_weight(self):
        typography = CSS[CSS.rindex('.full-status-grid[data-criteria-tab="full"] .criteria-status-card > ul li {') :]
        self.assertIn("color: color-mix(in srgb, var(--text) 68%, var(--muted))", typography)
        self.assertIn("font-weight: 400", typography)
        first_item = typography[typography.index("li:first-child {") :]
        self.assertIn("font-weight: 400", first_item)
        self.assertNotIn("font-weight: 680", first_item.split("}", 1)[0])

    def test_full_status_summaries_fit_their_content(self):
        layout = CSS[CSS.rindex("Full Scout Final Status mirrors the Fast Triage card rhythm") :]
        self.assertIn("grid-template-rows: auto auto 1fr", layout)
        summary = layout[layout.index(".criteria-full-status-summary {") :]
        self.assertIn("min-height: 0", summary.split("}", 1)[0])
        self.assertNotIn("min-height: 88px", summary.split("}", 1)[0])

    def test_full_status_total_score_rules_share_a_desktop_baseline(self):
        alignment = CSS[CSS.index("Final desktop alignment for the three Full Scout Total Score") :]
        self.assertIn("@media (min-width: 901px)", alignment)
        self.assertIn("grid-template-rows: auto 78px 1fr", alignment)
        self.assertIn(".criteria-full-status-summary-slot", alignment)
        self.assertIn("height: 78px", alignment)
        self.assertIn("height: auto", alignment)
        self.assertIn("margin-top: 8px", alignment)

    def test_tab1_inner_cards_match_quick_guide_step_surface(self):
        quick_guide = CSS[CSS.rindex("Tab 1 inner cards mirror the neutral Quick Guide") :]
        for selector in (
            '.triage-status-grid[data-criteria-tab="triage"] .criteria-status-card',
            '.triage-parameter-guide[data-criteria-tab="triage"] .compact-criteria-detail-grid > article',
            '.triage-evidence-note[data-criteria-tab="triage"] .criteria-evidence-definitions > div',
        ):
            self.assertIn(selector, quick_guide)
        self.assertIn("border: 1px solid color-mix(in srgb, var(--line) 76%, transparent)", quick_guide)
        self.assertIn("border-radius: 11px", quick_guide)
        self.assertIn("background: color-mix(in srgb, var(--surface) 92%, transparent)", quick_guide)
        self.assertIn("box-shadow: none", quick_guide)

    def test_triage_scoring_reminders_are_removed(self):
        reminders = (
            "각 항목은 독립적으로 평가합니다.",
            "TR은 입력 또는 공개 자료에서 확인된 indication·target·MoA를 기준으로 평가할 수 있습니다.",
            "MoA와 Data에서 2점 이상을 부여하려면 해당 asset의 공개 technical evidence 또는 공개 data가 필요합니다.",
        )
        for reminder in reminders:
            self.assertNotIn(reminder, HTML)
            self.assertNotIn(reminder, TRIAGE_DETAIL_HTML)

    def test_triage_status_bullet_lists_share_vertical_start(self):
        alignment = CSS[CSS.rindex("Align the three Tab 1 status-card bullet lists") :]
        self.assertIn("@media (min-width: 901px)", alignment)
        self.assertIn("grid-template-rows: auto minmax(74px, auto) 1fr", alignment)
        self.assertIn(".criteria-status-subtitle", alignment)
        self.assertIn("min-height: 74px", alignment)
        self.assertIn(".criteria-status-card > ul", alignment)
        self.assertIn("align-self: start", alignment)
        self.assertIn("margin: 0", alignment)

    def test_final_status_cards_keep_semantic_text_color_on_neutral_surface(self):
        final_status = CSS[CSS.rindex("Tab 1 inner cards mirror the neutral Quick Guide") :]
        self.assertIn('.triage-status-grid[data-criteria-tab="triage"] .criteria-status-card', final_status)
        self.assertIn("background: color-mix(in srgb, var(--surface) 92%, transparent)", final_status)
        self.assertIn("border-radius: 11px", final_status)
        semantic = CSS[CSS.index(".criteria-drawer-body .criteria-pass-grid .criteria-status-heading,") :]
        self.assertIn("color: var(--criteria-status-color)", semantic)

    def test_parameter_titles_are_inline_and_cards_use_quick_guide_surface(self):
        unified = CSS[CSS.index("Tab 1 Parameter titles mirror"):]
        self.assertIn(".triage-parameter-guide .criteria-parameter-title-row h3", unified)
        self.assertIn("display: flex", unified)
        self.assertIn("align-items: baseline", unified)
        self.assertIn('.triage-parameter-guide[data-criteria-tab="triage"] .compact-criteria-detail-grid > article', unified)
        self.assertIn("border-radius: 11px", unified)
        self.assertIn("box-shadow: none", unified)

    def test_triage_detail_header_actions_match_dashboard_instruction_pills(self):
        self.assertIn('id="triageCriteriaDrawerButton"\n              class="detail-header-action-pill help-tooltip"', TRIAGE_DETAIL_HTML)
        self.assertIn('id="triageDeleteRecordButton"\n              class="detail-header-action-pill detail-header-delete-pill danger-button help-tooltip"', TRIAGE_DETAIL_HTML)
        self.assertIn('M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5', TRIAGE_DETAIL_HTML)
        styles = CSS[CSS.rindex("Fast Triage detail actions mirror the dashboard instruction-button pills") :]
        self.assertIn("#triageCriteriaDrawerButton", styles)
        self.assertIn("#triageDeleteRecordButton", styles)
        self.assertIn("border-radius: 999px", styles)
        self.assertIn("background: var(--button-glass)", styles)
        self.assertIn("width: 22px", styles)
        self.assertIn("border-radius: 50%", styles)

    def test_minimal_json_score_views_point_to_the_original_report(self):
        tooltip = function_body(JS, "scoreTooltip")
        score_editor = function_body(JS, "scoreEditSelect")
        triage_scores = function_body(TRIAGE_DETAIL_JS, "renderScores")

        fallback = "상세 판단근거는 GPT ORIGINAL REPORT에서 확인하세요."
        self.assertIn("if (lines.length === scoreLineCount)", tooltip)
        self.assertIn(fallback, tooltip)
        self.assertIn("const tooltip = scoreTooltip", score_editor)
        self.assertIn("수동으로 0–3점 수정할 수 있습니다.", score_editor)
        self.assertIn(fallback, triage_scores)
        self.assertIn("const hasEvidenceMetadata", triage_scores)
        self.assertIn("const evidenceType", triage_scores)
        self.assertIn("const whyNotHigher", triage_scores)
        self.assertIn("${evidenceMetadata.length ? `", triage_scores)
        self.assertNotIn("판단 요약 없음", triage_scores)

    def test_triage_sources_recover_only_asset_scoped_safe_links(self):
        normalizer = function_body(TRIAGE_DETAIL_JS, "normalizeMarkdownSourceUrl")
        markdown_sources = function_body(TRIAGE_DETAIL_JS, "collectMarkdownSources")
        collect_sources = function_body(TRIAGE_DETAIL_JS, "collectSources")

        self.assertIn("new URL(text)", normalizer)
        self.assertIn("parsed.username || parsed.password", normalizer)
        self.assertIn("localhost", normalizer)
        self.assertIn("parsed.hash = ''", normalizer)
        self.assertIn("assetScopedMarkdownFragments(text, record)", markdown_sources)
        self.assertIn("if (!fragments.length) return []", markdown_sources)
        self.assertIn("text.matchAll(referencePattern)", markdown_sources)
        for source_pattern in ("inlinePattern", "referenceUsePattern", "bareUrlPattern"):
            self.assertIn(f"fragment.matchAll({source_pattern})", markdown_sources)
        self.assertIn("source_type: 'GPT Original Report citation'", markdown_sources)
        self.assertIn("function assetScopedMarkdownFragments(markdown, record)", TRIAGE_DETAIL_JS)
        self.assertIn("markdownAssetMatches(cells[assetIndex], expectedVariants)", TRIAGE_DETAIL_JS)
        markdown_call = "collectMarkdownSources(objectValue(record?.source_report).raw_markdown || '', record).forEach(add)"
        self.assertIn(markdown_call, collect_sources)
        self.assertLess(collect_sources.index("structured_table).sources"), collect_sources.index(markdown_call))

    def test_triage_minimal_renderers_tolerate_missing_or_wrong_field_types(self):
        list_values = function_body(TRIAGE_DETAIL_JS, "listValues")
        scores = function_body(TRIAGE_DETAIL_JS, "renderScores")
        sources = function_body(TRIAGE_DETAIL_JS, "collectSources")
        diligence = function_body(TRIAGE_DETAIL_JS, "renderDiligence")

        self.assertIn("value === null || value === undefined", list_values)
        self.assertIn("objectValue(criteria[definition.key])", scores)
        self.assertIn("objectValue(criterion.score_rationale)", scores)
        self.assertIn("firstTextValue", scores)
        self.assertIn("typeof source !== 'object' || Array.isArray(source)", sources)
        self.assertIn("arrayValue(objectValue(record?.structured_table).sources)", sources)
        self.assertIn("const triage = objectValue(record?.triage)", diligence)
        self.assertIn("추가 diligence 정보 없음", diligence)
        self.assertIn("GPT ORIGINAL REPORT", diligence)

    def test_full_filter_honors_persisted_decision_uncertainty(self):
        hard_filter = function_body(JS, "computeHardFilter")
        self.assertIn("record.hard_filter?.decision_uncertainty === true", hard_filter)
        self.assertIn("|| hasScopedFullScoutReviewUncertainty(notes)", hard_filter)

    def test_triage_detail_criteria_drawer_syncs_current_dashboard_tab_one(self):
        self.assertIn('id="triageCriteriaDrawerBody"', TRIAGE_DETAIL_HTML)
        self.assertIn('data-active-criteria-tab="triage"', TRIAGE_DETAIL_HTML)
        self.assertIn('class="criteria-drawer-heading"', TRIAGE_DETAIL_HTML)
        self.assertIn('class="criteria-version-badge">v3.3</span>', TRIAGE_DETAIL_HTML)
        sync = function_body(TRIAGE_DETAIL_JS, "syncCriteriaDrawerFromDashboard")
        self.assertIn("fetch('/', { cache: 'no-store' })", sync)
        self.assertIn("#criteriaDrawer .criteria-drawer-body", sync)
        self.assertIn("section.dataset.criteriaTab === 'triage'", sync)
        self.assertIn("elements.criteriaDrawerBody.replaceChildren(fragment)", sync)
        self.assertIn("elements.criteriaDrawer.dataset.activeCriteriaTab = 'triage'", sync)

    def test_pipeline_detail_criteria_drawer_syncs_current_dashboard_scope(self):
        self.assertIn('id="criteriaDrawerBody"', DETAIL_HTML)
        sync = function_body(DETAIL_JS, "syncCriteriaDrawerFromDashboard")
        self.assertIn("fetch('/', { cache: 'no-store' })", sync)
        self.assertIn("#criteriaDrawer .criteria-drawer-body", sync)
        self.assertIn("section.dataset.criteriaTab === mode", sync)
        self.assertIn("elements.criteriaDrawerBody.replaceChildren(fragment)", sync)
        self.assertIn("elements.criteriaDrawer.dataset.activeCriteriaTab = mode", sync)
        open_drawer = function_body(DETAIL_JS, "openCriteriaDrawer")
        self.assertIn("await syncCriteriaDrawerFromDashboard(mode)", open_drawer)


    def test_full_platform_guide_omits_cross_asset_evidence_note(self):
        self.assertNotIn("같은 platform에 공식 연결된 다른 asset의 근거도 사용할 수 있습니다.", HTML)


    def test_shortlisting_table_fits_without_horizontal_scroll(self):
        fit = function_body(JS, "fitColumnWidthsToTable")
        render = function_body(JS, "renderTable")
        self.assertIn("availableWidth < minimumTotal", fit)
        self.assertIn("activeTableMode() !== 'focus'", fit)
        self.assertIn("availableWidth / minimumTotal", fit)
        self.assertIn("focus-management-table-wrap", render)
        self.assertIn(".table-wrap.focus-management-table-wrap", CSS)
        self.assertIn("overflow-x: hidden", CSS[CSS.index(".table-wrap.focus-management-table-wrap") :])


    def test_all_judgment_tabs_share_the_triage_neutral_canvas(self):
        canvas = CSS[CSS.index("Use one neutral judgment-guide canvas across all three workflow tabs") :]
        for tab in ("triage", "full", "focus"):
            self.assertIn(f'.criteria-drawer[data-active-criteria-tab="{tab}"] .criteria-drawer-body', canvas)
        self.assertIn("background: color-mix(in srgb, var(--canvas) 78%, var(--readable-soft))", canvas)

    def test_home_agent_sends_all_active_tab_and_filter_record_ids(self):
        candidates = function_body(JS, "dashboardAgentCandidateRecordIds")
        request = function_body(JS, "requestDashboardAgentReply")
        stream = function_body(JS, "streamDashboardAgentReply")
        anchor = function_body(JS, "getAgentAnchorRecordId")
        self.assertIn("getVisibleRows()", candidates)
        self.assertIn("new Set", candidates)
        self.assertIn("candidate_record_ids: dashboardAgentCandidateRecordIds()", request)
        self.assertIn("candidate_record_ids: dashboardAgentCandidateRecordIds()", stream)
        self.assertNotIn("state.rows[0]?.id", anchor)
        context = function_body(JS, "buildDashboardAgentContext")
        self.assertIn("scopeRows.length", context)
        self.assertNotIn(".slice(0, 5)", context)
        self.assertIn("app.js?v=20260806-theme-indication-3", HTML)

    def test_table_manual_review_uses_authenticated_user_without_identity_modal(self):
        actor = function_body(JS, "ensureDashboardActorName")
        save = function_body(JS, "saveManualReviewEdit")
        self.assertIn("getCurrentUser() || await requireAuth()", actor)
        self.assertIn("user?.name", actor)
        self.assertIn("await ensureDashboardActorName()", save)
        self.assertNotIn("actor_name:", save)
        self.assertNotIn("reviewerIdentityModal", HTML)
        self.assertNotIn("openReviewerIdentityModal", JS)
        self.assertNotIn("DASHBOARD_REVIEWER_ID_KEY", JS)

    def test_data_upload_locks_contract_and_preserves_separate_tab_drafts(self):
        validator = function_body(JS, "validateCombinedInput")
        preview = function_body(JS, "previewPastedReportParsing")
        save = function_body(JS, "saveStructuredJsonInput")
        guide = function_body(JS, "renderDataUploadGuide")
        self.assertIn("lockedMode", validator)
        self.assertIn("TAB1 Fast Triage", validator)
        self.assertIn("TAB2 Full Scout", validator)
        self.assertIn("최상위 JSON 배열", validator)
        self.assertIn("activeTableMode() === 'triage' ? 'triage' : 'full'", preview)
        self.assertIn("validateCombinedInput(elements.gptResponseInput.value, expectedMode)", preview)
        self.assertIn("validateCombinedInput(elements.gptResponseInput.value, expectedMode)", save)
        self.assertIn("state.dataUploadDrafts[previousMode]", guide)
        self.assertIn("state.dataUploadDrafts[mode]", guide)
        self.assertIn("expandCompactInputRecord(record, lockedMode)", validator)
        self.assertIn("isMinimalCompactIngestionRecord(split.records[index])", validator)
        self.assertIn("compact-ingestion.js?v=20260806-theme-indication-3", JS)

    def test_detail_agent_is_qa_only_without_apply_controls_or_routes(self):
        main_py = (ROOT / "main.py").read_text(encoding="utf-8")
        self.assertNotIn('data-action="apply-ai-reply"', DETAIL_JS)
        self.assertNotIn("JSON/원문에 반영", DETAIL_HTML)
        self.assertNotIn("Agent 답변을 현재 Asset에 반영할까요?", DETAIL_HTML)
        self.assertNotIn('@app.post("/api/records/{record_id:path}/preview-ai-revision")', main_py)
        self.assertNotIn('@app.post("/api/records/{record_id:path}/apply-ai-revision")', main_py)
        self.assertIn("allow_draft: false", DETAIL_JS)
        return

        apply_reply = function_body(DETAIL_JS, "createAiReplyJsonDraft")
        preview = function_body(DETAIL_JS, "requestAiApplyPreview")
        commit = function_body(DETAIL_JS, "commitAiApplyPreview")
        history = function_body(DETAIL_JS, "renderEditHistory")
        self.assertIn("const actorName = await ensureIdentity()", apply_reply)
        self.assertIn("openAiApplyModal", apply_reply)
        self.assertIn("/preview-ai-revision", preview)
        self.assertIn("actor_name: pendingAiApplyContext.actorName", preview)
        self.assertIn("base_record_hash: preview.base_record_hash", commit)
        self.assertIn("/apply-ai-revision", commit)
        self.assertIn("entry?.change_method === 'ai_agent'", history)
        self.assertIn("Agent 답변을 현재 Asset에 반영할까요?", DETAIL_HTML)
        self.assertIn("변경 내용 미리보기", DETAIL_HTML)
        self.assertIn("JSON 점수 및 판단근거", DETAIL_HTML)
        self.assertIn("GPT 원문 리포트", DETAIL_HTML)
        self.assertIn("Wiki export 재생성", DETAIL_HTML)
        self.assertIn("agent-content-preview-1", DETAIL_HTML)
        self.assertIn(".ai-apply-before-after", CSS)
        for filename in ("index.html", "detail.html", "triage_detail.html", "wiki_view.html", "user_admin.html"):
            markup = (ROOT / filename).read_text(encoding="utf-8")
            self.assertIn('./src/styles.css?v=20260805-topic-notes-1', markup)
            self.assertNotIn('href="$1', markup)

        rendered_preview = function_body(DETAIL_JS, "renderAiApplyPreview")
        self.assertIn("aiApplyChangeType(row)", rendered_preview)
        self.assertIn("aiApplyContentPreview(row.after)", rendered_preview)
        self.assertIn("반영 위치", rendered_preview)
        self.assertIn("전체 raw JSON diff 보기", rendered_preview)
        self.assertIn("실제로 추가될 Revision Note", rendered_preview)
        self.assertIn("GPT 원문 리포트 하단 · Revision Note", rendered_preview)
        self.assertIn("원문 Report diff 상세보기", rendered_preview)
        self.assertIn("기존 Wiki 파일을 재생성합니다", rendered_preview)
        self.assertIn('id="aiApplyCommitButton" type="button">최종 반영</button>', DETAIL_HTML)


    def test_agent_send_control_uses_centered_svg_and_spinner(self):
        self.assertIn('class="agent-send-icon"', HTML)
        self.assertIn('class="agent-send-icon"', DETAIL_HTML)
        self.assertNotIn('<span aria-hidden="true">➤</span>', HTML)
        self.assertNotIn('<span aria-hidden="true">➤</span>', DETAIL_HTML)
        submit = JS[JS.index("elements.agentForm.addEventListener('submit'") :]
        for source in (submit, DETAIL_JS):
            self.assertIn('class="agent-send-progress"', source)
            self.assertNotIn("⏳", source)
        styles = CSS[CSS.index(".floating-agent-window .agent-form button {") :]
        self.assertIn("place-items: center", styles)
        self.assertIn("border-radius: 50%", styles)
        self.assertIn("animation: agent-send-progress 800ms linear infinite", styles)
        self.assertIn("transform: rotate(360deg)", styles)
        self.assertIn(".floating-agent-window .agent-send-button:disabled::before", styles)
        self.assertIn("content: none", styles)

    def test_detail_agent_labels_current_asset_scope(self):
        scope_label = "현재 파이프라인 1개"
        self.assertIn(f'<p class="eyebrow">{scope_label}</p>', DETAIL_HTML)
        self.assertIn(scope_label, DETAIL_JS)
        self.assertIn('aria-label="Due Diligence Agent"', DETAIL_HTML)
        self.assertIn('<h2>Due Diligence Agent</h2>', DETAIL_HTML)
        self.assertIn("'Due Diligence Agent'", DETAIL_JS)
        self.assertNotIn("Asset Evidence Agent", DETAIL_HTML)
        self.assertNotIn("심층 검토 Agent", DETAIL_HTML)
        self.assertNotIn("Asset 검토 모드 · 현재 파이프라인만", DETAIL_JS)
        self.assertNotIn('<p class="eyebrow">JSON + Wiki Agent</p>', DETAIL_HTML)
        self.assertIn("JSON + Wiki + Files", HTML)
        self.assertNotIn("JSON + Wiki + 사용자 업로드 파일", HTML)
        self.assertNotIn("JSON + Wiki Agent", HTML)


    def test_home_tab2_uses_one_comparison_example_and_detail_uses_two_asset_questions(self):
        home_example = "예: E/I balance 후보 중 platform attractiveness가 가장 높은 Pipeline 두 개의 장단점을 비교해줘."
        detail_examples = (
            "예: Obtainable peak sales 계산에서 가장 민감한 가정이 무엇인지 알려줘.",
            "예: 점수를 한 단계씩 높이기 위해 필요한 최소 추가 근거를 항목별로 알려줘.",
        )
        self.assertIn('<textarea id="agentInput" rows="2" data-workflow-mode="full"', HTML)
        self.assertIn(f'placeholder="{home_example}"', HTML)
        self.assertIn(home_example, JS)
        self.assertEqual(HTML.count(home_example), 1)
        self.assertIn('<textarea id="chatInput" rows="4"', DETAIL_HTML)
        for example in detail_examples:
            self.assertIn(example, DETAIL_HTML)
            self.assertNotIn(example, HTML)
            self.assertNotIn(example, JS)

        self.assertNotIn("PIPELINE_DISCOVERY_AGENT_INPUT_PLACEHOLDER", JS)
        self.assertIn("full: FULL_SCOUT_AGENT_INPUT_PLACEHOLDER", JS)
        self.assertIn("focus: SHORTLISTING_AGENT_INPUT_PLACEHOLDER", JS)

        workflow = function_body(JS, "renderWorkflowMode")
        self.assertIn("elements.agentInput.dataset.workflowMode = mode", workflow)
        self.assertIn("elements.agentInput.placeholder = AGENT_INPUT_PLACEHOLDERS[mode]", workflow)
        self.assertIn("elements.agentInput.rows = 2", workflow)

        composer = CSS[CSS.index("Home Agent stays compact; the single-pipeline Detail Agent expands") :]
        self.assertIn("min-height: 68px", composer)
        self.assertIn("height: 68px", composer)
        self.assertIn("max-height: 140px", composer)
        self.assertIn("#chatInput", composer)
        self.assertIn("min-height: 124px", composer)
        self.assertIn("max-height: 180px", composer)
        self.assertIn("min-height: 146px", composer)
        self.assertIn("resize: vertical", composer)
        self.assertIn("background: var(--surface)", composer)
        self.assertIn("box-shadow: 0 5px 14px rgba(15, 23, 42, 0.14)", composer)
        self.assertNotIn('textarea[data-workflow-mode="full"]', composer)
        self.assertNotIn('textarea[data-workflow-mode="focus"]', composer)
        focus_rule = composer[composer.index("textarea:focus,") : composer.index('html[data-theme="dark"]')]
        self.assertNotIn("var(--accent)", focus_rule)
    def test_attachment_ai_scope_notice_sits_above_file_selector_and_hides_after_upload(self):
        render_attachments = function_body(DETAIL_JS, "renderAttachments")
        dropzone_index = DETAIL_HTML.index('id="detailAttachmentDropzone"')
        scope_index = DETAIL_HTML.index('class="attachment-ai-scope"')
        add_button_index = DETAIL_HTML.index('id="detailAttachmentAddButton"')
        attachments_list_index = DETAIL_HTML.index('id="detailAttachmentsList"')
        self.assertLess(dropzone_index, scope_index)
        self.assertLess(scope_index, add_button_index)
        self.assertLess(add_button_index, attachments_list_index)
        self.assertIn('id="detailAttachmentAiScope"', DETAIL_HTML)
        self.assertIn('class="attachment-ai-scope-title">AI 질의·정성평가</strong>', DETAIL_HTML)
        self.assertIn('첨부 추출 텍스트 합산 최대 <b>9,000자</b> 활용 가능', DETAIL_HTML)
        self.assertIn('class="attachment-ai-scope-icon"', DETAIL_HTML)
        self.assertIn("elements.detailAttachmentAiScope.hidden = attachments.length > 0", render_attachments)
        self.assertIn("elements.detailAttachmentsList.innerHTML = attachments", render_attachments)
        self.assertNotIn("aiScopeNotice", render_attachments)
        self.assertNotIn("아직 첨부자료가 없습니다.", render_attachments)
        self.assertIn(".attachment-ai-scope", CSS)

    def test_attachment_ai_scope_notice_has_clear_title_hierarchy(self):
        self.assertIn('class="attachment-ai-scope-title"', DETAIL_HTML)
        self.assertIn('class="attachment-ai-scope-detail"', DETAIL_HTML)
        scope_style = CSS[CSS.index(".attachment-ai-scope {") : CSS.index(".attachment-ai-scope-icon {")]
        self.assertIn("border-radius: 10px", scope_style)
        self.assertIn("var(--surface-soft)", scope_style)
        self.assertNotIn("var(--accent)", scope_style)
        icon_style = CSS[CSS.index(".attachment-ai-scope-icon {") : CSS.index(".attachment-ai-scope-icon svg {")]
        self.assertIn("var(--muted)", icon_style)
        self.assertNotIn("var(--accent)", icon_style)
        title_style = CSS[CSS.index(".attachment-ai-scope-title {") : CSS.index(".attachment-ai-scope-detail {")]
        self.assertIn("font-size: 11px", title_style)
        self.assertIn("font-weight: 700", title_style)
        self.assertNotIn("var(--accent)", title_style)
        detail_style = CSS[CSS.index(".attachment-ai-scope-detail {") : CSS.index(".attachment-ai-scope-detail b {")]
        self.assertIn("font-size: 9px", detail_style)
        self.assertIn("line-height: 1.4", detail_style)
        emphasis_style = CSS[CSS.index(".attachment-ai-scope-detail b {") : CSS.index(".attachment-row {")]
        self.assertNotIn("var(--accent)", emphasis_style)

    def test_attachment_file_selector_uses_original_neutral_secondary_style(self):
        self.assertNotIn('class="material-add-button-icon"', DETAIL_HTML)
        button_style = CSS[CSS.index(".material-add-button {") : CSS.index(".detail-material-panel .attachment-status {")]
        self.assertIn("width: calc(100% - 24px)", button_style)
        self.assertIn("justify-content: center", button_style)
        self.assertNotIn("var(--green)", button_style)
        self.assertNotIn("transform:", button_style)

    def test_attachment_rows_prioritize_file_names_without_decorative_tiles(self):
        render_attachments = function_body(DETAIL_JS, "renderAttachments")
        self.assertNotIn("attachmentFileIconMarkup", DETAIL_JS)
        self.assertNotIn('class="attachment-file-icon"', render_attachments)
        self.assertNotIn('<span class="attachment-type-badge">', render_attachments)
        preview_style = CSS[CSS.index(".attachment-preview-button {") : CSS.index(".attachment-type-badge {")]
        self.assertIn("grid-template-columns: minmax(0, 1fr)", preview_style)
        self.assertNotIn("attachment-file-icon", preview_style)

    def test_attachment_preview_preserves_report_outline_and_compact_file_rows(self):
        preview = function_body(DETAIL_JS, "showAttachmentPreview")
        navigate = function_body(DETAIL_JS, "navigateToOutlineTarget")
        self.assertNotIn("renderDetailOutline()", preview)
        self.assertIn("classList.contains('showing-attachment')", navigate)
        self.assertIn("renderSourceReport(currentRecord)", navigate)
        self.assertIn("scrollReportHeadingIntoView", navigate)
        attachments_style = CSS[CSS.index(".attachments-list {") : CSS.index(".attachments-empty {")]
        self.assertIn("align-content: start", attachments_style)

    def test_detail_outline_omits_redundant_pipeline_report_title(self):
        outline = function_body(DETAIL_JS, "renderDetailOutline")
        outline_header = DETAIL_HTML[
            DETAIL_HTML.index('class="detail-outline-header"') :
            DETAIL_HTML.index('id="detailOutlineList"')
        ]
        material_header = DETAIL_HTML[
            DETAIL_HTML.index('class="detail-material-header"') :
            DETAIL_HTML.index('class="detail-material-body"')
        ]
        self.assertIn("<strong>TABLE OF CONTENTS</strong>", outline_header)
        self.assertNotIn("<span>GPT Report</span>", outline_header)
        self.assertIn("<strong>PARTNER MATERIALS</strong>", material_header)
        self.assertNotIn("<span>PRIVATE DATA</span>", material_header)
        self.assertIn(".detail-outline-header span,", CSS)
        self.assertIn(".detail-material-header > div > span", CSS)
        outline_label_style = CSS[CSS.index(".detail-outline-header span {") : CSS.index(".detail-outline-header strong {")]
        outline_title_style = CSS[CSS.index(".detail-outline-header strong {") : CSS.index(".detail-outline-list {")]
        self.assertIn("font-size: 9px", outline_label_style)
        self.assertIn("font-weight: 950", outline_label_style)
        self.assertIn("letter-spacing: 0.055em", outline_label_style)
        self.assertIn("font-size: 13px", outline_title_style)
        self.assertIn("heading.tagName === 'H1'", outline)
        self.assertIn("pipeline\\s+scout\\s+report", outline)
        self.assertIn("return !isReportTitle", outline)
        self.assertLess(outline.index(".filter("), outline.index(".slice(0, 14)"))

    def test_detail_left_rail_shares_space_evenly(self):
        layout = CSS[CSS.index("Share the detail left rail evenly") :]
        self.assertIn("grid-template-rows: repeat(2, minmax(0, 1fr))", layout)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr))", layout)
        self.assertIn(".detail-left-rail .detail-outline-list", layout)
        self.assertIn(".detail-material-body", layout)
        self.assertIn("overflow-y: auto", layout)
        self.assertIn("Use one scrollbar treatment for the detail outline and growing file list", layout)
        self.assertIn(".detail-outline-list::-webkit-scrollbar", layout)
        self.assertIn(".detail-material-body::-webkit-scrollbar", layout)
        self.assertIn("width: 6px", layout)
        self.assertIn("border-radius: 999px", layout)
        self.assertIn("detail.js?v=20260806-theme-indication-3", DETAIL_HTML)

    def test_report_header_matches_review_workspace_and_uses_icon_actions(self):
        report_header = DETAIL_HTML[
            DETAIL_HTML.index('<section class="panel raw-report-panel">') :
            DETAIL_HTML.index('<div id="sourceReportViewer"')
        ]
        self.assertNotIn('id="detailViewerEyebrow"', report_header)
        self.assertIn('<h2 id="detailViewerTitle" class="detail-primary-panel-title">GPT ORIGINAL REPORT</h2>', report_header)
        self.assertIn('<h2 class="detail-primary-panel-title">TEAM REVIEW WORKSPACE</h2>', DETAIL_HTML)
        aligned_headers = CSS[CSS.index("Keep the report and review-workspace titles") :]
        self.assertIn(".detail-shell .collaboration-title-row", aligned_headers)
        self.assertIn("min-height: 0", aligned_headers)
        self.assertIn("align-items: flex-start", aligned_headers)
        self.assertIn(".detail-shell .report-header-copy,", aligned_headers)
        self.assertIn(".detail-shell .collaboration-title-row > div:first-child", aligned_headers)
        self.assertIn("gap: 3px", aligned_headers)
        title_style = CSS[CSS.index(".detail-shell .detail-primary-panel-title {") : CSS.index(".detail-shell .collaboration-title-actions")]
        self.assertIn("font-size: 18px", title_style)
        self.assertIn("line-height: 30px", title_style)
        self.assertIn('<p id="detailSubtitle" hidden></p>', report_header)
        self.assertNotIn("원문 리포트 기반 primary source", report_header)
        self.assertEqual(report_header.count('class="report-action-icon help-tooltip"'), 3)
        self.assertIn('data-tooltip="GPT 원문으로"', report_header)
        self.assertIn('data-tooltip="전체보기"', report_header)
        self.assertIn('data-tooltip="복사"', report_header)
        self.assertIn('<svg viewBox="0 0 24 24"', report_header)

        source_report = function_body(DETAIL_JS, "renderSourceReport")
        attachment_preview = function_body(DETAIL_JS, "showAttachmentPreview")
        copy_source = function_body(DETAIL_JS, "copyCurrentSourceMarkdown")
        self.assertIn("detailViewerTitle.textContent = 'GPT ORIGINAL REPORT'", source_report)
        self.assertIn("elements.subtitle.textContent = ''", source_report)
        self.assertIn("elements.subtitle.hidden = true", source_report)
        self.assertNotIn("summary.target", source_report)
        self.assertNotIn("detailViewerEyebrow", attachment_preview)
        self.assertIn("elements.subtitle.hidden = false", attachment_preview)
        self.assertIn("classList.contains('report-action-icon')", copy_source)
        self.assertIn("button.dataset.tooltip = '복사됨'", copy_source)

        icon_style = CSS[CSS.index(".report-action-icon {") : CSS.index("body.report-modal-open")]
        self.assertIn("width: 30px", icon_style)
        self.assertIn("border-radius: 999px", icon_style)
        self.assertIn(".report-action-icon svg", icon_style)
        self.assertIn("content: attr(data-tooltip)", CSS)

        unified_icons = CSS[CSS.index("Match report action icons to the Review workspace header controls") :]
        self.assertIn(".detail-shell .raw-report-panel > .panel-header", unified_icons)
        self.assertIn("align-items: flex-start", unified_icons)
        self.assertIn(".detail-shell .raw-report-panel .panel-header-actions", unified_icons)
        self.assertIn("align-self: flex-start", unified_icons)
        self.assertIn("min-height: 30px", unified_icons)
        self.assertIn("margin-top: 0", unified_icons)
        self.assertIn("gap: 7px", unified_icons)
        self.assertIn("border: 0", unified_icons)
        self.assertIn("background: var(--accent-soft)", unified_icons)
        self.assertIn("color: var(--accent)", unified_icons)
        self.assertIn("width: 17px", unified_icons)
        self.assertIn("height: 17px", unified_icons)
        self.assertIn("stroke-width: 1.7", unified_icons)

    def test_attachment_preview_uses_three_matching_icon_actions_with_tooltips(self):
        preview = function_body(DETAIL_JS, "showAttachmentPreview")
        self.assertIn("원본 파일 열기", preview)
        self.assertIn("원본 다운로드", preview)
        self.assertIn('download="${escapeHtml(originalName)}"', preview)
        self.assertIn("detailAttachmentOriginalActions.innerHTML", preview)
        self.assertIn('class="report-action-icon help-tooltip attachment-original-action"', preview)
        self.assertIn('data-tooltip="원본 다운로드" aria-label="원본 다운로드"', preview)
        self.assertIn('data-tooltip="원본 파일 열기" aria-label="원본 파일 열기"', preview)
        self.assertIn('M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5', preview)
        self.assertIn('href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener"', preview)
        self.assertNotIn("isConvertedSlide", preview)
        self.assertNotIn("PDF 다운로드", preview)
        self.assertNotIn("PPT 다운로드", preview)
        self.assertNotIn("attachment-preview-toolbar", preview)

        report_header = DETAIL_HTML[
            DETAIL_HTML.index('<section class="panel raw-report-panel">') :
            DETAIL_HTML.index('<div id="sourceReportViewer"')
        ]
        back_index = report_header.index('id="detailViewerBackButton"')
        actions_index = report_header.index('id="detailAttachmentOriginalActions"')
        self.assertLess(back_index, actions_index)
        self.assertIn('id="detailViewerBackGroup" class="detail-viewer-back-group" hidden', report_header)
        self.assertIn('class="report-action-icon help-tooltip"', report_header)
        self.assertIn(".attachment-original-actions", CSS)
        self.assertIn("display: flex", CSS[CSS.index(".detail-viewer-back-group {") : CSS.index(".report-viewer.showing-attachment")])
        attachment_icon_style = CSS[CSS.index("Attachment navigation mirrors the neutral favorite control") :]
        self.assertIn("background: var(--surface-soft)", attachment_icon_style)
        self.assertIn("color: var(--muted)", attachment_icon_style)
        self.assertIn("background: var(--accent-soft)", attachment_icon_style)

    def test_review_workspace_uses_compact_version_refresh_pills_and_owner_meta(self):
        workspace = DETAIL_HTML[
            DETAIL_HTML.index('id="detailReviewInfoStack"') :
            DETAIL_HTML.index('id="detailCollaborationStatus"')
        ]
        self.assertIn('id="rubricRefreshButton" class="criteria-refresh-pill"', workspace)
        self.assertIn('id="oiPartnershipRefreshButton" class="criteria-refresh-pill"', workspace)
        self.assertIn("<span>Score 기준 갱신</span>", workspace)
        self.assertIn("<span>v1.3 기준 갱신</span>", workspace)
        self.assertGreaterEqual(workspace.count('class="metadata-divider"'), 3)
        self.assertIn('<span class="review-info-primary-label">Action Date</span>', workspace)
        self.assertIn("<small>Set by Asset Owner</small>", workspace)
        self.assertGreaterEqual(workspace.count('<svg viewBox="0 0 24 24"'), 2)

        collaboration = function_body(DETAIL_JS, "renderCollaborationPanel")
        score_refresh = function_body(DETAIL_JS, "refreshRubric")
        oi_refresh = function_body(DETAIL_JS, "refreshOiPartnership")
        self.assertIn("detailDecisionOrigin.textContent = `Rubric v${getDisplayRubricVersion(record)}`", collaboration)
        self.assertIn("detailOiPartnershipOrigin.textContent = `OI Partnership v${", collaboration)
        self.assertNotIn("button.textContent", score_refresh)
        self.assertIn("button.classList.add('is-saving')", score_refresh)
        self.assertIn("/recalculate-oi-partnership", oi_refresh)
        self.assertIn("renderCollaborationPanel(currentRecord)", oi_refresh)
        self.assertIn("elements.oiPartnershipRefreshButton?.addEventListener('click', refreshOiPartnership)", DETAIL_JS)

        pill_style = CSS[CSS.index(".criteria-refresh-pill {") : CSS.index(".review-info-row input,")]
        self.assertIn("border-radius: 999px", pill_style)
        self.assertIn("min-height: 22px", pill_style)
        self.assertIn(".criteria-refresh-pill svg", pill_style)
        self.assertIn(".criteria-refresh-pill.is-saving svg", pill_style)

        main_py = (ROOT / "main.py").read_text(encoding="utf-8")
        self.assertIn('@app.post("/api/records/{record_id:path}/recalculate-oi-partnership")', main_py)

    def test_review_workspace_defaults_to_compact_takeaway_summary(self):
        workspace = DETAIL_HTML[
            DETAIL_HTML.index('id="detailReviewInfoStack"') :
            DETAIL_HTML.index('id="detailCollaborationStatus"')
        ]
        self.assertIn('class="review-info-stack is-collapsed"', workspace)
        self.assertIn('<p class="review-column-heading">Full Scout</p>', workspace)
        self.assertIn('<p class="review-column-heading">Shortlisting</p>', workspace)
        self.assertNotIn("Key Takeaway", workspace)
        self.assertNotIn("review-column-context", workspace)
        self.assertIn('id="detailReviewInfoToggle"', workspace)
        self.assertIn('class="review-info-toggle-row"', workspace)
        self.assertIn('aria-expanded="false"', workspace)
        self.assertIn("<span data-review-toggle-label>Show</span>", workspace)

        toggle = function_body(DETAIL_JS, "setReviewInfoExpanded")
        self.assertIn("classList.toggle('is-collapsed', !isExpanded)", toggle)
        self.assertIn("isExpanded ? 'Hide' : 'Show'", toggle)
        self.assertIn("setReviewInfoExpanded(!expanded)", DETAIL_JS)

        compact = CSS[CSS.index("/* Compact Review Workspace takeaway controls") :]
        toggle_row = compact[compact.index(".review-info-toggle-row {") : compact.index(".review-info-toggle svg {")]
        self.assertIn("border-top: 1px solid var(--glass-border)", toggle_row)
        self.assertIn("padding: 6px 8px 7px", toggle_row)
        for hidden_selector in (
            "#detailReviewReasonShell",
            ".oi-classification-summary",
            "#detailOiMaterialFlags",
            "#detailActionOwner",
            "#detailActionPlan",
        ):
            self.assertIn(hidden_selector, compact)
        hidden_block = compact[
            compact.index(".review-info-stack.is-collapsed #detailReviewReasonShell") :
            compact.index(".review-info-stack.is-collapsed .review-info-column .action-info-fields")
        ]
        self.assertNotIn("#detailDecisionStatus", hidden_block)
        self.assertNotIn("#detailScoreSequence", hidden_block)
        self.assertNotIn("#detailOiPartnershipType", hidden_block)
        self.assertNotIn("#detailActionDate", hidden_block)
        self.assertIn(".collaboration-status:empty", compact)
        self.assertIn(".detail-edit-history:empty", compact)
        self.assertIn("margin: -10px 0 0", compact)

    def test_filter_three_review_card_keeps_its_bottom_border(self):
        self.assertIn(".review-info-stack > .review-info-row:last-child", CSS)
        self.assertNotIn("\n.review-info-row:last-child {\n  border-bottom: 0;", CSS)
        column_rule = re.search(r"\.review-info-column\s*\{([^}]*)\}", CSS)
        self.assertIsNotNone(column_rule)
        self.assertIn("border: 1px solid var(--glass-border)", column_rule.group(1))

    def test_detail_workspace_dropdowns_use_shadow_focus_without_note_origin(self):
        focus_style = CSS[CSS.index("/* Detail dropdowns use depth") :]
        self.assertIn(".detail-shell .review-info-row select:focus", focus_style)
        self.assertIn(".detail-shell .review-info-row select:focus-visible", focus_style)
        self.assertIn("border-color: var(--glass-border)", focus_style)
        self.assertIn("outline: none", focus_style)
        self.assertIn("box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14)", focus_style)
        self.assertNotIn("var(--focus-ring)", focus_style)
        self.assertIn(".detail-shell #detailActionDate:hover", focus_style)
        self.assertIn(".detail-shell #detailActionDate:focus", focus_style)
        self.assertIn(".detail-shell #detailActionDate:focus-visible", focus_style)
        self.assertIn("#detailOiPartnershipType + .oi-classification-summary", focus_style)
        self.assertIn("margin-top: 3px", focus_style)
        self.assertNotIn("padding-right: 32px", focus_style)

        review_start = DETAIL_HTML.index('id="detailReviewReasonShell"')
        review_end = DETAIL_HTML.index('</section>', review_start)
        review_markup = DETAIL_HTML[review_start:review_end]
        self.assertIn('title="해당 Pipeline의 최종 평가 의견을 한 줄로 요약합니다."', review_markup)
        self.assertNotIn("detailReviewReasonOrigin", review_markup)
        self.assertNotIn("Rubric rationale", review_markup)
        self.assertNotIn("review-reason-edit-icon", review_markup)
        self.assertNotIn("detailReviewReasonOrigin", DETAIL_JS)

        note_start = DETAIL_HTML.index('id="detailOiPartnershipNoteShell"')
        note_end = DETAIL_HTML.index('id="detailOiMaterialFlags"', note_start)
        note_markup = DETAIL_HTML[note_start:note_end]
        self.assertNotIn("detailOiPartnershipNoteOrigin", note_markup)
        self.assertNotIn("자동 분류 v1.0", note_markup)
        self.assertNotIn("detailOiPartnershipNoteOrigin", DETAIL_JS)
        self.assertIn('title="OI 파트너십 분류 근거를 짧게 요약합니다."', note_markup)
        self.assertNotIn("review-reason-edit-icon", note_markup)
        self.assertIn("detail.js?v=20260806-theme-indication-3", DETAIL_HTML)

    def test_partner_material_body_scrolls_below_fixed_header(self):
        header_index = DETAIL_HTML.index('class="detail-material-header"')
        body_index = DETAIL_HTML.index('class="detail-material-body"')
        dropzone_index = DETAIL_HTML.index('id="detailAttachmentDropzone"')
        selector_index = DETAIL_HTML.index('id="detailAttachmentAddButton"')
        list_index = DETAIL_HTML.index('id="detailAttachmentsList"')
        self.assertLess(header_index, body_index)
        self.assertLess(body_index, dropzone_index)
        self.assertLess(dropzone_index, selector_index)
        self.assertLess(selector_index, list_index)

        body_style = CSS[CSS.index(".detail-material-body {") : CSS.index(".detail-material-body::-webkit-scrollbar {")]
        self.assertIn("max-height: min(48vh, 480px)", body_style)
        self.assertIn("overflow-y: auto", body_style)
        self.assertIn("overscroll-behavior: contain", body_style)
        self.assertIn("scrollbar-width: thin", body_style)

        list_style = CSS[
            CSS.index(".detail-material-panel .detail-material-body .attachments-list {") :
            CSS.index(".detail-material-panel .attachments-list:empty {")
        ]
        self.assertIn("max-height: none", list_style)
        self.assertIn("overflow: visible", list_style)
        for filename in ("index.html", "detail.html", "triage_detail.html", "wiki_view.html", "user_admin.html"):
            markup = (ROOT / filename).read_text(encoding="utf-8")
            self.assertRegex(markup, r'\./src/styles\.css\?v=20260805-[a-z0-9-]+')
        self.assertIn('./src/styles.css?v=20260805-panel-titles-1', DETAIL_HTML)

    def test_data_upload_reviews_same_company_asset_before_replacing_existing_record(self):
        finder = function_body(JS, "findDataReuploadMatches")
        preview = function_body(JS, "previewPastedReportParsing")
        save = function_body(JS, "saveStructuredJsonInput")
        self.assertIn("normalizedCompany", finder)
        self.assertIn("normalizedAsset", finder)
        self.assertIn("existingIdentity.mode === incomingIdentity.mode", finder)
        self.assertIn("reviewDataReuploadMatches", preview)
        self.assertIn("confirmed_replacements", save)
        self.assertIn("incoming_record_id", save)
        self.assertIn("existing_record_id", save)
        self.assertIn("기존 Full Scout 레코드가 발견되었습니다.", HTML)
        self.assertIn("네 · 기존 원문 갱신", HTML)
        self.assertIn("아니요 · 신규로 추가", HTML)

    def test_team_comment_panel_keeps_all_four_corners_rounded(self):
        rounded = CSS[CSS.index("Keep the Team Comments card rounded while only its middle content scrolls") :]
        self.assertIn(".detail-shell .collaboration-panel", rounded)
        self.assertIn("border-radius: 12px", rounded)
        self.assertIn("overflow: hidden", rounded)
        self.assertIn(".detail-shell .collaboration-header", rounded)
        self.assertIn("border-radius: 11px 11px 0 0", rounded)
        self.assertIn(".detail-shell .collaboration-scroll", rounded)
        self.assertIn("min-height: 0", rounded)
        self.assertIn("overflow-y: auto", rounded)
        self.assertIn("overscroll-behavior: contain", rounded)
        self.assertIn("scrollbar-gutter: stable", rounded)
        self.assertIn("border-radius: 0 0 11px 11px", rounded)
    def test_source_report_timestamp_label_reflects_update_origin(self):
        labels = function_body(DETAIL_JS, "sourceReportEditLabel")
        self.assertIn("detail_json_editor", labels)
        self.assertIn("GPT 원문 갱신일", labels)
        self.assertIn("paste_json_upsert", labels)
        self.assertIn("GPT 원문 재업로드일", labels)
        self.assertIn("dashboard_tab2_rubric_recalculation", labels)
        self.assertIn("GPT 원문·Score 갱신일", labels)
        return
        scope_style = CSS[CSS.index(".attachments-empty,\n.attachment-ai-scope") :]
        scope_only = scope_style[scope_style.index(".attachment-ai-scope {\n  font-size") :]
        self.assertIn("font-size: 9px", scope_only.split("}", 1)[0])
        self.assertIn("font-weight: 400", scope_only.split("}", 1)[0])
        self.assertIn("line-height: 1.4", scope_only.split("}", 1)[0])
        dropzone_style = CSS[CSS.index(".attachment-dropzone small {") :]
        self.assertIn("font-size: 9px", dropzone_style.split("}", 1)[0])
        self.assertIn("line-height: 1.4", dropzone_style.split("}", 1)[0])


if __name__ == "__main__":
    unittest.main()
