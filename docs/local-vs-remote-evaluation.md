# Local vs Remote Evaluation

## Quick Take

- `Local mode` wins onboarding.
- `Remote mode` wins multi-device retention.
- `Local mode` wins open-source trust.
- `Remote mode` wins long-term product reach.

## What Local Mode Wins

- fastest possible onboarding
- no account required
- strong user ownership story
- natural fit for Markdown-based workflows
- easier to position as open and trustworthy

## What Remote Mode Wins

- access from web, desktop, and mobile anywhere
- cleaner multi-device sync story
- better fit for shared infrastructure and future premium hosting
- easier path for account-based features and managed services

## Main Tradeoff

Local mode is the best entry point.
Remote mode is likely the best expansion path.

That means the product does not need to choose only one forever, but it should avoid treating both as equal priorities too early.

## Recommended Direction

1. Build an excellent `local-first` experience first.
2. Keep storage boundaries clean so a `remote/self-hosted mode` can be added later.
3. Treat remote mode as a second deployment model, not as a reason to weaken the local onboarding story.
4. Eventually support:
   - `Local Markdown mode`
   - `Self-hosted remote mode`
   - `Managed cloud mode`

## Important Reminder

Data ownership and Markdown friendliness are important, but they are not the same thing.

Many users care deeply about:

- not being locked in
- being able to export
- trusting the product

That does not always mean the entire product must be built around raw Markdown files forever.
