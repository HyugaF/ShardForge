# DESIGN.md — ShardForge Visual System (`miqdadbadjuber/anti-slop` Specification)

## 1. Domain & Purpose
**ShardForge** is a specialized D&D 5e publishing utility that embeds the live **5eTools** website directly inside a split-screen workspace and converts any selected Monster, Spell, Item, Class, Feat, Race, Background, or Adventure into a structured OpenXML (`.docx`) document for **Shard Tabletop**.

All conversions are sourced **100% live from the embedded 5eTools website** with zero offline sample templates.

---

## 2. `miqdadbadjuber/anti-slop` Module Rules

1. **`antislop-ui` (Visual & Structural Purity)**:
   - **Rule R-01 (No Generic Indigo/Blue-Purple Defaults)**: Do not use `indigo-600` (`#4F46E5`), purple gradients, or neon glows. Use the **Tabletop Sourcebook & Archival Ink** palette below.
   - **No Glassmorphism**: Do not apply `backdrop-blur` to headers, panels, or floating bars. Use solid opaque surfaces with crisp `1px` borders.
   - **No Nested Card Sandwiches**: Maximum 1 level of surface elevation. Use `1px` hairline dividers (`border-zinc-200 dark:border-zinc-800`) inside panels.
   - **Zero-Pill Metadata**: Render category, sourcebook, and tag counts as unboxed inline text separated by middle dots (`·`).
2. **`antislop-copywriting` (Direct Human Copy)**:
   - Use direct, plain labels: `Document Preview`, `Book Queue`, `Heading Styles`, `Import Guide`, `Download .docx`, `+ Add to Book`.
   - Never display fake status banners, compiler badges, or self-congratulatory labels.
3. **`antislop-human` (Accessibility & Ergonomics)**:
   - Enforce $\ge 4.5:1$ contrast across Light and Dark modes.
   - Provide visible `:focus-visible` outlines (`2px solid #991B1B`) on all interactive controls.
   - Enforce `font-variant-numeric: tabular-nums` on all statblock numbers, counts, and tables.
4. **`antislop-layoutmobile` (Responsive Integrity)**:
   - Single-line controls (`whitespace-nowrap shrink-0`), zero horizontal overflow, clean responsive stacking below `1024px`.
5. **`antislop-code`**:
   - Maintain a clean, self-documenting codebase with no dead offline datasets or redundant comment clutter.

---

## 3. Color Tokens (Tabletop Sourcebook & Archival Ink)

| Semantic Token | Light Mode | Dark Mode | Role |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F6F5F2` (Warm Stone) | `#0C0D10` (Obsidian Ink) | 60% Primary workspace canvas |
| `--bg-surface` | `#FFFFFF` (Crisp Paper) | `#14161B` (Charcoal Slate) | 30% Panel & toolbar surfaces |
| `--bg-manuscript` | `#FCFBF8` (Archival Vellum) | `#181A20` (Dark Manuscript) | Word `.docx` sheet preview |
| `--text-primary` | `#18181B` (`zinc-900`) | `#F4F4F5` (`zinc-100`) | Headings & primary copy |
| `--text-muted` | `#52525B` (`zinc-600`) | `#A1A1AA` (`zinc-400`) | Unboxed metadata & hints |
| `--border-subtle` | `#E4E4E7` (`zinc-200`) | `#27272A` (`zinc-800`) | `1px` structural hairlines |
| `--accent-primary` | `#991B1B` (`red-800`) | `#DC2626` (`red-600`) | 10% Primary `.docx` export CTA |
| `--accent-active` | `#18181B` (`zinc-900`) | `#F4F4F5` (`zinc-100`) | Active navigation & tab selection |

---

## 4. Typography Scale (`2+1` Font Discipline)

- **UI Display & Controls (`--font-display`)**: `Plus Jakarta Sans` (Weights `500`, `600`, `700`)
- **UI Body (`--font-sans`)**: `Public Sans` (Weight `400`, `500`)
- **Manuscript Sheet (`--font-serif`)**: `Lora` / `Cambria` (Weights `400`, `600`, `700`, `italic`)
- **Tabular Data & Heading Codes (`--font-mono`)**: `JetBrains Mono` (`tabular-nums`)
