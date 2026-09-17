import csv
import io
import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which('node'), 'Node.js required')
class ResearchColumnsTests(unittest.TestCase):
    def run_js(self, code):
        script = """
import {readFileSync} from 'node:fs';
const text = readFileSync('src/research-columns.js', 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
const {buildResearchExport, researchColumnValue, FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS: full,
 FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS: simple} = mod;
""" + code
        result = subprocess.run([shutil.which('node'), '--input-type=module'], input=script,
                                encoding='utf-8', capture_output=True, check=True, cwd=ROOT)
        return json.loads(result.stdout)

    def test_recommendation_sources_and_peer_names_use_stored_contract(self):
        result = self.run_js("""
const record = {
 final_insight: {recommendation:'Watch'}, scoring:{recommendation:'legacy'},
 validation:{source_registry:[{source_title:'Registry',source_url:'https://example.test/trial'}]},
 competitive_analysis:{competitor_table:[{competitor_asset:'Peer-A', company:'Company A'}],
 similar_pipelines:[{asset_name:'Fallback peer'}]}
};
console.log(JSON.stringify({
 recommendation:researchColumnValue(record,full.find(c=>c.key==='recommendation')),
 source:buildResearchExport([{raw:record,criteria:{}}],'full'),
 peers:researchColumnValue(record,full.find(c=>c.key==='peerNames')),
 removedSelectable:[full,simple].some(columns=>columns.some(c=>['parserStatus','firstSource','allSources','peerContext'].includes(c.key))),
 missingCount:researchColumnValue(record,full.find(c=>c.key==='similarCount')) ?? null
}));
""")
        self.assertEqual(result['recommendation'], 'Watch')
        exported = dict(zip(result['source']['headers'], result['source']['body'][0]))
        self.assertIn('https://example.test/trial', exported['Research sources'])
        self.assertEqual(result['peers'], ['Peer-A — Company A'])
        self.assertFalse(result['removedSelectable'])
        self.assertIsNone(result['missingCount'])

    def test_simple_export_has_only_three_criteria_and_retains_all_evidence(self):
        result = self.run_js("""
const row = {id:'new', company:'Sample', asset:'AB-01', filter1:'SELECT',
 criteria:{target:{score:3}, moa:{score:2}, data:{score:3}},
 raw:{triage:{why:'Priority indication', verified_public_source_count:0,
 missing_evidence_needed_for_full_scout:['a','b','c','d','e']},
 validation:{uncertain_points:['1','2','3','4']},
 final_insight:{recommendation:'Run Full Scout', most_important_diligence_question:'Show human PD'},
 scoring:{criteria:{moa_validity:{source_ids:['SRC-1']}}}}};
row.raw.validation.source_registry=[{source_id:'SRC-1',source_title:'Study',source_url:'https://example.test/study'}];
console.log(JSON.stringify(buildResearchExport([row],'triage',simple)));
""")
        row = dict(zip(result['headers'], result['body'][0]))
        self.assertEqual(row['Screening decision'], 'SELECT')
        self.assertEqual(row['Verified source count'], '0')
        self.assertEqual(row['Evidence needed next'], 'a\nb\nc\nd\ne')
        self.assertEqual(row['Evidence gaps'], '1\n2\n3\n4')
        self.assertIn('https://example.test/study', row['Mechanism validity sources'])
        self.assertFalse(any('Marketability' in key or 'Peer count' in key or 'Filter 3' in key for key in row))
        self.assertEqual(len(result['headers']), len(set(result['headers'])))
        self.assertEqual(len(result['headers']), len(result['body'][0]))

    def test_full_export_keeps_report_count_and_does_not_cap_peers(self):
        result = self.run_js("""
const record={competitive_analysis:{similarity_summary:{similar_pipeline_count:2},
 competitor_table:Array.from({length:12},(_,i)=>({competitor_asset:'Peer-'+i,company:'Peer Co',stage:'Phase 1',why_it_matters:'Comparator',source_url:'https://example.test/'+i}))}};
console.log(JSON.stringify(buildResearchExport([{raw:record,criteria:{},totalScore:0}], 'full', full)));
""")
        row = dict(zip(result['headers'], result['body'][0]))
        self.assertEqual(row['Peer count in report'], '2')
        self.assertIn('Peer-11', row['Peer drugs in report'])
        self.assertIn('https://example.test/11', row['Peer comparison evidence'])
        self.assertEqual(row['Total score (0–21)'], '0')
        self.assertIn('Marketability score (0–3)', row)
        self.assertNotIn('Direct Competitor Count', row)
        self.assertEqual(len(row), len(result['headers']))

    def test_early_stop_is_not_exported_as_completed_zero_score(self):
        result = self.run_js("""
const row={earlyStop:{reason:'Identity not verified'},totalScore:0,
criteria:{target:{score:0},moa:{score:0},data:{score:0}},raw:{}};
console.log(JSON.stringify(buildResearchExport([row],'full')));
""")
        row = dict(zip(result['headers'], result['body'][0]))
        self.assertEqual(row['Assessment status'], 'Not assessed: Identity not verified')
        self.assertEqual(row['Target relevance score (0–3)'], '')
        self.assertEqual(row['Total score (0–21)'], '')

    def test_simple_projection_identifies_advanced_research_origin(self):
        result = self.run_js("""
console.log(JSON.stringify(buildResearchExport([{raw:{},isVirtualTriage:true,
 filter1:'SELECT',hardFilterReason:'Advanced result projected into Simple',criteria:{}}],'triage')));
""")
        row = dict(zip(result['headers'], result['body'][0]))
        self.assertEqual(row['Research origin'], 'Advanced Research (shown in Simple Research)')
        self.assertEqual(row['Decision rationale'], 'Advanced result projected into Simple')

    def test_production_csv_quoting_round_trips_korean_quotes_and_newlines(self):
        result = self.run_js("""
const source = readFileSync('src/app.js','utf8');
const start = source.indexOf('function csvValue(');
eval(source.slice(start,source.indexOf('function scoreExportFields(',start)) + '\\nglobalThis.csvCell = csvValue;');
const report = buildResearchExport([{company:'회사, A',asset:'AB-01',criteria:{},raw:{
final_insight:{one_line_summary:'첫째 "근거"\\n둘째 근거'}}}],'triage');
const csv = [report.headers,...report.body].map(row=>row.map(globalThis.csvCell).join(',')).join('\\r\\n');
console.log(JSON.stringify({csv,report}));
""")
        parsed = list(csv.reader(io.StringIO(result['csv'])))
        self.assertEqual(parsed, [result['report']['headers'], *result['report']['body']])
        self.assertIn('첫째 "근거"\n둘째 근거', parsed[1])


if __name__ == '__main__':
    unittest.main()
