# AI Bot conversations and retrieval

Dashboard tabs share each authenticated user's personal conversations. The asset detail
page has a separate conversation scope per record. The session picker and 새 대화 button
are available to every signed-in user. Only developers see 전체 대화, a read-only view
of conversations from all users and scopes; the backend enforces this independently
of the UI. Admin accounts without the developer role cannot access that view.

`chat_history.py` stores conversations in `data/chat-history.sqlite3`, outside static
mounts and version control. Back up this file with the application's private data and
use a persistent disk in hosting. Research records remain in `json/pipeline-records.json`.
Optimistic versions reject simultaneous stale updates instead of silently overwriting
another browser's messages. Responses are marked no-store. The old anonymous browser
history is not read or automatically imported because its owner cannot be established.
No existing research or anonymous history is deleted by this migration.

The UI clears private messages on account change, including changes in another tab,
and aborts the old request. Conversation switching is disabled while generating an
answer. A reloaded incomplete response is explicitly marked interrupted. Saving errors
remain visible. History is no longer silently trimmed to 12 sessions or 60 messages;
one session accepts up to 1,000 messages, 40,000 characters per message, and a 4 MB
serialized request, with explicit errors when a limit is reached.

The desktop window defaults to 760 × 820 px, constrained to the viewport, with drag,
resize, minimize and maximize controls. Mobile uses the full viewport. The floating
surface is attached to body so map/workspace transforms cannot clip it.

Retrieval scope:

- Listing: current filtered candidates, including entries with no research yet.
- Simple / Advanced / Custom: the current filtered table, across pagination.
- Wiki Map: all stored research records, plus the selected node in the question.
- Asset detail: the current record.

The model receives authenticated conversation history plus relevant structured records,
original-report excerpts, extracted attachments, and Wiki search snippets. It does not
perform a new public-web search. Current limits are 500 candidate IDs, 10 selected
records, 5 Wiki snippets, and the most recent completed conversation turns fitting
20 messages / 16,000 characters. Long reports and attachments are excerpted. These
limits bound a single request; they do not mean every stored document was fully read.
Provider stream errors and empty responses trigger a clearly labeled local fallback.

Validation uses temporary conversation databases and mocked OpenRouter transport.
`tests/test_chat_privacy.py` covers account isolation, developer-only reading, ownership
spoofing, version conflicts, deletion, Listing retrieval, follow-up context, and provider
failures. No live API charge, email, or production-record mutation is needed for these tests.
