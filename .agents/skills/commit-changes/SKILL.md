# Commit Changes

Use this skill when the user asks to commit current working tree changes, split
changes into commits, or create commits from uncommitted work.

This skill is a workflow skill. It coordinates inspection, commit splitting,
approval, staging, and commit creation.

Use the `commit-message-style` skill whenever writing or rewriting commit
messages.

## Goal

Turn the current working directory changes into a clean, review-friendly commit
series.

The commit series should:

* contain coherent commits
* avoid unrelated changes in the same commit
* preserve buildable / understandable history where practical
* use clear commit messages
* avoid committing accidental files
* avoid committing secrets or private data
* never mention AI-agent assistance in commit messages

## High-level workflow

1. Inspect the working tree.
2. Suggest a commit split.
3. Ask the user to approve the split.
4. If the user disapproves, revise the split based on feedback.
5. Repeat until the user approves.
6. Stage and commit according to the approved split.
7. Use `commit-message-style` for every commit message.
8. Show the final commit summary.

Do not stage or commit anything before the user approves the split.

Approval of the commit split is approval to stage and commit the proposed
commits using messages generated according to `commit-message-style`.

Do not ask for separate approval of each commit message unless the user
explicitly requests message review before committing.

## Inspection phase

Inspect the repository state using commands such as:

```sh
git status --short
git diff --stat
git diff
git diff --cached
```

Also inspect untracked files when relevant:

```sh
git ls-files --others --exclude-standard
```

When changes are large, inspect targeted diffs by file.

Look for:

* unrelated changes mixed together
* generated files
* lockfile changes
* formatting-only changes
* test changes
* documentation changes
* accidental editor files
* secrets, credentials, tokens, private messages, or local config
* changes that should not be committed

If suspicious files or possible secrets are found, stop and ask before including
them.

## Split proposal phase

Propose a commit split before mutating Git state.

The proposal must include:

```text
Proposed split:

1. <commit subject>
   Files:
   - path/to/file
   - path/to/other-file

   Rationale:
   <why these changes belong together>

2. <commit subject>
   Files:
   - path/to/file

   Rationale:
   <why this should be separate>
```

When a file contains changes that belong in multiple commits, explicitly say so:

```text
File-level split needed:
- src/example.ts
  - commit 1: schema changes
  - commit 2: CLI formatting changes
```

Prefer smaller coherent commits over one large commit, but do not split so much
that the history becomes noisy.

Good split criteria:

* one behavior change per commit
* tests with the behavior they validate
* docs with the feature they document, unless docs are independently meaningful
* refactors separate from behavior changes when practical
* mechanical formatting separate from semantic changes
* dependency or lockfile changes separate when they are large or risky

Bad split criteria:

* one commit per file by default
* separating tests from the code they validate without a reason
* mixing formatting, refactoring, and behavior changes
* hiding risky changes inside broad cleanup commits

## Approval gate

After proposing the split, ask for approval.

Use wording like:

```text
Approve this split, or tell me what to change.
```

If the user approves, continue to staging and committing.

Approval can be explicit, such as:

* "approved"
* "looks good"
* "go ahead"
* "yes"
* "commit it"

If the user disapproves or suggests changes, revise the split and ask again.

Do not commit until the user has approved a specific split.

Approval of a split means:

* the proposed commit boundaries are accepted
* the tool may stage exactly those changes
* the tool may generate commit messages using `commit-message-style`
* the tool may create all approved commits without asking for message-by-message
  approval

Do not ask the user to approve each generated commit message unless the user
explicitly asks to review messages before committing.

## Revision loop

When the user asks for changes to the split:

1. Update the proposal.
2. Explain only the meaningful differences from the previous proposal.
3. Ask for approval again.

Examples of user feedback:

* "combine 1 and 2"
* "keep docs separate"
* "put tests with the implementation"
* "don't commit the Nix changes"
* "split the parser changes from the CLI changes"

Continue the loop until the user approves.

## Staging phase

After approval, stage exactly the changes belonging to the next commit.

Use precise staging commands:

* `git add path` for whole-file commits
* `git add -p path` for partial-file commits
* temporary patch files if needed

Before each commit, verify the staged diff:

```sh
git diff --cached --stat
git diff --cached
```

Check that the staged diff matches the approved commit.

If staging reveals that the approved split cannot be applied cleanly, stop and
explain the issue. Propose a revised split or ask for approval of the necessary
adjustment.

## Commit message phase

For each approved commit, write the commit message using the
`commit-message-style` skill.

Generate commit messages directly from the approved split and staged diff.

Do not pause for message approval unless the user explicitly asked to review
messages before committing.

Commit messages must:

* use an imperative subject
* keep the subject under 72 characters
* include a body for non-trivial commits
* explain the previous behavior or problem
* explain the new behavior
* mention validation when relevant
* avoid mentioning AI, agents, Claude, Codex, ChatGPT, or automation assistance

Do not invent validation that was not performed.

## Commit phase

Create each commit only after verifying the staged diff.

Use a commit message file or equivalent safe method rather than fragile inline
shell quoting for multi-line messages.

Example:

```sh
git commit -F /tmp/commit-message.txt
```

After each commit, verify remaining work:

```sh
git status --short
```

Continue until all approved commits are created or until an unexpected issue
requires user input.

## Validation

If the approved split or repository context implies validation, run relevant
tests before or after committing, depending on the user's request and project
norms.

Examples:

* unit tests for changed behavior
* formatter checks for formatting changes
* typecheck/build for TypeScript/Haskell/Nix changes
* targeted tests when full test suite is expensive

If tests are not run, say so explicitly in the final summary.

Do not claim validation that was not performed.

## Final summary

After committing, show:

```text
Created commits:

- <hash> <subject>
- <hash> <subject>

Validation:
- <commands run>
- <result>

Remaining working tree:
- clean
```

If changes remain, show them clearly:

```text
Remaining working tree:
- path/to/uncommitted-file
- path/to/partially-committed-file
```

## Hard rules

Never:

* stage or commit before split approval
* ask for message-by-message approval after split approval unless explicitly
  requested
* include suspicious secrets without asking
* commit unrelated accidental files
* invent test results
* mention AI-agent assistance in commit messages
* rewrite existing commits unless explicitly asked
* push commits unless explicitly asked
* use `git add .` unless the approved split genuinely includes all tracked and
  untracked changes and there are no suspicious files

Always:

* inspect before proposing
* ask for split approval
* use `commit-message-style` for messages
* verify staged diff before committing
* summarize what was committed

