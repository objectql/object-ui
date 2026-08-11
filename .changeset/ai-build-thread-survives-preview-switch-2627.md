---
'@object-ui/app-shell': patch
---

The AI build conversation no longer blanks itself the moment the preview opens

`useChatConversation` treated every failed resolve the same way: clear the id, clear the messages. For a FIRST resolve that is right — there is nothing to lose. For a re-resolve of the conversation the hook is already holding it is destructive, and the AI build flow fires exactly such a re-resolve at the worst possible moment.

The sequence is the magic-moment one. A build turn streams; `apply_blueprint`'s draft lands and the Live Canvas opens, switching the page from full-screen chat to the chat|preview split; the turn ends; ADR-0057 A1.b bind-on-create — which deliberately waits for that edge — re-keys the conversation to `app:<pkg>:build` and navigates to `?package=`. The scope flip re-resolves the same conversation, one GET issued at the instant the server is still finishing the heaviest turn of the session. A 502 or a dropped connection on that single request landed in the blanket catch.

Clearing the id there is not a conservative fallback, because of what the host does with it: `AiChatPage` keys its chat pane on `` `${chatApi}:${conversationId ?? 'pending'}` ``, and the thread itself lives inside the chat hook's instance (`useObjectChat` seeds from `initialMessages` once per mount). So `undefined` does not re-render the pane, it REPLACES it, and the blueprint card, the build summary and the Publish button all leave with the discarded instance — the reported "the whole conversation went blank right after the build finished, and only came back after switching threads and back".

A failed resolve now keeps whatever it was re-reading, when that is the conversation already held: the id is still valid and the messages are still the truth, so the surface stays as it was and the next resolve recovers. This is the other half of a guard that was already there for the empty case — the same re-resolve returning NO messages mid-turn was already refused the right to wipe hydrated history; only the failing case was still open. A resolve aimed at a DIFFERENT conversation (a sidebar switch) and a first resolve with nothing held still clear, and both are pinned negatively.

Pinned at two levels: the hook, and the page driving the real build→preview→re-key sequence and asserting the pane is never remounted across it.
