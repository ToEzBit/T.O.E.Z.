# T.O.E.Z.

Totally Ordinary Electronic Zomething — a personal, single-owner voice agent for macOS (Jarvis-style). Spoken Thai/English conversation is the primary interface; it can do everything Claude Code can do (spawn subagents, use MCP servers and skills).

## Language

**T.O.E.Z.**:
The assistant itself — one persistent identity with its own Persona, Voice, and Memory.
_Avoid_: bot, chatbot, the app

**Owner**:
The single person T.O.E.Z. serves. There is exactly one; T.O.E.Z. is not multi-user.
_Avoid_: user, users, customer

**Persona**:
T.O.E.Z.'s defined character — tone, habits, how it addresses the Owner. Defined as an editable document; one fixed Persona for now (self-evolving is a possible future).
_Avoid_: personality prompt, character card

**Voice**:
The TTS identity T.O.E.Z. speaks with. Selectable by the Owner; must speak Thai and English.
_Avoid_: speaker, narrator

**Memory**:
What T.O.E.Z. retains about the Owner and past work across Sessions, long-term. Markdown-first; searchable retrieval may be layered on later.
_Avoid_: RAG, knowledge base

**Session**:
One conversation between the Owner and T.O.E.Z., opened by push-to-talk. Spoken input; spoken reply plus an on-screen display.
_Avoid_: chat, thread

**Subagent**:
A worker T.O.E.Z. spawns to carry out part of a task, Claude Code-style.
_Avoid_: worker, minion, child process

**Panel**:
The floating window that appears over everything when the Owner summons T.O.E.Z. (Spotlight-style); expandable into a full window for code and detail. T.O.E.Z. lives in the menu bar, always running.
_Avoid_: popup, overlay, main window

**YOLO Mode**:
A per-Session mode the Owner can switch on by voice, letting T.O.E.Z. act without asking permission. Outside YOLO Mode, safe actions run automatically and risky ones require spoken/on-screen approval.
_Avoid_: trust mode, admin mode, bypass

**Workspace**:
T.O.E.Z.'s own home, apart from the app's code — where its Persona, Memory, Transcripts, skills, and Registered Projects live. Survives reinstalling the app; may be backed up as its own private repo.
_Avoid_: data dir, config folder, app data

**Registered Project**:
A project the Owner has introduced to T.O.E.Z. once, by short name and location; afterwards summonable in speech by name alone ("ไปทำในโปรเจค X").
_Avoid_: folder, path, repo

**Transcript**:
The full permanent record of one Session, kept so past conversations can be searched later.
_Avoid_: log, chat history

**Utterance**:
One thing the Owner said in a single push-to-talk turn, as text — what the Transcriber hands back when the key is released. A Session is made of many; a Transcript records them all.
_Avoid_: transcript (that is the whole Session's record), input, prompt, query

**Phrase**:
As much of a reply as T.O.E.Z. can say on its own, handed to the Voice while the rest is still being written. Often a sentence; in Thai, which ends sentences with a space rather than a full stop, whatever lies between two of them.
_Avoid_: sentence (Thai replies have none to find), chunk (that is one piece of the Engine's stream), segment
