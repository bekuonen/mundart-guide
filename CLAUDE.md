# CLAUDE.md — mundart-guide

## Projekt

**Mund&Art** — persönlicher Restaurantführer von Bernhard Kuonen.
**Live:** https://mundart.guide (public Repo!) · **Repo:** github.com/bekuonen/mundart-guide · Datenquelle: Airtable-Base `Mundart_guide` (`app7D0UqRW9VcEVwJ`).

## Stack

- **Hugo** (de-CH, eigene Layouts «Swiss Cut», kein Theme) + **Node ≥18** für die Pipeline
- **Airtable = führendes Datensystem** (Betriebe + Besuche; Erfassung per iPhone-Formular)
- **Sveltia CMS** (`static/admin/`) für statische Seiten — GitHub-Backend, Auth via `hugo-cms-auth.bekuonen.workers.dev` (geteilt mit tschiffra-ch)
- Hosting: **Cloudflare Pages**

## Projektstruktur

`scripts/fetch-airtable.mjs` (Pipeline) · `content/` (restaurants/ **generiert**) · `data/` (generiert, gitignored) · `layouts/` + `assets/css/` · `docs/STATUS.md` (Architektur-Doku). Details: `README.md`.

## Befehle

```bash
npm run dev      # fetch + hugo server (localhost:1313)
npm run build    # fetch + hugo — Verifikation: muss fehlerfrei laufen (braucht .env!)
hugo server      # nur Site, ohne frische Airtable-Daten (nutzt letzten fetch-Stand)
```

## Inhalte ändern

**Restaurants/Besuche NIE in `content/restaurants/` editieren** — generiert aus Airtable, wird überschrieben. Datenänderungen → Airtable (Base oder Formular). Statische Seiten (`ueber/`, `listen/`, `_index`) → Markdown oder CMS. Bewertungslogik/Scores leben in den Airtable-Formeln (Gesamt-Score, Slug, Titel — siehe `docs/STATUS.md`).

## Deployment

**Cloudflare Pages**, Projekt `mundart-guide` (Domains: mundart.guide, mundart-guide.pages.dev) — belegt 2026-06-05. Build gemäss `cloudflare-build.toml` (`npm run fetch && hugo` → public/, **HUGO_VERSION 0.161.1** — Dashboard bestätigt 2026-06-05; bei Versionswechseln Datei UND Dashboard synchron halten). **Datenänderung in Airtable wird erst nach Rebuild sichtbar** — Trigger: Push auf `main` (Konvention: `deploy: trigger rebuild — <Anlass>`).

## Secrets & ENV

- `.env` (gitignored): Airtable-PAT **read-only, scoped auf die Base** — nie committen, nie loggen
- Pipeline-Fallbacks: `AIRTABLE_BASE_ID` per ENV überschreibbar
- CMS-Auth-Secret liegt im geteilten Worker, nicht in diesem Repo

## Stolperfallen

1. **Build ohne `.env` schlägt fehl** (Pipeline bricht ab) — bei lokalen Layout-Arbeiten ohne Token `hugo server` direkt nutzen
2. `content/restaurants/` + `data/` sind gitignored — ein «leeres» Repo-Checkout baut erst nach `npm run fetch`
3. CMS committet auf `main` → vor Push `git pull`
4. Airtable-Schema-Änderungen (Felder/Formeln) brechen die Pipeline — `fetch-airtable.mjs` und `docs/STATUS.md` synchron halten
5. Dieselbe Base wird vom monatlichen Airtable-Backup gesichert (`04_Ressourcen/Backup/Airtable/`)

## Arbeitsregeln

- **Governance-Regelwerk G1–G12** gilt (`iCloud 05_System/Grundsätze/Governance_Regelwerk.md`); Airtable-Mutationen zusätzlich: Fakten → Befund → Vorschlag → **Freigabe**
- **Heimatort-Hinweis (G1):** Repo liegt derzeit in `~/Documents/GitHub/` — Handbuch-Heimat wäre `01_Projekte/Mundart/Code/`; Umzug steht als freigabepflichtige Empfehlung im GitHub-Audit vom 2026-06-05
- Commits: Conventional-Style wie Historie (`feat:`, `fix:`, `docs:`, `deploy:`)
- Niemals: PAT committen · generierte Dateien einchecken · force-push auf `main` (public Site)

## Weiterführend

`README.md` · `docs/STATUS.md` (Architektur + Airtable-Schema) · Skill-Quelle `mundart-dev` (iCloud `04_Ressourcen/KI/Claude/Skills/`) · Referenzmodell: `lichtspur-natur/Code/CLAUDE.md`
