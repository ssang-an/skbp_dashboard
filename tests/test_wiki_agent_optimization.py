import asyncio
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import main
from tests.test_agent_chat_context import chat_record
from tests.test_dashboard_ia import function_body


ROOT = Path(__file__).resolve().parents[1]


class WikiAgentOptimizationTests(unittest.TestCase):
    def test_search_reads_each_note_once_and_refreshes_between_questions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '02_Assets').mkdir()
            (root / '09_Evidence_Sources').mkdir()
            asset = root / '02_Assets/ALPHA.md'
            evidence = root / '09_Evidence_Sources/Evidence.md'
            asset.write_text('ALPHA Test target E/I Balance [[Evidence]]', encoding='utf-8')
            evidence.write_text('ALPHA clinical trial efficacy evidence VERSION_ONE', encoding='utf-8')
            for i in range(8):
                (root / f'Other{i}.md').write_text('unrelated material', encoding='utf-8')
            record = chat_record('alpha', 'ALPHA', 'Company', 'Epilepsy', 15)
            with patch.object(main, 'WIKI_DIR', root), patch.object(
                Path, 'read_text', autospec=True, side_effect=Path.read_text
            ) as reads:
                results = main.agentic_search_wiki_notes(record, 'ALPHA evidence')
                self.assertEqual(reads.call_count, 10)
                self.assertEqual(len({call.args[0] for call in reads.call_args_list}), 10)
                self.assertTrue(any('VERSION_ONE' in hit['snippet'] for hit in results))
                evidence.write_text('ALPHA clinical trial efficacy evidence VERSION_TWO', encoding='utf-8')
                refreshed = main.agentic_search_wiki_notes(record, 'ALPHA evidence')
                self.assertEqual(reads.call_count, 20)
                self.assertTrue(any('VERSION_TWO' in hit['snippet'] for hit in refreshed))
                self.assertFalse(any('VERSION_ONE' in hit['snippet'] for hit in refreshed))

    def test_search_only_extracts_snippets_for_top_hits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for i in range(12):
                (root / f'Alpha{i}.md').write_text('alpha evidence ' * (i + 1), encoding='utf-8')
            with patch.object(main, 'WIKI_DIR', root), patch.object(
                main, 'make_wiki_snippet', wraps=main.make_wiki_snippet
            ) as snippet:
                results = main.search_wiki_notes('alpha evidence', top_k=3)
                self.assertEqual(len(results), 3)
                self.assertEqual(snippet.call_count, 3)
                self.assertEqual([hit['score'] for hit in results], sorted(
                    [hit['score'] for hit in results], reverse=True))

    def test_stream_emits_progress_before_retrieval_and_preserves_history(self):
        record = chat_record('alpha', 'ALPHA', 'Company', 'Epilepsy', 15)
        history = [{'role': 'user', 'content': 'Prior question'}, {'role': 'assistant', 'content': 'Prior answer'}]

        class Request:
            async def json(self):
                return {'record_id': 'alpha', 'message': 'Compare candidates', 'conversation_id': 'session'}

        async def exercise():
            with patch.object(main, 'require_authenticated_user', return_value={'id': 'test'}), \
                 patch.object(main.chat_history, 'model_history', return_value=history), \
                 patch.object(main, 'load_chat_scope_records', return_value=[record]), \
                 patch.object(main, 'stream_openrouter_chat', return_value=(iter([
                     b'data: {"choices":[{"delta":{"content":"Actual answer"}}]}', b'data: [DONE]'
                 ]), [], None)) as stream:
                response = await main.chat_with_record_stream(Request())
                first = await anext(response.body_iterator)
                self.assertIn('event: status', first)
                stream.assert_not_called()
                rest = ''.join([event async for event in response.body_iterator])
                self.assertIn('Actual answer', rest)
                self.assertIn('event: done', rest)
                self.assertEqual(stream.call_args.kwargs['conversation_history'], history)

        asyncio.run(exercise())

    def test_map_theme_scope_reaches_candidate_ids_and_prompt_without_hop_leakage(self):
        app = (ROOT / 'src/app.js').read_text(encoding='utf-8')
        graph = (ROOT / 'src/sigma_graph.js').read_text(encoding='utf-8')
        script = '''
import assert from 'node:assert/strict';
const raw = {nodes:[
 {id:'a',type:'asset',label:'ALPHA'}, {id:'b',type:'asset',label:'BETA'},
 {id:'c',type:'asset',label:'GAMMA'}, {id:'ei',type:'theme',label:'E/I Balance'},
 {id:'ni',type:'theme',label:'Neuroimmune'}, {id:'ep',type:'indication',label:'Epilepsy'}]};
const nodeMap = () => new Map(raw.nodes.map(node=>[node.id,node]));
const adjacency = new Map([['a',new Set(['ei','ep','b'])],['b',new Set(['ni','a'])],['c',new Set(['ei'])]]);
const selectedThemes=new Set(['E/I Balance']), selectedIndications=new Set(), selectedStages=new Set();
const stageByAsset=new Map([['a','full_scout'],['b','full_scout'],['c','fast_triage']]);
const STAGE_LABEL={full_scout:'Advanced',fast_triage:'Simple'};
const searchKeywords=[];
const normalizedSearchKeyword=value=>String(value||'').toLowerCase();
const state={rawRecords:[
 {id:'alpha',asset:'ALPHA',theme:'E/I Balance',totalScore:16},
 {id:'beta',asset:'BETA',theme:'Neuroimmune',totalScore:21},
 {id:'gamma',asset:'GAMMA',theme:'E/I Balance',totalScore:12}]};
const flattenRecord=row=>row;
const elements={knowledgeMapPanel:{hidden:false},step0Panel:{hidden:true}};
const activeTableMode=()=>'full';
const getVisibleRows=()=>state.rawRecords;
let scope=null; const window={getKnowledgeMapAgentScope:()=>scope};
'''
        for name, source in (
            ('buildKnowledgeMapAgentScope', graph), ('dashboardAgentRows', app),
            ('dashboardAgentCandidateRecordIds', app), ('buildDashboardAgentContext', app),
        ):
            script += f'function {name}() {{' + function_body(source, name) + '}\n'
        script += '''
assert.deepEqual(dashboardAgentRows(),[]);
scope=buildKnowledgeMapAgentScope();
assert.deepEqual(dashboardAgentCandidateRecordIds(),['alpha','gamma']);
const context=buildDashboardAgentContext();
assert.match(context,/Theme=E\\/I Balance/); assert.match(context,/ALPHA/); assert.doesNotMatch(context,/BETA/);
selectedIndications.add('Epilepsy'); scope=buildKnowledgeMapAgentScope();
assert.deepEqual(dashboardAgentCandidateRecordIds(),['alpha']);
selectedStages.add('Simple'); scope=buildKnowledgeMapAgentScope();
assert.deepEqual(dashboardAgentCandidateRecordIds(),[]);
selectedThemes.clear(); selectedIndications.clear(); selectedStages.clear();
searchKeywords.push('gamma'); scope=buildKnowledgeMapAgentScope();
assert.deepEqual(dashboardAgentCandidateRecordIds(),['gamma']);
searchKeywords.length=0; scope=buildKnowledgeMapAgentScope();
assert.deepEqual(dashboardAgentCandidateRecordIds(),['alpha','beta','gamma']);
elements.knowledgeMapPanel.hidden=true;
assert.deepEqual(dashboardAgentRows(),state.rawRecords);
'''
        result = subprocess.run(['node', '--input-type=module'], input=script, encoding='utf-8', capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
