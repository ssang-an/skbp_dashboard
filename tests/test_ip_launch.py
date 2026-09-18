import copy
import asyncio
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import jsonschema
from unittest.mock import AsyncMock
import main
from ip_launch import normalize_ip_launch
from record_storage import minimize_record_for_dashboard_storage
from tests import test_compact_ingestion as compact

ROOT = Path(__file__).resolve().parents[1]


class IpLaunchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        prompts = compact.CompactIngestionTests.rendered_prompts()
        cls.template = compact.CompactIngestionTests.final_json_template(prompts['full'], '\nFinal validation before output:')
        cls.prompts = prompts

    def record(self):
        return compact.CompactIngestionTests().expand(copy.deepcopy(self.template), 'full')

    def js(self, body):
        module = (ROOT / 'src/research-columns.js').as_uri()
        script = f"import * as m from {json.dumps(module)};\n" + body
        result = subprocess.run(['node', '--input-type=module'], input=script, cwd=ROOT,
                                encoding='utf-8', capture_output=True, check=True)
        return json.loads(result.stdout)

    def assessment(self, record, key='comExpiryYear'):
        return self.js(f'console.log(JSON.stringify(m.ipLaunchAssessment({json.dumps(record)}, {json.dumps(key)})));')

    def test_new_template_versions_and_roundtrip(self):
        record = self.record()
        record['ip_launch_outlook'] = {'com_expiry_year': '2040', 'expected_launch_year': 2032}
        record['source_report']['raw_markdown'] = '## 2A) IP & Launch Outlook\nOriginal evidence retained.'
        main.validate_records_for_save([record])
        saved = minimize_record_for_dashboard_storage(record)
        schema = json.loads((ROOT / 'json/drug-valuation.schema.json').read_text(encoding='utf-8'))
        jsonschema.validate(saved, schema)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'record.json'
            path.write_text(json.dumps(saved), encoding='utf-8')
            restored = json.loads(path.read_text(encoding='utf-8'))
        self.assertEqual(restored['ip_launch_outlook'], {'com_expiry_year': 2040, 'expected_launch_year': 2032})
        self.assertEqual(restored['source_report']['raw_markdown'], record['source_report']['raw_markdown'])
        self.assertEqual(restored['meta']['instruction_version'], '3.9')

    def test_release_preserves_scoring_definition_and_display_version(self):
        old = (ROOT / 'config/scoring_criteria/v3_8_full.md').read_text(encoding='utf-8')
        new = main.SCORING_CRITERIA_FULL_MD.read_text(encoding='utf-8')
        marker = '## 0. Scoring Operating Principle'
        self.assertEqual(old[old.index(marker):].strip(), new[new.index(marker):].strip())
        self.assertEqual(main.FULL_SCOUT_RELEASE['instruction_version'], '3.9')
        self.assertEqual(main.FULL_SCOUT_RELEASE['rubric_version'], '3.9')
        self.assertEqual(main.FULL_SCOUT_RELEASE['display_version'], '3.10')
        self.assertEqual(main.FULL_SCOUT_SCORING_COMPATIBLE_VERSIONS, {'3.8', '3.9'})

    def test_malformed_optional_values_do_not_block_preflight_or_change_scores(self):
        for outlook in [None, [], 'bad', {'com_expiry_year': True, 'expected_launch_year': '2030-2035'},
                        {'com_expiry_year': 2040.5, 'expected_launch_year': {'year': 2030}}]:
            with self.subTest(outlook=outlook):
                record = self.record()
                record['ip_launch_outlook'] = outlook
                before = copy.deepcopy(record['scoring'])
                raw = record['source_report']['raw_markdown']
                request = AsyncMock()
                request.json.return_value = [copy.deepcopy(record)]
                endpoint = next(route.endpoint for route in main.app.routes if getattr(route, 'path', '') == '/api/records/validate')
                response = asyncio.run(endpoint(request))
                self.assertTrue(response['ok'])
                main.validate_records_for_save([record])
                self.assertEqual(record['scoring'], before)
                self.assertEqual(record['source_report']['raw_markdown'], raw)
                self.assertTrue(any('ip_launch_outlook' in s for s in record['validation']['uncertain_points']))
                saved = minimize_record_for_dashboard_storage(record)
                self.assertEqual(self.assessment(saved)['value'], '원문 확인 필요' if isinstance(outlook, dict) else '조사 항목 누락')

    def test_unknown_missing_and_simple_remain_distinct(self):
        for value in [None, '', 'Unknown', 'N/A', '확인 불가']:
            r = {'ip_launch_outlook': {'com_expiry_year': value}}
            normalize_ip_launch(r)
            self.assertIsNone(r['ip_launch_outlook']['com_expiry_year'])
        legacy = {'meta': {'review_type': 'full_scout'}}
        normalize_ip_launch(legacy)
        self.assertNotIn('ip_launch_outlook', legacy)
        simple = {'meta': {'review_type': 'fast_triage'}, 'ip_launch_outlook': {'com_expiry_year': 2040}}
        normalize_ip_launch(simple)
        self.assertNotIn('ip_launch_outlook', simple)

    def test_legacy_compact_version_and_absence_are_preserved(self):
        legacy = copy.deepcopy(self.template)
        legacy.pop('ip_launch_outlook')
        legacy['meta'].pop('instruction_version')
        legacy['meta'].pop('rubric_version')
        record = compact.CompactIngestionTests().expand(legacy, 'full')
        main.validate_records_for_save([record])
        saved = minimize_record_for_dashboard_storage(record)
        self.assertEqual(saved['meta']['instruction_version'], '3.8')
        self.assertNotIn('ip_launch_outlook', saved)
        self.assertEqual(self.assessment(saved)['value'], '미조사')

    def test_compatible_reviews_are_not_invalidated(self):
        record = {'meta': {'review_type': 'full_scout', 'rubric_version': '3.8',
                          'full_scout_rubric_definition_revision': main.FULL_SCOUT_RUBRIC_DEFINITION_REVISION,
                          'rubric_refresh_history': [{'version': '3.8', 'result': 'no_change'}]}}
        before = copy.deepcopy(record)
        self.assertTrue(main.record_has_current_rubric_evaluation(record, '3.9'))
        self.assertTrue(main.record_has_current_ai_rubric_reassessment(record, '3.9'))
        self.assertEqual(record, before)
        record['meta']['rubric_refresh_history'][0]['version'] = '3.7'
        self.assertFalse(main.record_has_current_ai_rubric_reassessment(record, '3.9'))

    def test_explicit_markdown_and_unknown_and_missing(self):
        r = {'source_report': {'raw_markdown': '## 2A) IP & Launch Outlook\n| Expected CoM Base Expiry Year (excluding PTA/PTE) | 2040 | US, patent source |\n| Expected Launch Year | Unknown | No guidance |'}}
        self.assertEqual(self.assessment(r)['value'], 2040)
        self.assertIn('US, patent source', self.assessment(r)['basis'])
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '확인 불가')
        self.assertEqual(self.assessment({'meta': {'instruction_version': '3.9'}})['value'], '조사 항목 누락')
        r['source_report']['raw_markdown'] = '| Expected Launch Year | Not researched | |'
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '미조사')

    def test_ranges_competitors_and_generic_patents_are_not_years(self):
        r = {'source_report': {'raw_markdown': '## Competitors\n| Expected Launch Year | 2030 | Peer |\n## References\n[1]: https://patents.example/2049'}}
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '미조사')
        r['source_report']['raw_markdown'] = '| Expected Patent Expiry / PTE | 2049 | Method of use |'
        self.assertEqual(self.assessment(r)['value'], '원문 확인 필요')
        r['source_report']['raw_markdown'] = '| Expected Launch Year | 2030–2035 | Internal estimate |'
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '원문 확인 필요')

    def test_structured_year_does_not_override_conflicting_markdown(self):
        r = {'ip_launch_outlook': {'expected_launch_year': 2030},
             'source_report': {'raw_markdown': '| Expected Launch Year | 2035 | Company forecast |'}}
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '원문 확인 필요')
        r['source_report']['raw_markdown'] = '| Expected Launch Year | 2030–2035 | Internal estimate |'
        self.assertEqual(self.assessment(r, 'expectedLaunchYear')['value'], '원문 확인 필요')
        r['ip_launch_outlook'] = {'com_expiry_year': 2049}
        r['source_report']['raw_markdown'] = '| Expected Patent Expiry / PTE | 2049 | Method of use |'
        self.assertEqual(self.assessment(r)['value'], '원문 확인 필요')

    def test_optional_input_warning_cannot_change_filter(self):
        record = self.record()
        before = main.calculate_latest_full_scout_filter(record)
        record['ip_launch_outlook'] = {'com_expiry_year': 'asset identity unverified; source unknown'}
        normalize_ip_launch(record)
        self.assertEqual(main.calculate_latest_full_scout_filter(record), before)
        self.assertNotIn('ip_launch_outlook', main.full_scout_rubric_filter_text(record))

    def test_advanced_only_columns_and_exports(self):
        result = self.js("""
const keys = ['comExpiryYear', 'expectedLaunchYear'];
const record = {ip_launch_outlook: {com_expiry_year: 2040, expected_launch_year: 2032}};
const full = m.buildResearchExport([{raw:record}], 'full');
const simple = m.buildResearchExport([{raw:record}], 'triage');
console.log(JSON.stringify({full,simple, keys:m.FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS.filter(c=>keys.includes(c.key)).map(c=>c.key),
 simpleKeys:m.FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS.filter(c=>keys.includes(c.key)), defaults:m.RECOMMENDED_RESEARCH_COLUMNS.full}));
""")
        row = dict(zip(result['full']['headers'], result['full']['body'][0]))
        self.assertEqual(row['CoM base expiry year'], '2040')
        self.assertEqual(row['Expected launch year'], '2032')
        self.assertEqual(len(result['keys']), 2)
        self.assertFalse(result['simpleKeys'])
        self.assertNotIn('CoM base expiry year', result['simple']['headers'])
        self.assertEqual(len(result['defaults']), 6)

    def test_stored_report_inspection_is_read_only(self):
        result = self.js("""
const {readFileSync}=await import('node:fs');
const all=JSON.parse(readFileSync('json/pipeline-records.json','utf8').replace(/^\\uFEFF/,''));
const records=all.filter(r=>r.meta?.review_type==='full_scout');
const before=JSON.stringify(records);
const findings=records.map(r=>['comExpiryYear','expectedLaunchYear'].map(key=>m.ipLaunchAssessment(r,key).value));
console.log(JSON.stringify({unchanged:before===JSON.stringify(records),findings}));
""")
        self.assertTrue(result['unchanged'])
        self.assertTrue(result['findings'])
        for pair in result['findings']:
            self.assertTrue(all(isinstance(v, (int, str)) for v in pair))


if __name__ == '__main__':
    unittest.main()
