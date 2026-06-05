# Mund&Art — mundart.guide

Persönlicher Restaurantführer — eine Stimme, klare Haltung. Vom Imbiss bis Fine Dining.
Statische **Hugo**-Site; **Airtable** ist das führende Datensystem (Betriebe + Besuche), Erfassung primär per iPhone-Formular; Hosting auf **Cloudflare Pages**.

---

## Architektur

```
iPhone-Formular (Airtable Form «Besuch erfassen»)
        ↓
Airtable Base Mundart_guide (app7D0UqRW9VcEVwJ: Betriebe + Besuche)
        ↓  scripts/fetch-airtable.mjs   (Node ≥18, ESM)
data/restaurants.json · data/besuche.json · content/restaurants/{slug}.md
        ↓  hugo
Cloudflare Pages → https://mundart.guide
```

## Schnellstart

```bash
npm run dev      # fetch + hugo server --disableFastRender (http://localhost:1313)
npm run fetch    # nur Airtable → data/ + content/restaurants/
npm run build    # fetch + hugo (= Cloudflare-Build-Command)
```

Voraussetzung: `.env` mit Airtable-Token (read-only PAT, scoped auf die Base) — gitignored, nie committen. `AIRTABLE_BASE_ID` optional (Default `app7D0UqRW9VcEVwJ`).

## Projektstruktur

```
content/             _index, besuche/, listen/, restaurants/ (generiert!), ueber/
scripts/fetch-airtable.mjs   Airtable→Hugo-Pipeline
data/                generierte JSON (gitignored)
layouts/ + assets/css/       Swiss-Cut-Design, eigene Templates (kein Theme)
static/admin/        Sveltia CMS (GitHub-Backend, Auth via hugo-cms-auth-Worker)
docs/STATUS.md       Projektstatus & Architekturentscheide (Stand 2026-05-14)
hugo.toml            Site-Config (de-CH)
```

**Wichtig:** `content/restaurants/*.md` und `data/` sind **generiert** und gitignored — Quelle ist Airtable, lokale Edits dort gehen beim nächsten `fetch` verloren.

## Inhalte pflegen

- **Besuche/Betriebe:** ausschliesslich in Airtable (Formular oder Base) — die Site baut daraus
- **Statische Seiten** (`_index`, `ueber/`, `listen/`, `besuche/`): Markdown in `content/` oder via CMS `/admin/`
- Es gibt zudem einen Claude-Skill `mundart-dev` (Quelle: iCloud `04_Ressourcen/KI/Claude/Skills/mundart-dev/`) für die Bewertungs-Workflows

## Deployment

**Cloudflare Pages**, Projekt `mundart-guide`, Domains `mundart.guide` + `mundart-guide.pages.dev` *(belegt 2026-06-05)*.
Weg: **GitHub → Cloudflare Pages → Build bei Push auf `main`**. Build: `npm run fetch && hugo` → `public/`, **HUGO_VERSION 0.161.1** — versioniert in [`cloudflare-build.toml`](./cloudflare-build.toml), Dashboard entsprechend gesetzt (bestätigt 2026-06-05). Da Airtable zur **Build-Zeit** gelesen wird, braucht jede Datenänderung einen Rebuild (Commit-Muster `deploy: trigger rebuild`).

## Weiterführend

`docs/STATUS.md` — vollständiger Projektstatus, Airtable-Schema (Slug-/Titel-Formeln), Formular-Links, offene Punkte.
