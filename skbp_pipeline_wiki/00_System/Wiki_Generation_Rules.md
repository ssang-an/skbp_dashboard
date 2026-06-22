# Wiki Generation Rules

1. Treat `json/pipeline-records.json` as the single source of truth.
2. Preserve raw Markdown reports in `01_Raw_Reports/`.
3. Generate separate notes for assets, companies, targets, MoA, modalities, indications, competitors, sources, scorecards, themes, and clusters.
4. Use deterministic filenames with entity type prefixes.
5. Every important relation should be represented as an Obsidian wikilink and as a graph edge.
6. Do not upgrade evidence type or score without source-level support.
7. Re-run `python scripts/export_pipeline_wiki.py` after JSON changes.
