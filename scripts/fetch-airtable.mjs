/**
 * fetch-airtable.mjs
 * Mundart.Guide — Airtable → Hugo Data Pipeline
 *
 * Fetches Betriebe + Besuche from Airtable, joins them,
 * computes aggregates, and writes:
 *   data/restaurants.json
 *   data/besuche.json
 *   content/restaurants/{slug}.md     (Hugo content files, flat)
 *
 * Usage:
 *   AIRTABLE_API_KEY=patXXX node scripts/fetch-airtable.mjs
 *
 * Cloudflare Pages Build Command:
 *   npm run fetch && hugo
 */

import fs from 'fs/promises'
import path from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_ID   = process.env.AIRTABLE_BASE_ID  || 'app7D0UqRW9VcEVwJ'
const API_KEY   = process.env.AIRTABLE_API_KEY
const BASE_URL  = `https://api.airtable.com/v0/${BASE_ID}`

if (!API_KEY) {
  console.error('❌  AIRTABLE_API_KEY not set')
  process.exit(1)
}

// ─── Score conversion ─────────────────────────────────────────────────────────
// Airtable: 0–100  →  Hugo templates: 0–10 (bar-width = rating × 10%)
const toTen = n => (n != null ? Math.round(n) / 10 : null)

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch all records from a table (handles Airtable's 100-record pagination) */
async function fetchTable(tableName) {
  const records = []
  let offset = null

  do {
    const url = new URL(`${BASE_URL}/${encodeURIComponent(tableName)}`)
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` }
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Airtable API error (${tableName}): ${res.status} — ${body}`)
    }

    const data = await res.json()
    records.push(...data.records)
    offset = data.offset ?? null

    if (offset) await sleep(100) // gentle rate-limit buffer

  } while (offset)

  return records
}

/** Extract name from singleSelect / multipleSelects objects returned by Airtable */
function selectName(val) {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val.name) return val.name
  if (Array.isArray(val)) return val.map(v => (v?.name ?? v)).join(', ')
  return String(val)
}

/**
 * Slugify — spiegelt die Airtable-Formel exakt:
 * LOWER + ä→ae, ö→oe, ü→ue, ß→ss, Leerzeichen→-, Apostroph entfernen, -- reduzieren
 * Basis: Name + "-" + Ort → kollisionssicher.
 * Fallback nur wenn Airtable-Formelfeld leer ist.
 * Hinweis: Formel erfasst keine frz./ital. Akzente (é, è, à…) — ggf. Airtable-Formel erweitern.
 */
function slugify(str) {
  return (str || '')
    .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/'/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim()
}

function round1(n) { return Math.round((n ?? 0) * 10) / 10 }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** Compute weighted Gesamt-Score locally (fallback if formula field is null) */
function computeScore(f) {
  const k = f['Küche'] ?? 0
  const b = f['Bedienung'] ?? 0
  const a = f['Ambiente'] ?? 0
  const pl = f['Preis-Leistung'] ?? 0
  if (k + b + a + pl === 0) return null
  return round1(k * 0.4 + b * 0.25 + a * 0.2 + pl * 0.15)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('⬇  Fetching Airtable data…')

  const [rawBetriebe, rawBesuche] = await Promise.all([
    fetchTable('Betriebe'),
    fetchTable('Besuche')
  ])

  // ── Normalize Besuche ─────────────────────────────────────────────────────

  const besucheMap = {}

  const besuche = rawBesuche.map(r => {
    const f = r.fields

    const score = f['Gesamt-Score'] ?? computeScore(f)
    const preisPerson = f['Preis/Person Total'] ?? null

    const b = {
      id:              r.id,
      titel:           f['Titel'] ?? '',
      datum:           f['Datum'] ?? null,
      personen:        f['Personen'] ?? null,
      anlass:          selectName(f['Besuchsanlass']),
      waehrung:        selectName(f['Währung']) ?? 'CHF',
      speisen:         f['Speisen'] ?? null,
      getraenke:       f['Getränke'] ?? null,
      // Scores: Airtable 0–100, intern gespeichert als 0–100
      kueche:          f['Küche'] ?? null,
      bedienung:       f['Bedienung'] ?? null,
      ambiente:        f['Ambiente'] ?? null,
      preisLeistung:   f['Preis-Leistung'] ?? null,
      kurzfazit:       f['Kurzfazit'] ?? '',
      bewertungstext:  f['Bewertungstext'] ?? '',
      weinBestellt:    f['Wein bestellt'] ?? false,
      weinCHF:         f['Wein CHF'] ?? null,
      status:          selectName(f['Status']),
      rechnungTotal:   f['Rechnung Total'] ?? null,
      preisPerson:     preisPerson,
      gesamtScore:     score,
      // linked Betrieb record IDs (resolve later)
      _betriebIds:     f['Betrieb'] ?? []
    }

    besucheMap[r.id] = b
    return b
  })

  // ── Normalize Betriebe + join Besuche ────────────────────────────────────

  const betriebe = rawBetriebe.map(r => {
    const f = r.fields

    // Formula fields may return the computed string directly
    // Slug kommt von Airtable-Formel (Name + Ort). Fallback identisch zur Formel.
    const slug = f['Slug']
      ? String(f['Slug'])
      : slugify(`${f['Name'] ?? ''}-${f['Ort'] ?? ''}`)

    const hugoUrl = f['Hugo-URL'] ? String(f['Hugo-URL']) : `/restaurants/${slug}/`

    // Collect linked Besuche and sort by date (newest first)
    const linkedIds  = f['Besuche'] ?? []
    const betriebBesuche = linkedIds
      .map(id => besucheMap[id])
      .filter(Boolean)
      .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))

    // Aggregates (computed here — covers the missing Rollup-Felder)
    const scores = betriebBesuche.map(b => b.gesamtScore).filter(s => s != null)
    const costs  = betriebBesuche.map(b => b.preisPerson).filter(c => c != null)

    const avgScore      = scores.length ? round1(scores.reduce((a,b) => a+b, 0) / scores.length) : null
    const avgCost       = costs.length  ? round1(costs.reduce((a,b)  => a+b, 0) / costs.length)  : null
    const letzterBesuch = betriebBesuche[0]?.datum ?? null

    return {
      id:             r.id,
      name:           f['Name'] ?? '',
      ort:            f['Ort'] ?? '',
      region:         selectName(f['Region']),
      land:           selectName(f['Land']),
      betriebstyp:    selectName(f['Betriebstyp']),
      plBasis:        selectName(f['PL-Basis']),
      status:         selectName(f['Status']),
      pflegeStatus:   selectName(f['Pflege-Status']),
      url:            f['URL'] ?? null,
      notizen:        f['Notizen'] ?? '',
      slug:           slug,
      hugoUrl:        hugoUrl,
      // Aggregates
      anzahlBesuche:  betriebBesuche.length,
      avgScore:       avgScore,
      avgCost:        avgCost,
      letzterBesuch:  letzterBesuch,
      // Nested Besuche (without circular ref)
      besuche:        betriebBesuche.map(b => {
        const { _betriebIds, ...clean } = b
        return clean
      })
    }
  })

  // ── Write data/ files ─────────────────────────────────────────────────────

  await fs.mkdir('data', { recursive: true })

  await fs.writeFile(
    'data/restaurants.json',
    JSON.stringify(betriebe, null, 2),
    'utf8'
  )

  const besuche_clean = besuche.map(({ _betriebIds, ...b }) => b)
  await fs.writeFile(
    'data/besuche.json',
    JSON.stringify(besuche_clean, null, 2),
    'utf8'
  )

  console.log(`✓  data/restaurants.json — ${betriebe.length} Betriebe`)
  console.log(`✓  data/besuche.json     — ${besuche.length} Besuche`)

  // ── Generate Hugo content files ───────────────────────────────────────────
  // Flat .md per Restaurant — kompatibel mit bestehendem content/restaurants/.
  // Feldnamen und Skala (÷10) entsprechen den bestehenden Hugo-Templates.
  // Markdown-Body = Bewertungstext des neuesten Besuchs.

  await fs.mkdir('content/restaurants', { recursive: true })

  for (const b of betriebe) {
    // Überspringe leere/ungültige Slugs (z.B. "-" bei Datensätzen ohne Namen)
    if (!b.slug || b.slug === '-' || b.slug.length < 2) continue

    // Neuester Besuch für Scores + Body
    const letzter = b.besuche[0] ?? null

    const frontmatter = {
      // ── Pflichtfelder (Hugo-Template erwartet diese Namen) ──
      title:            b.name,
      date:             letzter?.datum ?? null,
      draft:            b.pflegeStatus === 'Entwurf',

      // ── Adresse / Klassifikation ──
      ort:              b.ort,
      kanton:           b.region,     // Region als Kanton-Feld
      land:             b.land,
      kategorie:        b.betriebstyp,
      preiskategorie:   b.plBasis,
      website:          b.url,

      // ── Scores (÷10: Airtable 0–100 → Template 0–10) ──
      besuchsdatum:     letzter?.datum ?? null,
      preis_pro_person: letzter?.preisPerson ?? null,
      rating_kueche:    toTen(letzter?.kueche),
      rating_service:   toTen(letzter?.bedienung),
      rating_atmosphaere: toTen(letzter?.ambiente),
      rating_wert:      toTen(letzter?.preisLeistung),
      rating_gesamt:    toTen(letzter?.gesamtScore),

      // ── Aggregierte Werte (mehrere Besuche) ──
      avg_score:        toTen(b.avgScore),
      avg_kosten:       b.avgCost,
      anzahl_besuche:   b.anzahlBesuche,
      letzter_besuch:   b.letzterBesuch,

      // ── Alle Besuche (für erweitertes Template) ──
      besuche:          b.besuche.map(v => ({
        datum:          v.datum,
        personen:       v.personen,
        kurzfazit:      v.kurzfazit,
        rating_kueche:       toTen(v.kueche),
        rating_service:      toTen(v.bedienung),
        rating_atmosphaere:  toTen(v.ambiente),
        rating_wert:         toTen(v.preisLeistung),
        rating_gesamt:       toTen(v.gesamtScore),
        preis_pro_person:    v.preisPerson,
      })),

      // ── Meta ──
      airtable_id:      b.id,
    }

    const yaml = toYaml(frontmatter)
    // Bewertungstext des neuesten Besuchs als Markdown-Body
    const body = letzter?.bewertungstext?.trim() ?? ''
    const md   = `---\n${yaml}---\n\n${body}\n`

    await fs.writeFile(
      path.join('content', 'restaurants', `${b.slug}.md`),
      md,
      'utf8'
    )
  }

  console.log(`✓  content/restaurants/ — ${betriebe.length} Seiten`)
  console.log('\n✅  Fertig. Jetzt: hugo')
}

// ─── Minimal YAML serializer ─────────────────────────────────────────────────
// (avoids a dependency just for this — handles the data types we use)

function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  let out = ''

  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out += `${pad}${k}: ~\n`
    } else if (typeof v === 'boolean') {
      out += `${pad}${k}: ${v}\n`
    } else if (typeof v === 'number') {
      out += `${pad}${k}: ${v}\n`
    } else if (typeof v === 'string') {
      // Quote strings that could confuse YAML parsers
      const needsQuote = /[:#\[\]{},&*?|\-<>=!%@`'"\\]/.test(v) || v.includes('\n') || v.trim() !== v
      out += needsQuote
        ? `${pad}${k}: ${JSON.stringify(v)}\n`
        : `${pad}${k}: ${v}\n`
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out += `${pad}${k}: []\n`
      } else if (v.every(i => typeof i !== 'object' || i === null)) {
        out += `${pad}${k}:\n`
        for (const item of v) {
          out += `${pad}  - ${JSON.stringify(item)}\n`
        }
      } else {
        out += `${pad}${k}:\n`
        for (const item of v) {
          if (typeof item === 'object' && item !== null) {
            const lines = toYaml(item, indent + 1).split('\n').filter(Boolean)
            out += `${pad}  -\n`
            for (const line of lines) out += `${pad}  ${line}\n`
          } else {
            out += `${pad}  - ${JSON.stringify(item)}\n`
          }
        }
      }
    } else if (typeof v === 'object') {
      out += `${pad}${k}:\n`
      out += toYaml(v, indent + 1)
    }
  }

  return out
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
