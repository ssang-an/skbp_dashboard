import json
import shutil
import subprocess
import unittest
from pathlib import Path

import main


ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which('node'), 'Node.js required')
class AutomaticReuploadTests(unittest.TestCase):
    def run_matches(self, cases):
        source = (ROOT / 'src/app.js').read_text(encoding='utf-8')
        # Execute the production matching functions without the dashboard DOM.
        matching = source[source.index('function normalizedPipelineIdentityText('):
                          source.index('function findIncomingDuplicateMatches(')]
        script = '''
const state = {rawRecords: []};
const isInputObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const detectInputRecordMode = record => ({mode: record.meta.review_type === 'fast_triage' ? 'triage' : 'full'});
const recordIdentifier = record => record.meta.output_filename_base;
''' + matching + '''
const results = CASES.map(test => {
  state.rawRecords = test.existing;
  return findDataReuploadMatches([test.incoming]).map(match => ({
    candidates: match.candidates.length,
    decision: automaticExactReuploadDecision(match)
  }));
});
process.stdout.write(JSON.stringify(results));
'''.replace('CASES', json.dumps(cases))
        result = subprocess.run([shutil.which('node')], input=script, text=True,
                                encoding='utf-8', capture_output=True, check=True, cwd=ROOT)
        return json.loads(result.stdout)

    def record(self, company, asset='PSK-01', record_id='old', aliases='', mode='fast_triage'):
        return {'meta': {'output_filename_base': record_id, 'review_type': mode,
                         'pipeline_metadata': {'company_aliases': aliases}},
                'structured_table': {'company': company, 'asset_name': asset}}

    def test_company_confirmation_matches_tab0_alias_rules(self):
        pairs = [
            ('Ribo Life Science', 'Ribo Life Science', ''),
            ('P.S.K. Biosciences Ltd.', 'PSK Bioscience', ''),
            ('Alpha Inc.', 'Alpha', ''),
            ('GeneScience (GenSci)', 'GenSci', ''),
            ('Old Name', 'New Name', 'Old Name'),
            ('Alpha', 'Alpha International', ''),
            ('Alpha GmbH', 'Alpha', ''),
            ('Unknown', 'Unknown', ''),
            ('Unknown (Alpha)', 'Unknown (Beta)', ''),
        ]
        cases = [{'incoming': self.record(left, record_id='new'),
                  'existing': [self.record(right, aliases=aliases)]}
                 for left, right, aliases in pairs]
        results = self.run_matches(cases)
        for (left, right, aliases), result in zip(pairs, results):
            with self.subTest(left=left, right=right):
                placeholders = {'unknown', 'na', 'tbd', 'asset', 'company'}
                expected = bool((main.company_aliases_from_text(left) - placeholders) &
                                ((main.company_aliases_from_text(right) |
                                  main.company_aliases_from_text(aliases)) - placeholders))
                decision = result[0]['decision'] if result else None
                self.assertEqual(bool(decision), expected)
                if expected:
                    self.assertEqual(decision['existingRecordId'], 'old')
                    self.assertTrue(decision['preserveAssetAliases'])

    def test_asset_formatting_and_ambiguity(self):
        cases = [
            ('PSK-01', 'psk01', True),
            ('CLZ-003', 'CLZ3', True),
            ('ABC101', 'XYZ101', False),
            ('ABC101A', 'ABC101B', False),
            ('AR1001', '1001', False),
            ('Unknown', 'Unknown', False),
        ]
        results = self.run_matches([
            {'incoming': self.record('Alpha', asset=left, record_id='new'),
             'existing': [self.record('Alpha', asset=right)]}
            for left, right, _ in cases])
        for (left, right, expected), result in zip(cases, results):
            with self.subTest(left=left, right=right):
                self.assertEqual(bool(result and result[0]['decision']), expected)

    def test_multiple_candidates_and_different_workflows_require_separate_handling(self):
        incoming = self.record('Alpha', record_id='new')
        duplicate, other_workflow = self.run_matches([
            {'incoming': incoming, 'existing': [self.record('Alpha'), self.record('Alpha', record_id='old2')]},
            {'incoming': incoming, 'existing': [self.record('Alpha', mode='full_scout')]},
        ])
        self.assertEqual(duplicate[0]['candidates'], 2)
        self.assertIsNone(duplicate[0]['decision'])
        self.assertEqual(other_workflow, [])


if __name__ == '__main__':
    unittest.main()
