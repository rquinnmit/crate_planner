/**
 * Validation Constraints
 * 
 * Centralized validation rules and constraint checking for crate planning.
 * Provides reusable validators for tracks, plans, and user inputs.
 */

import { Track, CamelotKey, TrackFilter } from '../core/track';
import { CratePlan, CratePrompt, DerivedIntent } from '../core/crate_planner';
import { isValidCamelotKey } from '../utils/camelot';

/**
 * Validation result structure
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

/**
 * Constraint violation details
 */
export interface ConstraintViolation {
    field: string;
    value: any;
    constraint: string;
    message: string;
}

// ========== TRACK VALIDATION ==========

/**
 * Validate a track object has all required fields
 * 
 * @param track - Track to validate
 * @returns Validation result
 */
export function validateTrack(track: Partial<Track>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!track.id) errors.push('Track ID is required');
    if (!track.artist) errors.push('Artist is required');
    if (!track.title) errors.push('Title is required');
    if (track.bpm === undefined || track.bpm === null) {
        errors.push('BPM is required');
    } else if (track.bpm < 60 || track.bpm > 200) {
        warnings.push(`BPM ${track.bpm} is outside typical range (60-200)`);
    }
    
    if (!track.key) {
        errors.push('Key is required');
    } else if (!isValidCamelotKey(track.key)) {
        errors.push(`Invalid Camelot key: ${track.key}`);
    }
    
    if (track.duration_sec === undefined || track.duration_sec === null) {
        errors.push('Duration is required');
    } else if (track.duration_sec < 30) {
        warnings.push('Track duration is very short (< 30 seconds)');
    } else if (track.duration_sec > 900) {
        warnings.push('Track duration is very long (> 15 minutes)');
    }
    
    // Optional fields validation
    if (track.energy !== undefined && (track.energy < 1 || track.energy > 5)) {
        errors.push('Energy must be between 1 and 5');
    }
    
    if (track.year !== undefined && (track.year < 1900 || track.year > new Date().getFullYear() + 1)) {
        warnings.push(`Year ${track.year} seems unusual`);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate track file path exists and is accessible
 * 
 * @param track - Track to validate
 * @returns Validation result
 */
export function validateTrackFilePath(track: Track): ValidationResult {
    const errors: string[] = [];
    
    if (!track.filePath) {
        errors.push(`Track ${track.id} has no file path`);
    }
    // Note: File existence check is done in exporters to avoid fs dependency here
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// ========== PROMPT VALIDATION ==========

/**
 * Validate a crate prompt
 * 
 * @param prompt - Prompt to validate
 * @returns Validation result
 */
export function validateCratePrompt(prompt: CratePrompt): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate tempo range
    if (prompt.tempoRange) {
        const { min, max } = prompt.tempoRange;
        if (min < 0 || max < 0) {
            errors.push('BPM values must be positive');
        }
        if (min > max) {
            errors.push('Minimum BPM cannot be greater than maximum BPM');
        }
        if (min < 60 || max > 200) {
            warnings.push('BPM range is outside typical DJ range (60-200)');
        }
        if (max - min > 40) {
            warnings.push('Wide BPM range may make mixing difficult');
        }
    }
    
    // Validate target key
    if (prompt.targetKey && !isValidCamelotKey(prompt.targetKey)) {
        errors.push(`Invalid target key: ${prompt.targetKey}`);
    }
    
    // Validate target duration
    if (prompt.targetDuration !== undefined) {
        if (prompt.targetDuration < 0) {
            errors.push('Target duration must be positive');
        }
        if (prompt.targetDuration < 600) {
            warnings.push('Target duration is very short (< 10 minutes)');
        }
        if (prompt.targetDuration > 14400) {
            warnings.push('Target duration is very long (> 4 hours)');
        }
    }
    
    // Validate sample tracks
    if (prompt.sampleTracks && prompt.sampleTracks.length === 0) {
        warnings.push('Sample tracks array is empty');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate derived intent
 * 
 * @param intent - Intent to validate
 * @returns Validation result
 */
export function validateDerivedIntent(intent: DerivedIntent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate tempo range
    if (!intent.tempoRange || intent.tempoRange.min > intent.tempoRange.max) {
        errors.push('Invalid tempo range in derived intent');
    }
    
    // Validate duration
    if (!intent.duration || intent.duration < 0) {
        errors.push('Invalid duration in derived intent');
    }
    
    // Validate allowed keys
    if (intent.allowedKeys) {
        for (const key of intent.allowedKeys) {
            if (!isValidCamelotKey(key)) {
                errors.push(`Invalid key in allowedKeys: ${key}`);
            }
        }
    }
    
    // Validate mix style
    const validMixStyles = ['smooth', 'energetic', 'eclectic'];
    if (!validMixStyles.includes(intent.mixStyle)) {
        errors.push(`Invalid mix style: ${intent.mixStyle}`);
    }
    
    // Validate energy curve
    if (intent.energyCurve) {
        const validCurves = ['linear', 'wave', 'peak'];
        if (!validCurves.includes(intent.energyCurve)) {
            errors.push(`Invalid energy curve: ${intent.energyCurve}`);
        }
    }
    
    // Validate Spotify-specific fields (optional)
    if (intent.targetEnergy !== undefined) {
        if (intent.targetEnergy < 0 || intent.targetEnergy > 1) {
            errors.push('targetEnergy must be between 0 and 1');
        }
    }
    
    if (intent.minPopularity !== undefined) {
        if (intent.minPopularity < 0 || intent.minPopularity > 100) {
            errors.push('minPopularity must be between 0 and 100');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// ========== PLAN VALIDATION ==========

/**
 * Validate a crate plan (comprehensive check)
 * 
 * @param plan - Plan to validate
 * @param toleranceSeconds - Duration tolerance in seconds
 * @returns Validation result
 */
export function validateCratePlan(
    plan: CratePlan,
    toleranceSeconds: number = 300
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check track list
    if (!plan.trackList || plan.trackList.length === 0) {
        errors.push('Plan has no tracks');
        return { isValid: false, errors, warnings };
    }
    
    // Check for duplicates
    const uniqueTracks = new Set(plan.trackList);
    if (uniqueTracks.size !== plan.trackList.length) {
        errors.push('Duplicate tracks found in plan');
    }
    
    // Check duration tolerance
    if (plan.prompt.targetDuration) {
        const diff = Math.abs(plan.totalDuration - plan.prompt.targetDuration);
        if (diff > toleranceSeconds) {
            errors.push(
                `Duration ${Math.floor(plan.totalDuration / 60)}min is outside tolerance ` +
                `(target: ${Math.floor(plan.prompt.targetDuration / 60)}min ± ${Math.floor(toleranceSeconds / 60)}min)`
            );
        } else if (diff > toleranceSeconds * 0.5) {
            warnings.push('Duration is close to tolerance limit');
        }
    }
    
    // Check minimum set length
    if (plan.totalDuration < 600) {
        warnings.push('Set is very short (< 10 minutes)');
    }
    
    // Check track count
    if (plan.trackList.length < 5) {
        warnings.push('Very few tracks in plan (< 5)');
    } else if (plan.trackList.length > 50) {
        warnings.push('Very many tracks in plan (> 50)');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate plan can be finalized
 * 
 * @param plan - Plan to check
 * @returns Validation result
 */
export function validatePlanForFinalization(plan: CratePlan): ValidationResult {
    const errors: string[] = [];
    
    if (plan.isFinalized) {
        errors.push('Plan is already finalized');
    }
    
    const basicValidation = validateCratePlan(plan);
    if (!basicValidation.isValid) {
        errors.push(...basicValidation.errors);
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// ========== FILTER VALIDATION ==========

/**
 * Validate track filter criteria
 * 
 * @param filter - Filter to validate
 * @returns Validation result
 */
export function validateTrackFilter(filter: TrackFilter): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate BPM range
    if (filter.bpmRange) {
        if (filter.bpmRange.min > filter.bpmRange.max) {
            errors.push('BPM range min cannot be greater than max');
        }
        if (filter.bpmRange.min < 0 || filter.bpmRange.max < 0) {
            errors.push('BPM values must be positive');
        }
    }
    
    // Validate energy range
    if (filter.energyRange) {
        if (filter.energyRange.min < 1 || filter.energyRange.max > 5) {
            errors.push('Energy range must be between 1 and 5');
        }
        if (filter.energyRange.min > filter.energyRange.max) {
            errors.push('Energy range min cannot be greater than max');
        }
    }
    
    // Validate duration range
    if (filter.durationRange) {
        if (filter.durationRange.min > filter.durationRange.max) {
            errors.push('Duration range min cannot be greater than max');
        }
        if (filter.durationRange.min < 0 || filter.durationRange.max < 0) {
            errors.push('Duration values must be positive');
        }
    }
    
    // Validate keys
    if (filter.key && !isValidCamelotKey(filter.key)) {
        errors.push(`Invalid key: ${filter.key}`);
    }
    
    if (filter.keys) {
        for (const key of filter.keys) {
            if (!isValidCamelotKey(key)) {
                errors.push(`Invalid key in keys array: ${key}`);
            }
        }
    }
    
    // Check for conflicting filters
    if (filter.artist && filter.excludeArtists?.includes(filter.artist)) {
        warnings.push('Artist filter conflicts with exclude list');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// ========== CONSTRAINT CHECKERS ==========

/**
 * Check if a track satisfies BPM constraints
 * 
 * @param track - Track to check
 * @param min - Minimum BPM
 * @param max - Maximum BPM
 * @returns true if track is within range
 */
export function satisfiesBPMConstraint(track: Track, min: number, max: number): boolean {
    return track.bpm >= min && track.bpm <= max;
}

/**
 * Check if a track satisfies duration constraints
 * 
 * @param track - Track to check
 * @param min - Minimum duration in seconds
 * @param max - Maximum duration in seconds
 * @returns true if track is within range
 */
export function satisfiesDurationConstraint(track: Track, min: number, max: number): boolean {
    return track.duration_sec >= min && track.duration_sec <= max;
}

/**
 * Check if a track satisfies energy constraints
 * 
 * @param track - Track to check
 * @param min - Minimum energy (1-5)
 * @param max - Maximum energy (1-5)
 * @returns true if track is within range
 */
export function satisfiesEnergyConstraint(track: Track, min: number, max: number): boolean {
    if (!track.energy) return false;
    return track.energy >= min && track.energy <= max;
}

/**
 * Check if a track satisfies all constraints in a filter
 * 
 * @param track - Track to check
 * @param filter - Filter constraints
 * @returns true if track satisfies all constraints
 */
export function satisfiesAllConstraints(track: Track, filter: TrackFilter): boolean {
    // BPM constraint
    if (filter.bpmRange && !satisfiesBPMConstraint(track, filter.bpmRange.min, filter.bpmRange.max)) {
        return false;
    }
    
    // Duration constraint
    if (filter.durationRange && !satisfiesDurationConstraint(track, filter.durationRange.min, filter.durationRange.max)) {
        return false;
    }
    
    // Energy constraint
    if (filter.energyRange && !satisfiesEnergyConstraint(track, filter.energyRange.min, filter.energyRange.max)) {
        return false;
    }
    
    // Genre constraint
    if (filter.genre && track.genre !== filter.genre) {
        return false;
    }
    
    // Key constraint
    if (filter.key && track.key !== filter.key) {
        return false;
    }
    
    if (filter.keys && !filter.keys.includes(track.key)) {
        return false;
    }
    
    // Artist constraint
    if (filter.artist && track.artist !== filter.artist) {
        return false;
    }
    
    if (filter.artists && !filter.artists.includes(track.artist)) {
        return false;
    }
    
    if (filter.excludeArtists && filter.excludeArtists.includes(track.artist)) {
        return false;
    }
    
    return true;
}

/**
 * Get constraint violations for a track
 * 
 * @param track - Track to check
 * @param filter - Filter constraints
 * @returns Array of violations
 */
export function getConstraintViolations(track: Track, filter: TrackFilter): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    
    if (filter.bpmRange && !satisfiesBPMConstraint(track, filter.bpmRange.min, filter.bpmRange.max)) {
        violations.push({
            field: 'bpm',
            value: track.bpm,
            constraint: `${filter.bpmRange.min}-${filter.bpmRange.max}`,
            message: `BPM ${track.bpm} is outside range ${filter.bpmRange.min}-${filter.bpmRange.max}`
        });
    }
    
    if (filter.genre && track.genre !== filter.genre) {
        violations.push({
            field: 'genre',
            value: track.genre,
            constraint: filter.genre,
            message: `Genre "${track.genre}" does not match required "${filter.genre}"`
        });
    }
    
    if (filter.key && track.key !== filter.key) {
        violations.push({
            field: 'key',
            value: track.key,
            constraint: filter.key,
            message: `Key "${track.key}" does not match required "${filter.key}"`
        });
    }
    
    return violations;
}
