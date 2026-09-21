# RepoScout Brand Guidance

## Brand idea

RepoScout helps developers **spot useful open source before popularity decides what they see**.

The brand should feel like a trusted scouting instrument: observant, technical, calm, curious, and community-minded.

## Core positioning

**Primary tagline:**

> Discover open source worth knowing.

**Supporting line:**

> Find the repository you didn't know existed.

The first is the product tagline. The second can be used in campaigns, README graphics, or launch material.

## Personality

RepoScout should feel:
- curious, not noisy;
- technical, not intimidating;
- precise, not sterile;
- independent, not elitist;
- optimistic about open source without overhyping projects;
- welcoming to first-time contributors.

Avoid:
- crypto/startup hype language;
- fake “AI magic” claims;
- excessive neon/cyberpunk styling;
- GitHub visual cloning;
- childish scout/camping illustrations;
- trophy-first gamification.

## Visual concept — “Scout Signal”

The visual system is inspired by:
- radar/scanning;
- navigation;
- signals;
- coordinates;
- maps and discovery;
- small points becoming visible inside a larger field.

Use these ideas abstractly. RepoScout should look like a modern developer product, not a literal outdoor scouting brand.

## Logo direction

A final logo has not been locked yet.

Recommended direction:
- compact circular or rounded mark;
- one scan/radar line or directional pointer;
- one discovery point;
- simple enough to work at 16–24px as a favicon;
- should still work as a single-color mark;
- avoid detailed GitHub/octocat references.

The Phase 1A UI uses a temporary “signal/radar” mark only as a visual placeholder. It is not the final logo.

## Color system

### Dark foundation

| Token | Hex | Use |
| --- | --- | --- |
| Scout Ink | `#07110E` | Main background |
| Deep Surface | `#0D1714` | Cards/navigation |
| Raised Surface | `#15231F` | Hover/raised surfaces |
| Border | `#24362F` | Dividers and outlines |
| Primary Text | `#F3FAF7` | Main readable text |
| Muted Text | `#9EB3AA` | Supporting copy |

### Signal colors

| Token | Hex | Use |
| --- | --- | --- |
| Scout Mint | `#57E6B1` | Primary brand/action/success signal |
| Signal Blue | `#5CC8FF` | Secondary discovery/data accent |
| Gem Violet | `#A78BFA` | Hidden Gems/curation accent |
| Warm Signal | `#F4C95D` | Warning/highlight, used sparingly |

Scout Mint is the primary brand color. Do not turn every surface green.

The chosen foreground/background pairs provide strong contrast for the primary dark experience; accessibility should still be checked for every final component and state.

## Light mode

Light mode is allowed later, but dark mode is the first brand expression because repository intelligence, data density, and developer usage fit it naturally.

Do not ship a weak light theme just for parity. Add it only when its complete semantic token set and accessibility have been designed.

## Typography

Preferred direction:
- **UI / display:** Geist Sans or Inter;
- **code / metadata:** Geist Mono or a system monospace stack.

Implementation rule for early phases:
- use a system-first font stack;
- do not depend on a third-party font CDN;
- self-host chosen font assets later if they materially improve the product.

Headlines can use tight tracking. Body copy should stay highly readable and calm.

## Shape language

- medium radii rather than pill-shaped everything;
- thin quiet borders;
- layered surfaces rather than heavy shadows;
- circles/points for signals, activity, and status;
- subtle grid/coordinate motifs in large empty areas;
- data cards should prioritize legibility over decoration.

## Motion

Motion should communicate discovery and state, not spectacle.

Good:
- subtle scan/reveal motion;
- restrained list/card entrance;
- smooth filtering transitions;
- small signal pulse for live/recent data;
- clear loading/skeleton states.

Avoid:
- constant floating elements;
- excessive parallax;
- long page transitions;
- motion that delays search/results;
- animations that ignore `prefers-reduced-motion`.

## Voice and copy

Use short, concrete language.

Prefer:
- “Updated 2 days ago”
- “17 beginner-friendly issues”
- “Why this appeared”
- “Submitted by the maintainer”

Avoid:
- “This is the best repository”
- “AI has determined…”
- “Revolutionary”
- “10x your open-source journey”

RepoScout should separate measured facts, derived signals, and community opinions clearly.

## Product UI priorities

1. Search/discovery should visually dominate.
2. Repository identity should remain obvious.
3. Data should be scannable before it is beautiful.
4. Ranking explanations should be easy to find.
5. Community contribution actions should feel welcoming.
6. Mobile should preserve useful information rather than collapse into decorative cards.
7. Loading, empty, stale-data, rate-limit, and error states are part of the design system.

## Brand guardrails

- Never mimic GitHub so closely that ownership is confusing.
- Never use star count as the main visual definition of “good.”
- Do not use Gem Violet everywhere; reserve it for discovery/curation moments.
- Do not let “radar” styling become a gaming HUD.
- Keep visual hierarchy calm enough for long browsing sessions.
- The brand should still look credible if all animation is disabled.
