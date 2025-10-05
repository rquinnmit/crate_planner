/**
 * Crate Prompting - LLM Prompt Templates for CratePilot
 * 
 * Centralized prompt generation for all LLM-powered crate planning operations.
 * Provides consistent, well-structured prompts with proper formatting and guidelines.
 */

import { CratePrompt, DerivedIntent } from '../core/crate_planner';

/**
 * Generate prompt for deriving intent from user input
 * Used in: CratePlanner.deriveIntentLLM()
 * 
 * @param prompt - User's crate prompt
 * @param seedTrackInfo - Formatted seed track information
 * @returns LLM prompt for intent derivation
 */
export function createDeriveIntentPrompt(
    prompt: CratePrompt,
    seedTrackInfo: string
): string {
    return `
You are an expert DJ assistant analyzing an event prompt to create a structured crate plan.

EVENT PROMPT:
${prompt.notes || 'No description provided'}

CONSTRAINTS:
- Tempo Range: ${prompt.tempoRange ? `${prompt.tempoRange.min}-${prompt.tempoRange.max} BPM` : 'Any'}
- Target Genre: ${prompt.targetGenre || 'Any'}
- Target Duration: ${prompt.targetDuration ? `${Math.floor(prompt.targetDuration / 60)} minutes` : 'Not specified'}
- Target Key: ${prompt.targetKey || 'Any'}

SEED TRACKS:
${seedTrackInfo || 'None provided'}

Based on this information, derive a detailed intent for track selection. Return ONLY a JSON object with this structure:
{
  "tempoRange": { "min": number, "max": number },
  "allowedKeys": ["8A", "9A", ...],
  "targetGenres": ["Tech House", ...],
  "duration": seconds,
  "mixStyle": "smooth" | "energetic" | "eclectic",
  "mustIncludeArtists": [],
  "avoidArtists": [],
  "mustIncludeTracks": [],
  "avoidTracks": [],
  "energyCurve": "linear" | "wave" | "peak",
  "targetEnergy": 0.6,
  "minPopularity": 30,
  "targetKeyCamelot": "8A"
}

Guidelines:
- For tempoRange, use the specified range or infer from context (sunset = 120-124, club = 125-130)
- For allowedKeys, include harmonically compatible keys (same, adjacent, relative) - if user mentions "8A key", include 8A, 7A, 9A, 8B
- For targetGenres, extract genres from the prompt (e.g., "sunset vibes" = Tech House, Deep House; "deep groove" = Deep House, Tech House)
- For mixStyle, infer from the event description (sunset = smooth, club = energetic, peak hour = energetic)
- For energyCurve, infer from event type (sunset = linear/wave, peak hour = peak, club = wave)
- For mustIncludeTracks, include any specific track names mentioned in the prompt
- For targetEnergy (0-1): smooth/chill = 0.4-0.6, energetic = 0.7-0.9, peak = 0.8-1.0
- For minPopularity (0-100): underground = 20-40, balanced = 30-60, mainstream = 50-80
- For targetKeyCamelot: match the user's specified key if provided, otherwise omit
- Keep arrays empty unless explicitly mentioned in the prompt

IMPORTANT: The LLM should intelligently fill in missing fields based on context:
- If no BPM specified, infer from genre and event type
- If no genres mentioned, infer from event description and mood keywords
`;
}

/**
 * Generate prompt for Spotify Query Plan
 * Used in: SpotifySearchService.createQueryPlanLLM()
 * 
 * @param intent - Derived intent from user prompt
 * @param availableGenreSeeds - List of valid Spotify genre seeds
 * @returns LLM prompt for query plan generation
 */
export function createQueryPlanPrompt(
    intent: any,  // DerivedIntent (imported from crate_planner)
    availableGenreSeeds: string[]
): string {
    return `
You are generating a Spotify Query Plan to find tracks matching a user's intent.

USER INTENT:
- Tempo Range: ${intent.tempoRange.min}-${intent.tempoRange.max} BPM
- Target Genres: ${intent.targetGenres.join(', ')}
- Mix Style: ${intent.mixStyle}
- Energy Curve: ${intent.energyCurve || 'linear'}
- Target Energy: ${intent.targetEnergy || 0.6}
- Min Popularity: ${intent.minPopularity || 30}
- Must Include Artists: ${intent.mustIncludeArtists.join(', ') || 'None'}

SPOTIFY API CONSTRAINTS (STRICT):
1. Search queries can only use: artist:"...", track:"...", year:YYYY-YYYY
2. Use plain text for genres (e.g., "tech house", "deep house")
3. Do NOT use: bpm:, tempo:, key:, mood:, energy:, genre:, tag:

AVAILABLE GENRE SEEDS for Recommendations:
${availableGenreSeeds.slice(0, 30).join(', ')}... (${availableGenreSeeds.length} total)

Create a query plan with both Search queries and Recommendations seeds.

Return ONLY a JSON object:
{
  "searchQueries": [
    "tech house year:2021-2024",
    "deep house year:2022-2024",
    "artist:\\"Charlotte de Witte\\" year:2021-2024"
  ],
  "seedGenres": ["tech-house", "deep-house"],
  "seedArtists": ["Charlotte de Witte", "CamelPhat"],
  "seedTracks": [],
  "tunables": {
    "min_tempo": 120,
    "max_tempo": 124,
    "target_energy": 0.6,
    "min_popularity": 30
  },
  "reasoning": "Brief explanation of the query strategy"
}

Guidelines:
- searchQueries: 3-5 queries using plain text genres + year ranges + optional artist/track filters
- seedGenres: Pick 1-3 from available genre seeds that match targetGenres (use exact strings from list)
- seedArtists: Popular artists in the target genres (0-2 names)
- seedTracks: Leave empty unless user mentioned specific tracks
- tunables.min_tempo/max_tempo: Match intent.tempoRange
- tunables.target_energy: Match intent.targetEnergy (0-1 scale)
- tunables.min_popularity: Match intent.minPopularity (0-100 scale)
- Total seeds (genres + artists + tracks) must not exceed 5
- Reasoning: Explain search + recommendations strategy
`;
}

/**
 * Generate prompt for candidate pool selection
 * Used in: CratePlanner.generateCandidatePoolLLM()
 * 
 * @param intent - Derived intent from user prompt
 * @param trackList - Formatted list of available tracks
 * @returns LLM prompt for candidate selection
 */
export function createCandidatePoolPrompt(
    intent: DerivedIntent,
    trackList: string
): string {
    return `
You are an expert DJ selecting tracks for a crate based on the user's intent and available tracks.

USER INTENT:
- Tempo Range: ${intent.tempoRange.min}-${intent.tempoRange.max} BPM
- Allowed Keys: ${intent.allowedKeys.length > 0 ? intent.allowedKeys.join(', ') : 'Any key'}
- Target Genres: ${intent.targetGenres.join(', ')}
- Mix Style: ${intent.mixStyle}
- Energy Curve: ${intent.energyCurve || 'linear'}
- Must Include Artists: ${intent.mustIncludeArtists.join(', ') || 'None'}
- Avoid Artists: ${intent.avoidArtists.join(', ') || 'None'}

AVAILABLE TRACKS:
${trackList}

Your task: Select tracks that best match the user's intent and create a cohesive crate.

Selection criteria:
1. Prioritize tracks within the BPM range (${intent.tempoRange.min}-${intent.tempoRange.max})
2. Consider harmonic compatibility (same key, adjacent keys, or relative keys)
3. Match the mix style (${intent.mixStyle}) and energy curve (${intent.energyCurve || 'linear'})
4. Include tracks from target genres when available: ${intent.targetGenres.join(', ')}
5. Avoid tracks from artists to avoid: ${intent.avoidArtists.join(', ') || 'None'}
6. **IMPORTANT: Maximize artist diversity - limit to 2 tracks maximum per artist**
7. Select 15-25 tracks for a good variety with diverse artists

Return ONLY a JSON object:
{
  "selectedTrackIds": ["track-id-1", "track-id-2", ...],
  "reasoning": "Brief explanation of your selection strategy and how tracks fit the intent"
}

Important: Only use track IDs that exist in the available tracks list above.
`;
}

/**
 * Generate prompt for track sequencing
 * Used in: CratePlanner.sequencePlanLLM()
 * 
 * @param intent - Derived intent
 * @param trackInfo - Formatted candidate track information
 * @param seedInfo - Formatted seed track information
 * @returns LLM prompt for track sequencing
 */
export function createSequencePlanPrompt(
    intent: DerivedIntent,
    trackInfo: string,
    seedInfo: string
): string {
    return `
You are sequencing tracks for a DJ set to create optimal flow and energy progression.

INTENT:
- Duration Target: ${Math.floor(intent.duration / 60)} minutes (${intent.duration} seconds)
- Mix Style: ${intent.mixStyle}
- Energy Curve: ${intent.energyCurve || 'linear'}
- Avoid Artists: ${intent.avoidArtists.join(', ') || 'None'}

SEED TRACKS (must include):
${seedInfo}

AVAILABLE TRACKS:
${trackInfo}

Create an ordered tracklist that:
1. Includes all seed tracks in good positions
2. Considers harmonic compatibility (same key, adjacent keys, relative keys)
3. Prefers gradual BPM changes over sudden jumps
4. Follows the energy curve (${intent.energyCurve || 'linear'})
5. **Maximizes artist diversity - limit to 2 tracks maximum per artist**
6. Reaches approximately ${Math.floor(intent.duration / 60)} minutes total

Return ONLY a JSON object:
{
  "orderedTrackIds": ["track-id-1", "track-id-2", ...],
  "reasoning": "Brief explanation of sequencing strategy"
}
`;
}

/**
 * Generate prompt for plan explanation
 * Used in: CratePlanner.explainPlanLLM()
 * 
 * @param trackDetails - Formatted track list with details
 * @param totalDuration - Total duration in seconds
 * @returns LLM prompt for plan explanation
 */
export function createExplainPlanPrompt(
    trackDetails: string,
    totalDuration: number
): string {
    return `
You are explaining why a DJ crate works well for the given event.

CRATE:
${trackDetails}

Total Duration: ${Math.floor(totalDuration / 60)} minutes

Provide a concise explanation of:
1. Overall flow and energy progression
2. Track selection and sequencing strategy
3. How the BPM and key progression supports the vibe
4. How it fits the event atmosphere

Keep it under 200 words and focus on DJ-relevant details.
`;
}

/**
 * Generate prompt for plan revision
 * Used in: CratePlanner.revisePlanLLM()
 * 
 * @param trackDetails - Current crate track details
 * @param instructions - User's revision instructions
 * @param availableTrackInfo - Available tracks for replacement
 * @param targetDuration - Target duration in seconds to maintain
 * @returns LLM prompt for plan revision
 */
export function createRevisionPrompt(
    trackDetails: string,
    instructions: string,
    availableTrackInfo: string,
    targetDuration: number
): string {
    const targetMinutes = Math.floor(targetDuration / 60);
    const toleranceMinutes = 5;
    
    return `
You are revising a DJ crate based on user feedback.

CURRENT CRATE:
${trackDetails}

USER INSTRUCTIONS:
${instructions}

AVAILABLE TRACKS FOR REPLACEMENT:
${availableTrackInfo}

Revise the crate to address the user's feedback while maintaining:
- Good energy flow and progression
- Compatible keys and smooth BPM changes where possible
- Target duration: ${targetMinutes} minutes (${targetDuration} seconds)
  IMPORTANT: Keep total duration within ±${toleranceMinutes} minutes of target

Guidelines for revision:
1. Address the specific user feedback first
2. Replace or reorder tracks as needed
3. Maintain smooth transitions between tracks
4. Keep similar total duration (within ${toleranceMinutes} minutes)
5. Only use track IDs from the available tracks list

Return ONLY a JSON object:
{
  "revisedTrackIds": ["track-id-1", "track-id-2", ...],
  "changesExplanation": "What changed and why (be specific about which tracks were added/removed/reordered)"
}
`;
}

// ========== PROMPT VALIDATION ==========

/**
 * Validate that a prompt has required information
 * 
 * @param prompt - Prompt string to validate
 * @returns true if prompt appears valid
 */
export function validatePrompt(prompt: string): boolean {
    // Check minimum length
    if (prompt.length < 50) {
        return false;
    }
    
    // Check for key sections
    const hasRole = prompt.includes('You are');
    const hasInstructions = prompt.includes('Return ONLY a JSON');
    
    return hasRole && hasInstructions;
}

/**
 * Estimate token count for a prompt (rough approximation)
 * Useful for staying within model limits
 * 
 * @param prompt - Prompt string
 * @returns Estimated token count
 */
export function estimateTokenCount(prompt: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(prompt.length / 4);
}

/**
 * Truncate track list if it exceeds token limits
 * 
 * @param trackList - Formatted track list
 * @param maxTokens - Maximum allowed tokens
 * @returns Truncated track list
 */
export function truncateTrackList(trackList: string, maxTokens: number = 1500): string {
    const estimatedTokens = estimateTokenCount(trackList);
    
    if (estimatedTokens <= maxTokens) {
        return trackList;
    }
    
    // Truncate to approximately maxTokens
    const targetLength = maxTokens * 4;
    const truncated = trackList.substring(0, targetLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    return truncated.substring(0, lastNewline) + '\n... (list truncated)';
}
