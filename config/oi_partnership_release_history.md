# Shortlisting / Filter 3 Criteria Release History

This is the version history for the deterministic Shortlisting (OI Partnership)
classifier. It is separate from the GPT scoring rubrics: Fast Triage and Full
Scout use `instruction_version`/`rubric_version`; Shortlisting uses a
`criteria_version` because it classifies existing structured data and does not
ask GPT to calculate a score.

The active release is declared in `config/rubric-release.json` under
`workflows.shortlisting`. Each tracked pipeline retains the criteria version
that evaluated it in `meta.focus_management.partnership_classification_criteria_version`
and an append-only, capped classification history.

## v1.7 — 2026-09-01 (active)

- Investment eligibility is `IND-enabling` or later for every modality;
  Non-Small Molecule is a preference signal only.
- Reuses the Full Scout six-priority-indication canonical matcher, including
  seizure and focal-onset-seizure wording.
- Adds manifest-based release ownership and per-pipeline classification history.

## v1.6 — historical

- Refreshed tracked pipelines with the shared priority-indication matcher and
  supported typographic apostrophe variants.

## v1.5 — historical

- Aligned the target-indication scope with the six Full Scout priority
  indications.
