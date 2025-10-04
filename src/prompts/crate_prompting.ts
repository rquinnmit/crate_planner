/**
 * Crate Prompting - LLM Prompt Templates for CratePilot
 * 
 * Centralized prompt generation for all LLM-powered crate planning operations.
 * Provides consistent, well-structured prompts with proper formatting and guidelines.
 */

import { CratePrompt, DerivedIntent, CratePlan } from '../core/crate_planner';
import { Track } from '../core/track';
import { formatDurationLong, formatBPMRange as formatBPM } from '../utils/time_formatters';

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
  "energyCurve": "linear" | "wave" | "peak"
}

Guidelines:
- For allowedKeys, include harmonically compatible keys (same, adjacent, relative)
- For mixStyle, infer from the event description (sunset = smooth, club = energetic)
- For energyCurve, infer from event type (sunset = linear/wave, peak hour = peak)
- Keep arrays empty unless explicitly mentioned in the prompt
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
You are filtering tracks for a DJ crate based on derived intent.

INTENT:
- Tempo Range: ${intent.tempoRange.min}-${intent.tempoRange.max} BPM
- Allowed Keys: ${intent.allowedKeys.join(', ')}
- Genres: ${intent.targetGenres.join(', ')}
- Mix Style: ${intent.mixStyle}
- Energy Curve: ${intent.energyCurve || 'linear'}
- Must Include Artists: ${intent.mustIncludeArtists.join(', ') || 'None'}
- Avoid Artists: ${intent.avoidArtists.join(', ') || 'None'}

AVAILABLE TRACKS:
${trackList}

Select tracks that best match the intent. Return ONLY a JSON object:
{
  "selectedTrackIds": ["track-id-1", "track-id-2", ...],
  "reasoning": "Brief explanation of selection criteria"
}

Select 15-25 tracks that fit the vibe and constraints.
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
5. Reaches approximately ${Math.floor(intent.duration / 60)} minutes total

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
 * @returns LLM prompt for plan revision
 */
export function createRevisionPrompt(
    trackDetails: string,
    instructions: string,
    availableTrackInfo: string
): string {
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
- Similar total duration

Return ONLY a JSON object:
{
  "revisedTrackIds": ["track-id-1", "track-id-2", ...],
  "changesExplanation": "What changed and why"
}
`;
}

// ========== HELPER FUNCTIONS FOR FORMATTING ==========

/**
 * Format seed tracks for prompt inclusion
 * 
 * @param tracks - Array of Track objects
 * @returns Formatted string of seed tracks
 */
export function formatSeedTracks(tracks: Track[]): string {
    if (tracks.length === 0) {
        return 'None provided';
    }
    
    return tracks
        .map(track => `- ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key}, Energy: ${track.energy || 'N/A'})`)
        .join('\n');
}

/**
 * Format track list for candidate pool prompt
 * 
 * @param tracks - Array of Track objects
 * @returns Formatted string of tracks with full details
 */
export function formatTrackList(tracks: Track[]): string {
    if (tracks.length === 0) {
        return 'No tracks available';
    }
    
    return tracks
        .map(track => `${track.id}: ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key}, Energy: ${track.energy || 'N/A'})`)
        .join('\n');
}

/**
 * Format track list with duration for sequencing prompt
 * 
 * @param tracks - Array of Track objects
 * @returns Formatted string with duration information
 */
export function formatTracksWithDuration(tracks: Track[]): string {
    if (tracks.length === 0) {
        return 'No tracks available';
    }
    
    return tracks
        .map(track => `${track.id}: ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key}, ${track.duration_sec}s, Energy: ${track.energy || 'N/A'})`)
        .join('\n');
}

/**
 * Format seed track IDs with basic info for sequencing prompt
 * 
 * @param tracks - Array of Track objects
 * @returns Formatted string of seed tracks (simplified)
 */
export function formatSeedTrackIds(tracks: Track[]): string {
    if (tracks.length === 0) {
        return 'None';
    }
    
    return tracks
        .map(track => `${track.id}: ${track.artist} - ${track.title}`)
        .join('\n');
}

/**
 * Format crate tracks for explanation/revision prompts
 * 
 * @param tracks - Array of Track objects
 * @param includeEnergy - Whether to include energy information
 * @returns Formatted numbered list of tracks
 */
export function formatCrateTracks(tracks: Track[], includeEnergy: boolean = false): string {
    if (tracks.length === 0) {
        return 'Empty crate';
    }
    
    return tracks
        .map((track, index) => {
            const baseInfo = `${index + 1}. ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key})`;
            if (includeEnergy) {
                return `${index + 1}. ${track.id}: ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key}, Energy: ${track.energy || 'N/A'})`;
            }
            return baseInfo;
        })
        .join('\n');
}

/**
 * Format duration in a human-readable way
 * Re-exported from time_formatters for convenience
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "90 minutes" or "1 hour 30 minutes")
 */
export function formatDuration(seconds: number): string {
    return formatDurationLong(seconds);
}

/**
 * Format BPM range for display
 * Re-exported from time_formatters for convenience
 * 
 * @param min - Minimum BPM
 * @param max - Maximum BPM
 * @returns Formatted BPM range string
 */
export function formatBPMRange(min: number, max: number): string {
    return formatBPM(min, max);
}

/**
 * Format key list for display
 * 
 * @param keys - Array of Camelot keys
 * @returns Formatted key list string
 */
export function formatKeyList(keys: string[]): string {
    if (keys.length === 0) {
        return 'Any';
    }
    if (keys.length > 6) {
        return `${keys.slice(0, 6).join(', ')}, and ${keys.length - 6} more`;
    }
    return keys.join(', ');
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
