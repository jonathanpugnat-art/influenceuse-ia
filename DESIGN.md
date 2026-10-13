# DESIGN.md — Ofmia

## Discovery

- **Artifact:** SaaS application (operate mode), not a marketing landing
- **Audience:** OFM / OnlyFans managers creating AI influencers
- **Primary job:** Lock a face → define niche → generate Instagram-ready posts → download
- **Positioning:** Dark studio tool, lime as the only accent (brand lock)
- **Adjectives:** Mechanical, dense, signal-led, operator-first
- **Aesthetic essence:** Phosphor console · lime signal · face locked

## Aesthetic commitment

**Phosphor console (tool variant):** CRT-dark stage with a green cast, monospace telemetry labels, sharp frames, one lime phosphor accent. No soft OLED glass, no purple AI gradients, no cream editorial, no 3D vibecoder chrome.

**Defining trait:** Text + hairline rules on a rigid grid; structure exposed, not padded in soft cards.

**Signature move:** Locked face sits in a sharp instrument frame with corner ticks; lime only marks armed actions and active signal.

## Typography

| Role | Face | Notes |
| --- | --- | --- |
| Body / UI | IBM Plex Sans | Technical, calm at small sizes |
| Display | Syne | Heavy structural titles, tight tracking, often uppercase |
| Telemetry | IBM Plex Mono | Nav, meta, badges, step counters |

Scale (base 16, ratio ~1.25): 11 / 12 / 14 / 16 / 20 / 24 / 32 / 40 / 56.

## Color (roles)

| Token | Hex / value | Role |
| --- | --- | --- |
| stage | `#090b09` | Page background (CRT green cast) |
| panel | `#0e120e` | Rail / raised panels |
| raise | `#141a14` | Inputs, media beds |
| line | `rgba(209,254,23,0.14)` | Hairlines (lime-tinted) |
| ink | `#e8f0e4` | Primary text |
| mute | `#7a8a72` | Secondary text |
| dim | `#4a5548` | Tertiary / placeholders |
| lime | `#d1fe17` | Sole accent (brand lock) |
| lime-soft | `rgba(209,254,23,0.12)` | Selection / focus wash |

Elevation is by lightness step (stage → panel → raise) plus visible rules — not soft stacked shadows.

## Spacing / radius / shadow

- Spacing unit: 4px. Dense in groups; rules separate sections more than whitespace.
- Radius: `2px` controls and panels; media frames `0` with corner ticks.
- Shadow: one approach — hard instrument edge (no blur), used sparingly on frames; no soft stage glow.

## Craft decisions

- **Layout:** Sticky left rail desktop; top rail mobile. Content max ~72rem. Visible section rules under page titles.
- **Components:** Squared CTAs, mono micro-labels, full states. Cards only when the photo *is* the interaction.
- **Motion:** Feedback + state indication only. Library: `motion` (`motion/react`). Tokens in `src/lib/motion.ts`. Durations ≤ 300ms. No nav animation. Reduced motion keeps opacity, drops translate/scale.
- **Icons:** `@phosphor-icons/react`, weight `light`. One family.
- **Imagery:** Real locked faces and reel thumbs only. No stock blobs.
- **Dark mode:** Native dark only.
- **A11y:** Visible lime focus rings, 24px+ targets on primary controls, `prefers-reduced-motion` honored.

## Slop audit

| Check | Result |
| --- | --- |
| No Inter / Roboto / Arial as primary | Pass (IBM Plex Sans / Syne / Mono) |
| No purple/indigo AI gradient | Pass |
| No cream+serif+terracotta cluster | Pass |
| No 3 equal feature cards as structure | Pass |
| Cards only for interactive media | Pass |
| One accent locked | Pass (lime) |
| Motion gated + reduced-motion | Pass |
| Em-dash in UI copy | Avoid |

Changelog: 2026-09-28 — Ethereal stage (Outfit + Space Grotesk, soft bezel).
Changelog: 2026-09-29 — Motion library.
Changelog: 2026-09-29 — Phosphor console vibe (Syne / Plex / sharp frames).
