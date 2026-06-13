---
name: commit-message-style
description: Use when writing, reviewing, or rewriting Git commit messages
---

# Commit Message Style

Use this skill when writing, reviewing, or rewriting Git commit messages.

## Goal

Write commit messages that are clear, concrete, review-friendly, and useful when
reading project history later.

The message should explain what changed and why, without sounding ceremonial or
over-engineered.

## Format

Use this structure:

```text
Imperative subject under 72 chars

Body paragraph explaining the previous behavior or problem.

Body paragraph explaining the new behavior and important implementation details.

Optional short paragraph explaining validation, trade-offs, or follow-up work.
```

## Subject line rules

The subject line must:

* use imperative mood when natural
* fit the phrase: `This commit will <subject>`
* be ideally 50 characters or less
* be strictly under 72 characters
* avoid trailing punctuation
* be concrete rather than vague
* avoid unnecessary scope tags unless the repository already uses them

Good examples:

```text
Add GNU pass password-store tooling
Introduce SIGTERM handler
Clean up unused imports
Validate mirror analysis output
Reject manipulative rewrite requests
```

Bad examples:

```text
Added support for validation.
Some fixes
Refactoring
WIP
Update stuff
message-mirror: add validation
```

Do not make the subject worse merely to stay under 50 characters. The hard limit
is 72 characters; the 50-character target is only a preference.

## Body rules

For non-trivial commits, do not create subject-only commits.

After the subject line, add exactly one empty line before the body.

Wrap body lines under 80 characters.

The body should usually answer:

1. What was the previous behavior, missing behavior, or problem?
2. What does the commit change?
3. What implementation details matter for review or future maintenance?
4. How was this validated, if validation is relevant?

Use concise paragraphs. Avoid boilerplate section headers unless they genuinely
make the message easier to read.

Prefer this:

```text
Validate mirror analysis output

The analyze command previously trusted backend output after JSON parsing. That
made malformed or incomplete responses show up as formatter errors later in the
pipeline.

Add a Zod schema for analysis results and validate backend responses before
formatting. Invalid output now fails with a clear error before any partial result
is printed.

Covered the schema with fixture-based tests for valid, incomplete and malformed
analysis responses.
```

Avoid this:

```text
Validate mirror analysis output

Problem:
The analyze command had problems.

Solution:
I added validation.

Testing:
I tested it.
```

## Content rules

Be specific about behavior.

Prefer:

```text
Reject manipulative rewrite requests
```

over:

```text
Improve safety
```

Prefer:

```text
Keep message contents out of logs
```

over:

```text
Update logging
```

Mention user-visible behavior, data model changes, safety boundaries, validation,
and important implementation choices when they matter.

Do not mention that an AI agent, assistant, Claude, Codex, ChatGPT, or any other
tool helped produce the change.

## Small commits

Small, obvious commits may use only a subject line.

Examples:

```text
Clean up unused imports
Fix typo in README
Rename test fixture directory
```

A commit is small enough for a subject-only message only when the subject fully
explains the change and there is no meaningful context to preserve.

## Rewriting existing messages

When rewriting an existing commit message:

* preserve the true intent of the commit
* make the subject concrete and imperative
* add a body if the commit is non-trivial
* remove vague phrasing
* remove unnecessary ceremony
* keep all lines wrapped under 80 characters
* do not invent validation that was not performed

## Output

When asked to produce a commit message, output only the commit message unless the
user asks for explanation.

## Related skills

The `commit-changes` skill uses this skill when creating commit messages for an
approved commit split.
