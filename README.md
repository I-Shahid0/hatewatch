# HateWatch

**Preserve the context. Build the evidence. Know what to do next.**

HateWatch is a privacy-conscious evidence assistant that helps community advocates turn scattered evidence of online anti-Muslim hate into a structured, human-reviewed incident record.

A user gives HateWatch screenshots, links, text, and basic context. HateWatch helps them **capture → classify → connect → review → route → export** the evidence.

> HateWatch is **not** “AI that decides whether someone is Islamophobic.”
>
> It **is** “a tool that helps humans document what happened without losing the context needed to act on it.”

That distinction drives the entire MVP.

---

## The problem

Evidence of online anti-Muslim harassment is often fragmented across screenshots, platforms, and time, forcing community advocates to manually reconstruct the context needed to understand, preserve, and report an incident.

Imagine an advocate receives:

> “I've been getting attacked online since yesterday. Can you help?”

Attached are 8 screenshots from X, 3 from Instagram, a TikTok URL, 2 DM screenshots, one screenshot without a username, repeated phrases, one potentially threatening message—and no organized chronology.

The advocate must manually answer:

- What happened, and when did it start?
- Which pieces are connected?
- What information is missing?
- Is something potentially urgent?
- Which content may fit which platform rules?
- What should be reported, preserved, or redacted?
- How do 14 screenshots become something another person can understand?

**That's HateWatch.**

---

## Who it's for

### Primary user (MVP)

A **community advocate** helping someone document online anti-Muslim harassment—staff or trained volunteers at civil-rights organizations, community organizations, mosques, campus groups, or anti-hate monitoring organizations.

For the hackathon: **User = community advocate.**

### Secondary user (not MVP)

The person experiencing the harassment. A future self-service mode is possible, but an advocate-oriented workflow gives HateWatch a credible human-review layer for safety, AI uncertainty, escalation, privacy, and emotional burden.

---

## Before → after

| Before HateWatch | After HateWatch |
| --- | --- |
| A folder of `IMG_3821.png`, `Screenshot_2026-08-21.png`, `twitter-link.txt` | **Incident HW-2026-0142** |
| Someone manually reconstructs everything | 14 evidence items · 3 platforms |
| Context disappears as harm travels | Incident window, patterns, missing fields |
| No shared record | Human-reviewed evidence packet ready to export |

**Demo outcome:** Generate Evidence Packet — timeline, reviewed patterns, known gaps, privacy/redaction record, and AI transparency in one place.

---

## Core workflow

```
CAPTURE → VERIFY → ORGANIZE → ANALYZE → REVIEW → ROUTE → EXPORT
```

Aligned with the organizers' Reporting Field Guide (**Capture → Classify → Route → Decide → Learn**), HateWatch focuses on the largest gap: between a report being filed and a real decision being made.

| Stage | What happens |
| --- | --- |
| **Capture** | Upload screenshots, paste text, add URLs and advocate notes |
| **Verify** | AI extracts metadata; humans confirm, edit, or mark uncertain |
| **Organize** | Timeline reconstructs chronology across platforms |
| **Analyze** | Evidence-grounded pattern suggestions (not verdicts) |
| **Review** | Human classification with audit trail |
| **Route** | Preserve, prepare platform report, share packet, or escalate for human review |
| **Export** | PDF / JSON evidence packet from verified database fields only |

---

## Signature features

### Context Integrity

HateWatch's signature metric. **Not a hate score. Not a toxicity score.**

A transparent completeness checklist: whether enough context exists for responsible review.

Example:

```
Evidence 03 — Context Integrity: 67%
✓ Original screenshot
✓ Platform known
✓ Displayed account
✓ Timestamp
✕ Original URL
✕ Parent post
? Timezone unknown
```

Weighted completeness (MVP):

| Context element | Weight |
| --- | --- |
| Evidence artifact | Required |
| Platform | 10 |
| Content text | 15 |
| Timestamp | 15 |
| URL / source | 20 |
| Target / context | 15 |
| Parent / thread context | 15 |
| Capture provenance | 10 |

**Context Integrity = available context / applicable context.** Users can inspect exactly why the number exists.

### Evidence-grounded AI

Every analysis must provide: **Claim → Supporting evidence → Reason.**

AI suggests. Humans verify. Never:

- “This account is an Islamophobe.”
- Fake precision (`Threat probability: 91.7%`, `Islamophobia score: 94/100`)

Always:

- Field-level confidence (High / Medium / Low / Unavailable)
- “Possible coordination indicators” — not unsubstantiated campaigns
- **Insufficient context** as a first-class outcome

### Human review + audit trail

Every modification is recorded. Classifications can be confirmed, changed, marked insufficient, or marked not relevant—with reviewer notes.

### Privacy by design

Before upload: minimize unnecessary personal information. Demo mode uses synthetic or redacted evidence. Exports include a redaction record and an AI transparency section.

---

## Product screens (MVP)

1. **Dashboard** — Active incidents, context integrity, priority, recent activity, **+ New Incident**
2. **Create Incident** — Who is documenting, what was targeted, platforms, immediate safety concern (framed as needing human review—not “high risk”)
3. **Evidence Inbox** — Drag screenshots, paste text, add URLs; processing cards with context completeness
4. **Verification** — Split view: original artifact vs. extraction; Confirm / Edit / Mark uncertain
5. **Timeline** — Chronology across platforms (meme → reply swarm, public → private, coded language → spike)
6. **Assisted Analysis** — Potential patterns tied to evidence IDs; Priority Review queue
7. **Routing** — Preserve / platform report prep / community packet / urgent human escalation
8. **Evidence Packet** — Overview, approved summary, timeline, patterns, known gaps, redactions, AI transparency → PDF / JSON

---

## What HateWatch does not do

HateWatch does **not**:

- scrape social networks
- monitor individuals
- infer religious identity
- identify anonymous users
- publicly score accounts
- automatically accuse anyone
- determine whether something is illegal
- automatically contact police or report users
- create hateful training content
- collect unnecessary personal information

We classify **content**, **visible behavior**, and **patterns between evidence**—never people.

---

## MVP must-work path

Judges reward end-to-end reliability. Build narrow; show the evidence.

1. Create incident  
2. Upload screenshots  
3. Extract text + metadata  
4. Human verification  
5. Context completeness calculation  
6. Suggested categories  
7. Human classification review  
8. Timeline  
9. Pattern grouping  
10. Evidence packet generation  

**Stretch (only after the ten above):** automatic redaction, platform-policy mapping, multilingual evidence, cross-platform visualization, report status tracking, appeal packets, duplicate detection.

### Feature hierarchy under time pressure

| Tier | Scope |
| --- | --- |
| **1 — Non-negotiable** | Upload → extraction → verification → timeline → export |
| **2 — Differentiation** | Context Integrity → pattern grouping → human review |
| **3 — Polish** | Redaction → platform policy suggestions → audit trail |
| **4 — Future** | Multilingual → appeals → monitoring → org collaboration |

---

## Suggested taxonomy (content patterns)

Keep it small. Always include **Insufficient context**.

- Explicit anti-Muslim hostility  
- Collective blame  
- Dehumanization  
- Exclusion / “Muslims don't belong”  
- Conspiracy narrative  
- Threatening language  
- Targeted harassment  
- Mosque / institution targeting  
- Coded or ambiguous rhetoric  
- Other / uncertain  
- **Insufficient context**

---

## Architecture

```
Raw evidence
  → structured extraction (multimodal model → JSON)
  → PII scan
  → human verification
  → structured database
  → classification + pattern analysis (suggestions only)
  → human review
  → report generated from verified fields only
```

**Critical rule:** Do not let the LLM generate the report directly from raw screenshots. Reports come from the verified database.

### Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (React), Tailwind, shared shadcn/ui (`packages/ui`) |
| Backend | Hono + oRPC |
| Database | PostgreSQL + Drizzle ORM |
| Runtime | Bun |
| Auth | Better Auth |
| Monorepo | Turborepo |
| Lint / format | Biome |

### Conceptual data model

- **Incident** — id, title, created_by, target_type, platforms[], status, safety_review_status, context_integrity  
- **Evidence** — type, file_path, platform, source_url, displayed_account, timestamps, text, verification_status, context_integrity  
- **Classification** — category, reason, confidence, review_status, reviewer_note  
- **Pattern** — name, description, evidence_ids[], status  
- **Review** — original_value, reviewed_value, review_status, timestamp  
- **Redaction** — type, location, reason  

Displayed account identifiers are recorded as **displayed identifiers**—never inferred real-world identity.

---

## Demo dataset & script (~2–3 min)

Use a **fictional** incident (~12 evidence items), e.g. Crescent Community Centre event posts receiving mixed replies—including non-hate, collective blame, dehumanization, missing URL, and one potential implied threat. Demo mode: all evidence is synthetic or redacted.

| Time | Beat |
| --- | --- |
| 0:00–0:20 | Messy folder of screenshots — context disappears |
| 0:20–0:35 | Dashboard — structured incident records |
| 0:35–1:00 | Upload & process 12 items |
| 1:00–1:20 | **Context Integrity** wow moment (missing URLs / parent thread) |
| 1:20–1:40 | Cross-platform timeline |
| 1:40–2:00 | Patterns + human review on potential threat |
| 2:00–2:25 | Generate Evidence Packet (PDF) |
| 2:25–2:40 | Close: harm crosses platforms; evidence must survive the journey |

---

## Impact, ethics & sustainability

**Impact (measure the workflow, not “reducing hate”):** time to structured incident, missing context found, evidence traceability, findings with direct evidence links. Validate with a small synthetic user test before claiming numbers.

**Ethics:** human review, privacy minimization, uncertainty-aware routing, no identity profiling, AI transparency in every export.

**Sustainability path:**

1. Internal use by community organizations  
2. Custom taxonomy, routing, platform rules, report templates  
3. Interoperable evidence packet format  
4. Secure exchange between trusted partner organizations  

Longer vision (not this hackathon): Capture · Review · Reports · Network. **MVP = Capture + Review + Report.**

---

## One-liners for judges

**Product:** HateWatch helps community advocates turn scattered evidence of online anti-Muslim hate into structured, human-reviewed incident records that preserve context and support safer reporting.

**Differentiation:** A classifier asks whether one piece of content looks hateful. HateWatch asks whether the evidence needed to understand an entire incident has been preserved. AI can flag patterns, but every finding remains tied to its source evidence and subject to human review.

**Homepage:** *Preserve the context behind online hate.* Capture. Verify. Understand. Act.

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- PostgreSQL (local or Docker)

### Install

```bash
bun install
```

### Database

1. Configure PostgreSQL connection in `apps/server/.env`.
2. Push the schema:

```bash
bun run db:push
```

### Develop

```bash
bun run dev
```

- Web: [http://localhost:3001](http://localhost:3001)  
- API: [http://localhost:3000](http://localhost:3000)

### Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Start all apps |
| `bun run build` | Build all apps |
| `bun run dev:web` / `dev:server` | Start one app |
| `bun run check-types` | Typecheck |
| `bun run check` | Biome lint / format |
| `bun run db:push` / `db:generate` / `db:migrate` / `db:studio` | Database workflows |
| `bun run docker:build` / `docker:up` / `docker:logs` / `docker:down` | Docker Compose |

### Project structure

```
hate_evidence_copilot/
├── apps/
│   ├── web/         # Next.js frontend
│   └── server/      # Hono + oRPC API
├── packages/
│   ├── ui/          # Shared shadcn/ui + styles
│   ├── api/         # API / business logic
│   ├── auth/        # Better Auth
│   ├── db/          # Drizzle schema & queries
│   └── env/         # Shared env validation
```

### Docker Compose

```bash
bun run docker:build
bun run docker:up
```

Env vars come from each app's `.env` and are overridden in `docker-compose.yml` for container networking.

### UI customization

- Tokens & globals: `packages/ui/src/styles/globals.css`
- Shared primitives: `packages/ui/src/components/*`
- Add shared components from the repo root:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

```tsx
import { Button } from "@hate_evidence_copilot/ui/components/button";
```

---

## License & AI disclosure

Hackathon submissions should list AI tools, datasets, outside materials, and licenses used. HateWatch exports are designed to disclose AI-assisted extraction, categorization, pattern grouping, and draft summarization—and to state that AI was **not** used to identify real people, determine criminal liability, label individuals as “Islamophobic,” auto-contact authorities, or publish allegations. All material findings are presented for human review.

---

Built for community advocates who need evidence that keeps its context.
