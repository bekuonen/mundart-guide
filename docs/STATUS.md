# Mundart.Guide — Projektstatus

**Stand:** 2026-05-14
**Autor:** Bernhard Kuonen
**Repo:** bekuonen/mundart-guide

---

## Projektziel

Persönlicher Restaurantführer als statische Hugo-Site unter `mundart.guide`. Airtable als führendes Datensystem, Cloudflare Pages als Hosting. Datenerfassung primär via iPhone-Formular.

---

## Architektur

```
iPhone-Formular (Airtable)
        ↓
   Airtable (Betriebe + Besuche)
        ↓  fetch-airtable.mjs
   content/restaurants/*.md
        ↓  hugo
   Static Site
        ↓  Cloudflare Pages
   mundart.guide
```

**Stack:**
- Datenhaltung: Airtable (Base: `app7D0UqRW9VcEVwJ`)
- Build-Script: `scripts/fetch-airtable.mjs` (Node.js ESM)
- Static Site Generator: Hugo
- Hosting: Cloudflare Pages
- Build-Command: `npm run fetch && hugo`

---

## Erledigter Stand

### Airtable
- [x] Base `Mundart_guide` mit Tabellen `Betriebe` und `Besuche`
- [x] Slug-Formel in Betriebe: `Name + "-" + Ort` → kollisionssicher
- [x] Feld `Bewertungstext` (Multiline) in Besuche → Hugo-Body
- [x] Titel-Formel in Besuche: `ARRAYJOIN({Betrieb}) & " " & DATETIME_FORMAT({Datum}, 'YYYY-MM-DD')` → automatisch, kein manueller Eintrag
- [x] Formular "Besuch erfassen" mit Share-Link → iPhone-tauglich
- [x] API-Token (Personal Access Token, read-only, scoped auf Base)

### Formular / Erfassung
- [x] Airtable Form View `Besuch erfassen` erstellt
- [x] Share-URL: `https://airtable.com/app7D0UqRW9VcEVwJ/shr1BxzpiFtEoJnfe`
- [x] Alle 17 Felder inkl. `Betrieb` (Linkfeld) und `Bewertungstext`
- [x] iPhone: In Safari öffnen → Teilen → „Zum Home-Bildschirm" → App-Icon

### Hugo-Repo
- [x] Repo `bekuonen/mundart-guide` geklont und eingerichtet
- [x] `scripts/fetch-airtable.mjs` committed — Airtable → Hugo Pipeline
- [x] `package.json` mit Build-Scripts (`fetch`, `build`, `dev`)
- [x] `.gitignore` korrekt: `data/`, `content/restaurants/*.md`, `.env`
- [x] Content-Section: `content/restaurants/` (kompatibel mit bestehenden Templates)
- [x] Score-Skala: Airtable 0–100 → Hugo 0–10 via `toTen()` — kein Template-Umbau nötig
- [x] Slug-Fallback im Script identisch zur Airtable-Formel

### Testdaten (3 Besuche in Airtable)
| Betrieb | Ort | Datum | Ø Score |
|---|---|---|---|
| Sonne | Luzern | 2026-05-05 | 7.8 |
| Bahnhofbüffet | Bern | 2026-05-05 | 6.6 |
| Whisky Bar | Bern | 2026-05-04 | 7.4 |

---

## Offen / Nächste Schritte

| Priorität | Aufgabe |
|---|---|
| Hoch | Cloudflare Pages einrichten: Build-Command `npm run build`, Env-Var `AIRTABLE_API_KEY` |
| Hoch | API-Token in Cloudflare Pages als Environment Variable hinterlegen |
| Mittel | Hugo-Templates prüfen: `layouts/restaurants/` vs. `layouts/_default/` |
| Mittel | `content/restaurants/zur-metzg.md` (manuell erstellt) — via Airtable ersetzen oder löschen |
| Tief | Betriebe-Formular für macOS: reicht normales Airtable-Interface |
| Tief | Slug-Formel in Airtable: französische/italienische Akzente (é, è, à) noch nicht abgedeckt |

---

## Technische Details

### Feldnamen-Mapping (Airtable → Hugo Frontmatter)
| Airtable | Hugo | Skala |
|---|---|---|
| Küche | rating_kueche | ÷10 |
| Bedienung | rating_service | ÷10 |
| Ambiente | rating_atmosphaere | ÷10 |
| Preis-Leistung | rating_wert | ÷10 |
| Gesamt-Score | rating_gesamt | ÷10 |
| Region | kanton | — |
| Betriebstyp | kategorie | — |

### Lokaler Entwicklungsworkflow
```bash
cp .env.example .env        # AIRTABLE_API_KEY eintragen
npm run dev                 # fetch + hugo server
```

### Cloudflare Pages (geplant)
- Branch: `main`
- Build-Command: `npm run build`
- Output-Verzeichnis: `public`
- Environment Variable: `AIRTABLE_API_KEY=pat...`

---

## Dateien im Repo

```
mundart-guide/
├── scripts/
│   └── fetch-airtable.mjs   Pipeline-Script
├── content/
│   └── restaurants/         gitignored, wird bei Build generiert
├── docs/
│   └── STATUS.md            dieses Dokument
├── package.json
├── .gitignore
├── .env.example
└── hugo.toml
```
