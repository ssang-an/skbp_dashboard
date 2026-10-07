import csv
import io
import json
from pathlib import Path
import subprocess
import unittest

from tests.test_dashboard_ia import function_body


ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / 'src/app.js').read_text(encoding='utf-8')


def export_script():
    script = '''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const research = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('src/research-columns.js','utf8')).toString('base64'));
const {buildResearchExport, researchColumnValue, formatExtraColumnValue} = research;
let mode = 'triage', stage = 'Phase 1';
const state = {selectedIds:new Set(),step0SelectedPendingIds:new Set(),rows:[],step0Rows:[],page:1,pageSize:10};
const activeTableMode=()=>mode;
const rowMatchesActiveTableMode=row=>mode==='triage' ? row.isTriage : !row.isTriage;
const getVisibleRows=()=>state.rows.filter(row=>rowMatchesActiveTableMode(row) && row.stage===stage).slice().reverse();
const step0FilteredSortedRows=()=>state.step0Rows.filter(row=>row.stage===stage).slice().reverse();
const selectedExtraColumns=()=>[];
const step0DashboardFieldDisplay=row=>row;
const updateHeaderRecordCount=()=>{};
const showStep0Message=()=>{};
const BOM_PREFIX='\\uFEFF';
let lastBlob=null, filename='', downloads=0;
const URL={createObjectURL:blob=>{lastBlob=blob;return 'blob:test';},revokeObjectURL:()=>{}};
const document={body:{appendChild(){}},createElement:()=>({click(){filename=this.download;downloads++;},remove(){}})};
const makeButton=()=>({label:{textContent:''},dataset:{},attributes:{},
 querySelector(){return this.label;},setAttribute(key,value){this.attributes[key]=value;}});
const results=[];
async function capture(button){results.push({csv:await lastBlob.text(),filename,label:button?.label.textContent});}
'''
    for name, params in (
        ('selectedOrFilteredExportRows', 'filteredRows, allRows, selectedIds, rowId'),
        ('pipelineExportRows', 'filteredRows = getVisibleRows()'),
        ('step0ExportRows', 'filteredRows = step0FilteredSortedRows()'),
        ('updateExcelExportButton', 'button, rows, hasSelection'),
        ('csvValue', 'value'), ('scoreExportFields', 'row, key'),
        ('exportPipelineTable', ''), ('exportStep0Table', ''),
    ):
        script += f'function {name}({params}) {{' + function_body(JS, name) + '}\n'
    return script


def run_js(script):
    result = subprocess.run(['node', '--input-type=module'], input=export_script() + script,
                            encoding='utf-8', capture_output=True, cwd=ROOT)
    if result.returncode:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


def assets(export):
    return [row['Asset'] for row in csv.DictReader(io.StringIO(export['csv'].lstrip('\ufeff')))]


class SelectedExcelExportTests(unittest.TestCase):
    def test_research_csv_uses_checked_rows_across_pages_or_all_filtered_rows(self):
        for mode in ('triage', 'full'):
            with self.subTest(mode=mode):
                results = run_js('mode=' + json.dumps(mode) + ';\n' + '''
state.rows=Array.from({length:25},(_,i)=>({id:`r${i}`,asset:`Asset ${i}`,company:'Company',
 isTriage:mode==='triage',stage:i<24?'Phase 1':'Phase 2',raw:{},criteria:{}}));
state.rows.push({id:'other-tab',asset:'Other tab',isTriage:mode!=='triage',stage:'Phase 1',raw:{},criteria:{}});
const button=makeButton();
updateExcelExportButton(button,pipelineExportRows(),false);
assert.equal(button.label.textContent,'전체 24개 Excel export');
exportPipelineTable(); await capture(button);
state.selectedIds=new Set(['r1','r21']);
updateExcelExportButton(button,pipelineExportRows(),true);
assert.equal(button.label.textContent,'선택 2개 Excel export');
exportPipelineTable(); await capture(button);
stage='Phase 2';
exportPipelineTable(); await capture();
state.selectedIds.clear();
exportPipelineTable(); await capture();
state.selectedIds.add('deleted');
updateExcelExportButton(button,pipelineExportRows(),true);
assert.equal(button.disabled,true);
const before=downloads; exportPipelineTable(); assert.equal(downloads,before);
console.log(JSON.stringify(results));
''')
                self.assertEqual(assets(results[0]), [f'Asset {i}' for i in reversed(range(24))])
                self.assertEqual(assets(results[1]), ['Asset 21', 'Asset 1'])
                self.assertEqual(set(assets(results[2])), {'Asset 1', 'Asset 21'})
                self.assertEqual(assets(results[3]), ['Asset 24'])
                self.assertIn('simple_research' if mode == 'triage' else 'advanced_research', results[0]['filename'])

    def test_listing_csv_uses_queue_selection_or_all_filtered_rows(self):
        results = run_js('''
state.step0Rows=Array.from({length:31},(_,i)=>({asset:`Listing ${i}`,company:'Company',
 stage:i<30?'Phase 1':'Phase 2',pending:{done:true,queue_id:`q${i}`},metadata:{},listing_details:{}}));
const button=makeButton();
updateExcelExportButton(button,step0ExportRows(),false);
assert.equal(button.label.textContent,'전체 30개 Excel export');
exportStep0Table(); await capture(button);
state.step0SelectedPendingIds=new Set(['q1','q25']);
updateExcelExportButton(button,step0ExportRows(),true);
assert.equal(button.label.textContent,'선택 2개 Excel export');
exportStep0Table(); await capture(button);
stage='Phase 2'; exportStep0Table(); await capture();
state.step0SelectedPendingIds.clear(); exportStep0Table(); await capture();
stage='No matches'; updateExcelExportButton(button,step0ExportRows(),false);
assert.equal(button.disabled,true);
const before=downloads; exportStep0Table(); assert.equal(downloads,before);
console.log(JSON.stringify(results));
''')
        self.assertEqual(assets(results[0]), [f'Listing {i}' for i in reversed(range(30))])
        self.assertEqual(assets(results[1]), ['Listing 25', 'Listing 1'])
        self.assertEqual(set(assets(results[2])), {'Listing 1', 'Listing 25'})
        self.assertEqual(assets(results[3]), ['Listing 30'])

    def test_header_selection_keeps_listing_cap_and_research_page_selection(self):
        script = '''
const handlers={};
const elements={step0SelectAllRows:{addEventListener:(name,fn)=>handlers.listing=fn},
 pipelineTableHead:{addEventListener:(name,fn)=>handlers.research=fn}};
const renderStep0ProgressTable=()=>{},renderStep0SelectedCount=()=>{},renderFilteredDashboard=()=>{};
const STEP0_MAX_SELECTED_CANDIDATES=20;
'''
        for selector in ('step0SelectAllRows', 'pipelineTableHead'):
            marker = f"elements.{selector}?.addEventListener('change', (event) => {{"
            body = JS.split(marker, 1)[1].split('\n});', 1)[0]
            script += marker + body + '\n});\n'
        script += '''
state.step0Rows=Array.from({length:35},(_,i)=>({asset:`Listing ${i}`,stage:'Phase 1',pending:{done:true,queue_id:`q${i}`}}));
state.step0VisiblePendingIds=state.step0Rows.map(row=>row.pending.queue_id);
handlers.listing({target:{checked:true,dataset:{}}});
assert.equal(state.step0SelectedPendingIds.size,20);
exportStep0Table(); await capture();
state.rows=Array.from({length:35},(_,i)=>({id:`r${i}`,asset:`Asset ${i}`,isTriage:true,stage:'Phase 1',raw:{},criteria:{}}));
state.page=2;
handlers.research({target:{id:'selectPageRows',checked:true}});
assert.equal(state.selectedIds.size,10);
exportPipelineTable(); await capture();
handlers.research({target:{id:'selectPageRows',checked:false}});
assert.equal(state.selectedIds.size,0);
exportPipelineTable(); await capture();
console.log(JSON.stringify(results));
'''
        results = run_js(script)
        self.assertEqual(set(assets(results[0])), {f'Listing {i}' for i in range(20)})
        self.assertEqual(assets(results[1]), [f'Asset {i}' for i in range(24, 14, -1)])
        self.assertEqual(len(assets(results[2])), 35)


if __name__ == '__main__':
    unittest.main()
