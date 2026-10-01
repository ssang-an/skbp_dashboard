import json
import subprocess
import unittest
from pathlib import Path

import main

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / 'src/app.js').read_text(encoding='utf-8')
CASES = {
    'IND approved; Phase 2 ongoing': 'Phase 2',
    'FDA approved IND; Phase 1 ongoing': 'Phase 1',
    'FDA approved an IND': 'IND filed/cleared',
    'PCC selected; IND-enabling ongoing': 'IND-enabling',
    'Phase 1/2 completed; Phase 2 ongoing': 'Phase 2',
    'Phase 2/3 completed; Phase 3 ongoing': 'Phase 3',
    'Phase 1b/2a ongoing': 'Phase 1/2',
    'Phase 2b/3 ongoing': 'Phase 2/3',
    'P1 / P2 ongoing': 'Phase 1/2',
    'P2 / P3 ongoing': 'Phase 2/3',
    'P1 / P2 completed; Phase 2 ongoing': 'Phase 2',
    'Phase 2 planned; Phase 2 ongoing in another indication': 'Phase 2',
    'Phase 1 completed; Phase 2 planned': 'Phase 1',
    'IND filed planned; preclinical': 'Preclinical unspecified',
    'PCC planned; lead optimization ongoing': 'Lead Optimization',
    'NDA submitted planned; Phase 3 ongoing': 'Phase 3',
    'FDA approved expected; Phase 3 ongoing': 'Phase 3',
    'NDA submitted; FDA approved': 'Approved / marketed',
    '허가 심사 중': 'Registration',
    '품목 허가 완료': 'Approved / marketed',
    'Phase 2 planned': 'Unknown',
    'Phase 2 not confirmed': 'Unknown',
    'preclinical': 'Preclinical unspecified',
    'Phase 2; program discontinued': 'Discontinued / inactive',
    'Phase 2; trial suspended': 'Phase 2',
    'Undefined stage description': 'Unknown',
}


def js_function(name):
    start = JS.index('function ' + name + '(')
    end = JS.index('\nfunction ', start + 1)
    return JS[start:end]


class PipelineStageTests(unittest.TestCase):
    def test_confirmed_stage_precedence_and_plans(self):
        for wording, expected in CASES.items():
            with self.subTest(wording=wording):
                self.assertEqual(main.canonicalize_development_stage(wording), expected)

    def test_whole_value_dictionary_aliases_are_consistent(self):
        for entry in main.category_synonym_dictionary()['stage']:
            for alias in entry.get('synonyms', []):
                with self.subTest(alias=alias):
                    self.assertEqual(main.canonicalize_development_stage(alias), entry['canonical'])
        self.assertEqual(main.canonicalize_development_stage('First-in-human planned'), 'Unknown')
        self.assertEqual(main.canonicalize_development_stage('Launched planned'), 'Unknown')

    def test_browser_and_backend_agree_for_aliases_cases_and_stored_source_values(self):
        records = json.loads((ROOT / 'json/pipeline-records.json').read_text(encoding='utf-8'))
        values = list(CASES) + list(main.CANONICAL_DEVELOPMENT_STAGES)
        values += [alias for entry in main.category_synonym_dictionary()['stage'] for alias in entry.get('synonyms', [])]
        values += [r.get('structured_table', {}).get('development_stage_source') or r.get('structured_table', {}).get('development_stage') for r in records]
        queue = json.loads((ROOT / 'json/candidate-queue.json').read_text(encoding='utf-8'))
        values += [(r.get('listing_details') or {}).get('stage') for r in queue]
        program = 'const state = ' + json.dumps({'categorySynonyms': main.category_synonym_dictionary()}) + ';\n'
        program += 'const CANONICAL_DEVELOPMENT_STAGES = ' + json.dumps(main.CANONICAL_DEVELOPMENT_STAGES) + ';\n'
        program += js_function('canonicalDevelopmentStage')
        program += '\nconsole.log(JSON.stringify(' + json.dumps(values) + '.map(canonicalDevelopmentStage)));'
        result = subprocess.run(['node', '--input-type=module'], input=program, text=True, encoding='utf-8', capture_output=True, check=True)
        actual = json.loads(result.stdout)
        self.assertEqual(actual, [main.canonicalize_development_stage(value) for value in values])

    def test_stage_multiselect_uses_existing_filter_state_without_score_interference(self):
        program = 'const state = {stage: ["Phase 1", "Phase 2"], scoreFilters: {targetScore: ["gte:2"]}};\n'
        program += 'const CANONICAL_DEVELOPMENT_STAGES = ' + json.dumps(main.CANONICAL_DEVELOPMENT_STAGES) + ';\n'
        program += 'const SCORE_FILTER_OPTIONS = [{value:"gte:2",label:"2+"}];\n'
        for name in ('scoreFilterOptionsFor', 'scoreFilterSelections', 'scoreFilterMatches', 'selectedFilterValues', 'selectedFilterMatches'):
            program += js_function(name) + '\n'
        program += '''
const rows = [{stage:'Phase 1',score:2},{stage:'Phase 2',score:3},{stage:'Phase 3',score:3},{stage:'Phase 2',score:1},{stage:'Phase 1/2',score:3}];
const selected = rows.filter(r=>selectedFilterMatches(state.stage,r.stage)&&scoreFilterMatches('targetScore',r.score));
if (selected.length !== 2) throw Error('OR within stages / AND with TAR failed');
if (scoreFilterSelections('stage').length !== 2 || scoreFilterSelections('targetScore').length !== 1) throw Error('State collision');
state.stage = []; if (!selectedFilterMatches(state.stage,'Unknown')) throw Error('Clear failed');
state.stage = ['Approved / marketed']; if (rows.some(r=>selectedFilterMatches(state.stage,r.stage))) throw Error('Empty results must remain empty');
'''
        subprocess.run(['node', '--input-type=module'], input=program, text=True, encoding='utf-8', capture_output=True, check=True)

    def test_stage_ranges_include_only_fully_covered_unspecified_intervals(self):
        program = 'const CANONICAL_DEVELOPMENT_STAGES = ' + json.dumps(main.CANONICAL_DEVELOPMENT_STAGES) + ';\n'
        start = JS.index('const ORDERED_DEVELOPMENT_STAGES =')
        program += JS[start:JS.index('function stageRangeSummary', start)]
        program += """
const result = (operator,start,end) => stageRangeResult({operator,start,end});
const assert = (value,message) => {if(!value) throw Error(message)};
const pre = result('between','Hit Discovery','IND-enabling');
assert(pre.values.length===5 && pre.values.includes('Preclinical unspecified') && !pre.values.includes('IND filed/cleared'),'preclinical preset');
assert(result('lt','Phase 1').values.includes('IND filed/cleared'),'preclinical plus IND');
const latePre = result('gte','Preclinical Candidate');
assert(!latePre.values.includes('Preclinical unspecified') && latePre.values.includes('Clinical unspecified'),'partial preclinical');
const phase2 = result('gte','Phase 2');
assert(phase2.values.includes('Phase 2/3') && phase2.values.includes('Approved / marketed') && !phase2.values.includes('Clinical unspecified'),'phase2 threshold');
assert(!result('gt','Phase 2').values.includes('Phase 2'),'strict boundary');
const clinical = result('between','Phase 1','Phase 3');
assert(clinical.values.includes('Clinical unspecified') && !clinical.values.includes('Registration'),'clinical interval');
assert(!result('between','Phase 1','Phase 2').values.includes('Clinical unspecified'),'uncertain phase excluded');
assert(result('between','Phase 3','Phase 1').error,'reversed interval blocked');
assert(result('gt','Approved / marketed').error && result('lt','Hit Discovery').error,'empty interval must not become all');
assert(result('gte','Unknown').error,'unknown boundary');
assert(result('all').values.length===0 && !result('all').error,'reset');
const presetValues = key => stageRangeResult(STAGE_RANGE_PRESETS.find(p=>p.key===key).range).values;
assert(JSON.stringify(presetValues('clinical_lt2'))===JSON.stringify(['Phase 1','Phase 1/2']),'clinical only below phase2');
assert(JSON.stringify(presetValues('clinical_lte2'))===JSON.stringify(['Phase 1','Phase 1/2','Phase 2']),'clinical only through phase2');
assert(JSON.stringify(presetValues('phase3'))===JSON.stringify(['Phase 3']),'phase3 only');
assert(JSON.stringify(presetValues('lead_ind'))===JSON.stringify(['Lead Optimization','Preclinical Candidate','IND-enabling']),'lead through IND enabling');
for(const operator of ['gt','gte','lt','lte']) {
  for(const stage of ORDERED_DEVELOPMENT_STAGES) {
    const r=result(operator,stage);
    assert(!r.values.includes('Unknown') && !r.values.includes('Discontinued / inactive'),'unranked stages excluded');
  }
}
"""
        subprocess.run(['node', '--input-type=module'], input=program, text=True, encoding='utf-8', capture_output=True, check=True)


if __name__ == '__main__':
    unittest.main()
