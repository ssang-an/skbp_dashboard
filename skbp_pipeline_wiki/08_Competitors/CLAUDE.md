# CLAUDE.md - 08_Competitors

## Purpose

Competitor asset notes and similarity rationale.

## Naming Rule

- Use deterministic filenames with entity type prefixes.
- Replace spaces with `_`.
- Replace file-system unsafe characters with `_`.
- Preserve aliases in frontmatter.

## Required Frontmatter

- type
- canonical_id
- title
- aliases
- tags
- created_at
- updated_at
- source_report
- source_json
- status
- confidence

## Link Rules

- Use Obsidian wikilinks for every major relationship.
- Asset notes are the graph hub and should link back to all related notes.
- Entity notes should include backlinks to related assets.

## Validation Rules

- Do not leave broken wikilinks.
- Do not promote class-level evidence to asset-specific evidence.
- Scores must be exact integers 0, 1, 2, or 3.
- Source URLs should be captured as source notes whenever available.

## Do Not

- Do not overwrite raw report meaning.
- Do not invent sources.
- Do not create duplicate entity notes for aliases of the same asset or company.
