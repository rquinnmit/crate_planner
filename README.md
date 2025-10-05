# CratePilot

An AI co-pilot for DJs that converts a short event description and seed tracks into a performance-ready, ordered crate. Shrinks crate prep from hours to minutes by combining a structured library, prompt-driven planning, transition scoring, and one-click export to DJ software.

## 🎯 Problem & Context

**The Pain Point:** DJs spend significant time digging for tracks and testing what blends—balancing BPM, key, genre, structure, energy, and crowd fit. The workflow is fragmented across streaming sites, DJ apps, and personal notes.

**Why Now:** Massive track volume and "one-size-fits-all" AI radios don't respect human style, venue constraints, or harmonic mixing rules.

## 👥 Who It Serves

- **DJs:** Faster prep, better compatibility, fewer risky transitions
- **Venues & Audiences:** Sets that fit the event type and maintain flow
- **Platforms** (Beatport/Beatsource) & **DJ Software** (Rekordbox/Serato): Cleaner discovery and direct playlist integration
- **Artists/Labels:** Increased discovery by match quality (not just popularity)

## ✨ Core Features

### 1. Discovery
Enter "rooftop sunset • tech house • 120–124 BPM" + 2–3 seed tracks → get a 90–120 min crate matched to style and constraints.

### 2. Library
Normalize & store track metadata/features; reuse across plans.

### 3. Export
One-click export to Rekordbox/Serato playlists for performance.

## 🏗️ System Architecture

### MusicAssetCatalog
- Stores tracks with **Tags** (artist, title, genre, duration) and **Features** (BPM, key, sections)
- Provides filtered candidate lists (by BPM range, key, genre, etc.)

### CratePlanning
- Produces an **ordered** crate that respects a **Prompt** (tempo range, key, genre, seeds, duration, notes)
- Supports user feedback and finalization

### PlanExporter
- Converts finalized plans to DJ-software-friendly playlist formats

## 🤖 AI Augmentation

CratePlanning is extended with optional LLM-powered actions (manual path still works):

- **deriveIntentLLM:** Interprets the prompt + seeds, expands constraints
- **generateCandidatePoolLLM:** Builds filter expressions from the derived intent
- **sequencePlanLLM:** Proposes an **ordered** list satisfying duration and energy trajectory
- **explainPlanLLM:** Natural-language annotations explaining why each transition works
- **revisePlanLLM:** Applies constrained edits from user instructions
- **LLMSettings:** Toggle AI, set model/temperature/prompts; track provenance

**Backwards compatibility:** Manual `createPlan` (deterministic heuristic) remains available; all AI features are additive and optional.

## 📊 Data & Metadata

### Tags
- `artist`, `title`, `genre?`, `duration_sec`

### Features
- `bpm`, `key` (Camelot notation like 8A/8B), optional `sections`, optional `energy (1–5)`

### Prompt
- `tempoRange?`, `targetKey?`, `targetGenre?`, `sampleTracks?`, `targetDuration?`, `notes?`
- Plus `mixingStyle?`, `energyCurve?` (for AI path)


## 🔄 Workflow (Happy Path)

1. **User prompt & seeds** →
2. *(AI on)* **deriveIntentLLM** (expand constraints & energy curve) →
3. **generateCandidatePoolLLM** (filter catalog to a viable set) →
4. **sequencePlanLLM** (order tracks to hit duration & optimize flow) →
5. **explainPlanLLM** (rationale for track selection) →
6. **validate** (duration tolerance, existence, duplicates) →
7. **finalize** → **export** to Rekordbox/Serato

*(AI off):* `createPlan` uses deterministic heuristics and the same validators.

## ✅ Validation & Safety Rails

- **Duration tolerance** (e.g., ±5 min around target)
- **No duplicates** and **all tracks exist** in the catalog
- Structured LLM prompts request **JSON-only** outputs with robust parsing & fallbacks to deterministic logic

## 🎨 User Experience

- DJ lands on **Discovery**, enters an event description and seeds, and reviews a proposed crate
- They can reprompt or issue targeted revisions ("swap the mid-set lull," "cap at 126 BPM")
- After approval, the crate is saved to **Library** and **exported**
- During performance, better track flow and energy progression → smoother set

## 🌟 What Makes It Different

- **Human-in-the-loop**: Keeps the DJ's style central; AI accelerates, doesn't replace
- **Mix-aware planning**: Not just "similar tracks"—explicitly optimizes energy flow and track progression
- **Operational compatibility**: Produces playlists that drop into standard DJ software

## ⚠️ Risks & Limitations (and Mitigations)

- **Metadata quality variance:** Track keys/BPM may be noisy → allow manual overrides; add auto-validators; encourage verified sources
- **LLM brittleness:** Non-JSON or off-spec responses → strict schemas, retries, and graceful deterministic fallbacks
- **Style drift:** AI suggestions may miss a DJ's "voice" → seed-driven planning + revision prompts + feedback memory
- **Catalog coverage:** If the local library is thin, discovery may be limited → future integrations with external catalogs

## 📈 Success Metrics

- **Prep time reduction** (minutes vs baseline hours)
- **User satisfaction** (revision count to acceptance, thumbs-up rate)
- **Adoption** (export count, repeat usage, crate reuse)

## 🗺️ Near-term Roadmap

1. **Phrase alignment v1:** Basic section detection to encourage 16/32-bar swaps
2. **Energy modeling:** Learn DJ-specific energy curves from feedback
3. **Adaptive prompting:** Auto-tune prompt variants based on failure cases
4. **Import pipelines:** Easier ingest from Beatport/Beatsource/record pools
5. **Deeper export:** Hot cue/beat grid hints (where metadata allows)

## 🎪 Demo Scenarios

### Scenario A
"Rooftop sunset • tech house • 120–124 BPM • 90 min" with 3 seeds → show ordered crate and concise rationale.

### Scenario B
Apply a revision ("avoid Artist X, raise energy sooner") and re-validate.

### Scenario C (AI off)
Manual plan + a validator failure (duration mismatch) → fix and finalize.

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd crate_planner

# Install dependencies
npm install

# Build the project
npm run build
```

### Quick Start: Import Tracks from Spotify

CratePilot now supports importing track data from Spotify Web API, including BPM, key (Camelot notation), energy, and more.

**1. Get Spotify API credentials** (2 minutes):
- Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Create a new app
- Copy your Client ID and Client Secret

**2. Set environment variables**:
```bash
# Windows PowerShell
$env:SPOTIFY_CLIENT_ID="your_client_id"
$env:SPOTIFY_CLIENT_SECRET="your_client_secret"

# Linux/Mac
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
```

**3. Import tracks**:
```typescript
import { MusicAssetCatalog } from './src/core/catalog';
import { SpotifyImporter } from './src/import/spotify_importer';

const catalog = new MusicAssetCatalog();
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// Import 20 techno tracks
const result = await importer.searchAndImport('genre:techno', 20);
console.log(`Imported ${result.tracksImported} tracks`);
```

**4. Run examples**:
```bash
npm run example:spotify
```

### Testing

```bash
# Run all tests
npm test

# Test Spotify importer
npm run test:spotify

# Test crate planner
npm run test:planner
```

### Documentation

- **[Spotify Setup Guide](docs/SPOTIFY_SETUP.md)** - Quick 5-minute setup
- **[Spotify Import Guide](docs/SPOTIFY_IMPORT_GUIDE.md)** - Complete API reference
- **[Import Module README](src/import/README.md)** - Technical details
- **[Export Module README](src/export/README.md)** - Export to DJ software

## 📝 License

[License information would go here]
