# Candidate Pool Generation Workflow Analysis

## Current Workflow

```
┌────────────────────────────────────────────────────────────┐
│              CANDIDATE POOL GENERATION                      │
└────────────────────────────────────────────────────────────┘

INPUT: DerivedIntent (from user prompting phase)
OUTPUT: CandidatePool (set of track IDs)

┌─────────────────────────────────────────────────────────────┐
│  Step 1: Check if Spotify is enabled                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ├─── YES: Spotify Path
                        │
                        └─── NO: Local Catalog Path

════════════════════════════════════════════════════════════════
SPOTIFY PATH (More Complex)
════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  Step 2a: SpotifySearchService.searchTracksForIntent()      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2a.1: Fetch available genre seeds (cached)            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2a.2: LLM Call #1 - Generate Spotify Query Plan       │ │
│  │       Input: DerivedIntent + available genre seeds     │ │
│  │       Output: SpotifyQueryPlan {                       │ │
│  │         searchQueries: ["tech house year:2021-2024"]   │ │
│  │         seedGenres: ["tech-house", "deep-house"]       │ │
│  │         seedArtists: ["Artist Name"]                   │ │
│  │         tunables: {min_tempo, max_tempo, ...}          │ │
│  │       }                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2a.3: Execute Spotify Search API                      │ │
│  │       - Run each search query                          │ │
│  │       - Import tracks to catalog                       │ │
│  │       - Deduplicate by ID                              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2a.4: Execute Spotify Recommendations API             │ │
│  │       - Resolve artist names to IDs                    │ │
│  │       - Resolve track names to IDs                     │ │
│  │       - Call recommendations with seeds + tunables     │ │
│  │       - Import tracks to catalog                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2a.5: Post-filter tracks                              │ │
│  │       - Filter by BPM range                            │ │
│  │       - Filter by allowed keys                         │ │
│  │       - Filter by energy level                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  RESULT: ~20-100 Spotify tracks matching intent            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 3: LLM Call #2 - Select Final Candidate Pool         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Input: DerivedIntent + filtered track list            │ │
│  │ Prompt: "Select 15-25 tracks that best match intent"  │ │
│  │ Output: { selectedTrackIds: [...], reasoning: "..." } │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

RESULT: CandidatePool with 15-25 track IDs

════════════════════════════════════════════════════════════════
LOCAL CATALOG PATH (Simpler)
════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  Step 2b: Get all tracks from local catalog                 │
│  RESULT: All local tracks (could be 0 to thousands)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 3: LLM Call #1 - Select Candidate Pool               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Input: DerivedIntent + ALL catalog tracks             │ │
│  │ Prompt: "Select 15-25 tracks that best match intent"  │ │
│  │ Output: { selectedTrackIds: [...], reasoning: "..." } │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

RESULT: CandidatePool with 15-25 track IDs
```

---

## Issues Identified

### 🔴 CRITICAL Issues

#### 1. **TWO LLM Calls in Spotify Path**
**Current**: 
- LLM Call #1: Generate Query Plan
- LLM Call #2: Select from results

**Problem**: 
- Double latency (~2-3 seconds per call)
- Double API cost
- Potential consistency issues between calls

#### 2. **LLM Doesn't Actually Call Spotify**
**Current**: LLM generates a plan, then service executes it

**Clarification Needed**: 
- This is actually CORRECT design! LLMs can't make API calls directly
- But could be confusing to users expecting "LLM accessing Spotify"

#### 3. **Token Limit Risk with Large Catalogs**
**Problem**: 
- Local catalog path sends ALL tracks to LLM
- If catalog has 1000+ tracks, could exceed token limits
- Each track ~50 tokens → 1000 tracks = ~50k tokens

**Current Mitigation**: None!

#### 4. **Post-Filtering After Fetch**
**Problem**:
- Fetches 50+ tracks from Spotify
- Then filters by BPM, key, energy
- Could end up with very few tracks after filtering
- Wastes Spotify API quota

**Example**: Fetch 50 tracks, only 10 match BPM range

---

### 🟡 MEDIUM Issues

#### 5. **No Pagination Strategy**
- Spotify APIs return max 50 items per request
- Current: Runs multiple searches but no clear strategy
- Could miss good tracks or get duplicates

#### 6. **Seed Limit Not Enforced Early**
- Spotify allows max 5 total seeds
- Current: Validates after LLM generates plan
- Could waste LLM call if plan has 10 seeds

#### 7. **Energy Filtering Logic Unclear**
**Current**:
```typescript
const trackEnergy = (track.energy || 3) / 5;  // 1-5 scale
const targetEnergy = intent.targetEnergy || 0.6;  // 0-1 scale
const energyMatch = Math.abs(trackEnergy - targetEnergy) < 0.3;
```

**Questions**:
- Is ±0.3 tolerance appropriate?
- Should it be configurable?
- What if track has no energy value?

#### 8. **Fallback Query Plan May Not Match Intent**
**Current Fallback**:
```typescript
searchQueries: queries.length > 0 ? queries : ['house year:2021-2024']
```

**Problem**: If user wants "ambient yoga music", fallback is "house" - wrong genre!

---

### 🟢 MINOR Issues

#### 9. **Search Query Sanitization Aggressive**
- Removes ALL unsupported filters
- But doesn't inform user what was removed
- Could silently ignore important constraints

#### 10. **No Caching of Spotify Results**
- Same query run multiple times = same API calls
- Could cache results for X minutes

#### 11. **Error Handling Could Be More Granular**
- Single try-catch for entire Spotify flow
- Hard to debug which specific step failed

---

## Optimization Recommendations

### 🚀 HIGH PRIORITY Optimizations

#### Option A: **Combine LLM Calls** (Recommended)
Instead of:
1. LLM generates query plan
2. Execute queries
3. LLM selects from results

Do:
1. Pre-filter catalog using deterministic rules (BPM, genre)
2. Single LLM call: "Given these constraints and this pre-filtered set, select 15-25 tracks"

**Pros**:
- Halves LLM calls (cost + latency)
- Simpler logic
- More consistent results

**Cons**:
- Less flexibility in query generation
- LLM doesn't control Spotify search strategy

#### Option B: **Keep Separate but Optimize Query Plan**
1. Generate query plan with stricter constraints
2. Apply filters DURING fetch (use Spotify API parameters)
3. LLM selection only if needed

**Pros**:
- Uses Spotify API filtering capabilities
- Fewer tracks fetched = faster
- Better quota management

**Cons**:
- Still two LLM calls
- More complex logic

---

### 🎯 MEDIUM PRIORITY Optimizations

#### 1. **Add Token Limit Protection**
```typescript
if (allTracks.length > 200) {
    // Pre-filter deterministically
    allTracks = this.catalog.searchTracks({
        bpmRange: intent.tempoRange,
        genre: intent.targetGenres[0]
    }).slice(0, 200);
}
```

#### 2. **Improve Fallback Logic**
```typescript
const fallbackGenre = intent.targetGenres[0] || 'electronic';
searchQueries: [`${fallbackGenre} year:2018-2025`]
```

#### 3. **Add Caching Layer**
```typescript
private queryCache: Map<string, Track[]> = new Map();
const cacheKey = JSON.stringify(queryPlan);
if (this.queryCache.has(cacheKey)) {
    return this.queryCache.get(cacheKey)!;
}
```

#### 4. **Use Spotify API Filtering**
Instead of post-filtering, use API parameters:
```typescript
// In search query
q += ` bpm:${intent.tempoRange.min}-${intent.tempoRange.max}`;

// In recommendations
params.min_tempo = intent.tempoRange.min;
params.max_tempo = intent.tempoRange.max;
```

Wait - the code already does this for recommendations! Just not for search.

---

### 🔧 LOW PRIORITY Optimizations

#### 1. **Batch Processing**
Process large catalogs in batches to avoid token limits

#### 2. **Configurable Limits**
Make maxTracksPerQuery, energy tolerance, etc. configurable

#### 3. **Better Logging**
Add structured logging for debugging

---

## Recommended Approach

### **Hybrid Optimization Strategy**

1. **Keep Dual-Source Approach** (Search + Recommendations)
   - Proven to work well
   - Provides diversity

2. **Apply Filters Earlier**
   - Use Spotify API parameters where possible
   - Reduce post-filtering

3. **Combine LLM Calls ONLY for Local Catalog**
   - Spotify path: Keep separate (query plan is valuable)
   - Local path: Single LLM call with pre-filtered list

4. **Add Token Protection**
   - Limit track list size to 200 tracks max
   - Pre-filter deterministically if needed

5. **Improve Fallbacks**
   - Use intent genres for fallback queries
   - Better error messages

---

## Questions for Discussion

1. **Is the double LLM call worth it for Spotify?**
   - Pro: Query plan allows sophisticated search strategies
   - Con: Doubles latency and cost

2. **Should we cache Spotify results?**
   - Pro: Faster, cheaper for repeated queries
   - Con: Stale results, memory usage

3. **What's the ideal candidate pool size?**
   - Current: 15-25 tracks
   - Is this enough for a 60-90 minute set?

4. **Should we expose query plan to user?**
   - Let them see what searches were run?
   - Allow manual adjustments?

---

## Current Status

- ✅ Basic workflow implemented
- ⚠️ Token limits not protected
- ⚠️ Double LLM calls in Spotify path
- ⚠️ Post-filtering could be optimized
- ✅ Good error handling with fallbacks
- ✅ Spotify API properly integrated

**Recommendation**: Proceed with testing current workflow, then optimize based on results.

