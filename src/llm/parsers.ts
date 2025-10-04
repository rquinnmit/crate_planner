/**
 * LLM Response Parsers
 * 
 * Type-safe parsers for structured LLM responses in CratePilot.
 * Handles JSON extraction, validation, and error recovery.
 */

import { DerivedIntent, CandidatePool, CratePlan } from '../core/crate_planner';
import { CamelotKey } from '../core/track';
import { isValidCamelotKey as validateCamelotKey } from '../utils/camelot';

/**
 * Generic JSON extraction from LLM response
 * Handles cases where LLM includes extra text around JSON
 * 
 * @param response - Raw LLM response text
 * @returns Extracted JSON string
 * @throws Error if no JSON found
 */
export function extractJSON(response: string): string {
    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
    }
    
    return jsonMatch[0];
}

/**
 * Parse and validate DerivedIntent from LLM response
 * 
 * @param response - Raw LLM response text
 * @returns Parsed and validated DerivedIntent
 * @throws Error if parsing or validation fails
 */
export function parseDerivedIntent(response: string): DerivedIntent {
    try {
        const jsonStr = extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        // Validate required fields
        if (!parsed.tempoRange || typeof parsed.tempoRange.min !== 'number' || typeof parsed.tempoRange.max !== 'number') {
            throw new Error('Invalid or missing tempoRange');
        }
        
        if (!parsed.duration || typeof parsed.duration !== 'number') {
            throw new Error('Invalid or missing duration');
        }
        
        // Ensure arrays exist (even if empty)
        const intent: DerivedIntent = {
            tempoRange: parsed.tempoRange,
            allowedKeys: Array.isArray(parsed.allowedKeys) ? parsed.allowedKeys : [],
            targetGenres: Array.isArray(parsed.targetGenres) ? parsed.targetGenres : [],
            duration: parsed.duration,
            mixStyle: parsed.mixStyle || 'smooth',
            mustIncludeArtists: Array.isArray(parsed.mustIncludeArtists) ? parsed.mustIncludeArtists : [],
            avoidArtists: Array.isArray(parsed.avoidArtists) ? parsed.avoidArtists : [],
            mustIncludeTracks: Array.isArray(parsed.mustIncludeTracks) ? parsed.mustIncludeTracks : [],
            avoidTracks: Array.isArray(parsed.avoidTracks) ? parsed.avoidTracks : [],
            energyCurve: parsed.energyCurve || 'linear'
        };
        
        return intent;
    } catch (error) {
        throw new Error(`Failed to parse DerivedIntent: ${(error as Error).message}`);
    }
}

/**
 * Parse candidate pool selection from LLM response
 * 
 * @param response - Raw LLM response text
 * @returns Object with selected track IDs and reasoning
 * @throws Error if parsing fails
 */
export function parseCandidatePoolSelection(response: string): {
    selectedTrackIds: string[];
    reasoning: string;
} {
    try {
        const jsonStr = extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        if (!Array.isArray(parsed.selectedTrackIds)) {
            throw new Error('selectedTrackIds must be an array');
        }
        
        return {
            selectedTrackIds: parsed.selectedTrackIds,
            reasoning: parsed.reasoning || 'No reasoning provided'
        };
    } catch (error) {
        throw new Error(`Failed to parse candidate pool selection: ${(error as Error).message}`);
    }
}

/**
 * Parse track sequencing from LLM response
 * 
 * @param response - Raw LLM response text
 * @returns Object with ordered track IDs and reasoning
 * @throws Error if parsing fails
 */
export function parseTrackSequence(response: string): {
    orderedTrackIds: string[];
    reasoning: string;
} {
    try {
        const jsonStr = extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        if (!Array.isArray(parsed.orderedTrackIds)) {
            throw new Error('orderedTrackIds must be an array');
        }
        
        return {
            orderedTrackIds: parsed.orderedTrackIds,
            reasoning: parsed.reasoning || 'No reasoning provided'
        };
    } catch (error) {
        throw new Error(`Failed to parse track sequence: ${(error as Error).message}`);
    }
}

/**
 * Parse plan revision from LLM response
 * 
 * @param response - Raw LLM response text
 * @returns Object with revised track IDs and explanation
 * @throws Error if parsing fails
 */
export function parsePlanRevision(response: string): {
    revisedTrackIds: string[];
    changesExplanation: string;
} {
    try {
        const jsonStr = extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        if (!Array.isArray(parsed.revisedTrackIds)) {
            throw new Error('revisedTrackIds must be an array');
        }
        
        return {
            revisedTrackIds: parsed.revisedTrackIds,
            changesExplanation: parsed.changesExplanation || 'No explanation provided'
        };
    } catch (error) {
        throw new Error(`Failed to parse plan revision: ${(error as Error).message}`);
    }
}

/**
 * Validate Camelot key format
 * Re-exported from camelot utils for convenience
 * 
 * @param key - Key string to validate
 * @returns true if valid Camelot key
 */
export function isValidCamelotKey(key: string): key is CamelotKey {
    return validateCamelotKey(key);
}

/**
 * Sanitize and validate track IDs from LLM response
 * Filters out invalid IDs and duplicates
 * 
 * @param trackIds - Array of track IDs from LLM
 * @returns Sanitized array of unique, valid track IDs
 */
export function sanitizeTrackIds(trackIds: string[]): string[] {
    if (!Array.isArray(trackIds)) {
        return [];
    }
    
    // Remove duplicates and filter out invalid IDs
    const seen = new Set<string>();
    const sanitized: string[] = [];
    
    for (const id of trackIds) {
        if (typeof id === 'string' && id.trim().length > 0 && !seen.has(id)) {
            sanitized.push(id.trim());
            seen.add(id);
        }
    }
    
    return sanitized;
}

/**
 * Parse any JSON response with type safety
 * Generic parser for custom response types
 * 
 * @param response - Raw LLM response text
 * @param validator - Optional validation function
 * @returns Parsed object of type T
 * @throws Error if parsing or validation fails
 */
export function parseJSON<T>(
    response: string,
    validator?: (obj: any) => obj is T
): T {
    try {
        const jsonStr = extractJSON(response);
        const parsed = JSON.parse(jsonStr);
        
        if (validator && !validator(parsed)) {
            throw new Error('Validation failed for parsed object');
        }
        
        return parsed as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
    }
}

/**
 * Safe JSON parse with fallback
 * Returns fallback value instead of throwing on error
 * 
 * @param response - Raw LLM response text
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function parseJSONSafe<T>(response: string, fallback: T): T {
    try {
        return parseJSON<T>(response);
    } catch (error) {
        console.warn('⚠️ JSON parsing failed, using fallback:', (error as Error).message);
        return fallback;
    }
}

/**
 * Validate LLM response structure before parsing
 * Checks if response likely contains valid JSON
 * 
 * @param response - Raw LLM response text
 * @returns true if response appears to contain JSON
 */
export function hasValidJSON(response: string): boolean {
    try {
        extractJSON(response);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract and clean text explanation from LLM response
 * Removes JSON and returns just the natural language explanation
 * 
 * @param response - Raw LLM response text
 * @returns Cleaned explanation text
 */
export function extractExplanation(response: string): string {
    // Try to remove JSON if present
    const cleaned = response.replace(/\{[\s\S]*\}/, '').trim();
    return cleaned || response.trim();
}

/**
 * Parse multiple JSON objects from response
 * Handles cases where LLM returns multiple JSON objects
 * 
 * @param response - Raw LLM response text
 * @returns Array of parsed objects
 */
export function parseMultipleJSON<T>(response: string): T[] {
    const results: T[] = [];
    const jsonRegex = /\{[\s\S]*?\}/g;
    const matches = response.match(jsonRegex);
    
    if (!matches) {
        return results;
    }
    
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match);
            results.push(parsed as T);
        } catch (error) {
            // Skip invalid JSON objects
            continue;
        }
    }
    
    return results;
}

/**
 * Validate and normalize BPM range
 * 
 * @param range - BPM range object
 * @returns Normalized BPM range
 * @throws Error if invalid
 */
export function validateBPMRange(range: any): { min: number; max: number } {
    if (!range || typeof range.min !== 'number' || typeof range.max !== 'number') {
        throw new Error('Invalid BPM range');
    }
    
    if (range.min < 0 || range.max < 0 || range.min > range.max) {
        throw new Error('BPM range values must be positive and min <= max');
    }
    
    return {
        min: Math.round(range.min),
        max: Math.round(range.max)
    };
}

/**
 * Validate and normalize duration
 * 
 * @param duration - Duration in seconds
 * @returns Normalized duration
 * @throws Error if invalid
 */
export function validateDuration(duration: any): number {
    if (typeof duration !== 'number' || duration < 0) {
        throw new Error('Duration must be a positive number');
    }
    
    return Math.round(duration);
}

/**
 * Error recovery: attempt to fix common LLM JSON formatting issues
 * 
 * @param response - Raw LLM response text
 * @returns Fixed JSON string or original
 */
export function attemptJSONFix(response: string): string {
    let fixed = response;
    
    // Remove markdown code blocks
    fixed = fixed.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Remove common prefixes
    fixed = fixed.replace(/^(Here's|Here is|The|This is).*?(\{)/i, '$2');
    
    // Try to extract just the JSON part
    const match = fixed.match(/\{[\s\S]*\}/);
    if (match) {
        fixed = match[0];
    }
    
    return fixed;
}
