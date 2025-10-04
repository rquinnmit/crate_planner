/**
 * Utilities Module - Centralized utility functions
 * 
 * Provides convenient access to all utility functions used throughout CratePilot.
 */

// Camelot wheel utilities
export {
    getCompatibleKeys,
    areKeysCompatible,
    getRelativeKey,
    getAdjacentKeys,
    getKeyCompatibilityLevel,
    getKeyDistance,
    isValidCamelotKey,
    ALL_CAMELOT_KEYS
} from './camelot';

// Time formatting utilities
export {
    formatMMSS,
    formatDurationLong,
    formatDurationCompact,
    formatMinutes,
    parseMMSS,
    formatTimeRange,
    formatDurationWithTolerance,
    formatDurationDifference,
    formatBPMRange,
    formatTrackPosition,
    formatPercentage
} from './time_formatters';

// Music theory utilities
export {
    getBPMCompatibility,
    areBPMsMixable,
    getBPMTransition,
    getEnergyCompatibility,
    validateEnergyProgression,
    getTransitionQuality,
    suggestTrackOrder,
    analyzeSetMixability,
    getKeyInterval
} from './music_theory';
