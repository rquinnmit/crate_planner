/**
 * Camelot Wheel Utilities
 * 
 * Provides harmonic mixing utilities based on the Camelot wheel system.
 * The Camelot wheel is a tool for DJs to find harmonically compatible keys.
 */

import { CamelotKey } from '../core/track';

/**
 * Get compatible keys for harmonic mixing
 * Based on Camelot wheel: same key, adjacent keys (+/-1), and relative key (A↔B)
 * 
 * @param key - Starting Camelot key
 * @returns Array of compatible keys
 * 
 * @example
 * getCompatibleKeys('8A') // Returns: ['8A', '8B', '9A', '7A']
 */
export function getCompatibleKeys(key: CamelotKey): CamelotKey[] {
    const number = parseInt(key.slice(0, -1));
    const letter = key.slice(-1) as 'A' | 'B';

    const compatible: CamelotKey[] = [];

    // Same key (perfect match)
    compatible.push(key);

    // Relative key (A ↔ B) - major/minor relative
    const relativeKey = `${number}${letter === 'A' ? 'B' : 'A'}` as CamelotKey;
    compatible.push(relativeKey);

    // Adjacent keys (+1 and -1) - smooth transitions
    const nextNumber = number === 12 ? 1 : number + 1;
    const prevNumber = number === 1 ? 12 : number - 1;

    compatible.push(`${nextNumber}${letter}` as CamelotKey);
    compatible.push(`${prevNumber}${letter}` as CamelotKey);

    return compatible;
}

/**
 * Check if two keys are compatible for harmonic mixing
 * 
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns true if keys are compatible
 */
export function areKeysCompatible(key1: CamelotKey, key2: CamelotKey): boolean {
    const compatible = getCompatibleKeys(key1);
    return compatible.includes(key2);
}

/**
 * Get the relative key (major ↔ minor)
 * 
 * @param key - Camelot key
 * @returns The relative key
 * 
 * @example
 * getRelativeKey('8A') // Returns: '8B'
 * getRelativeKey('8B') // Returns: '8A'
 */
export function getRelativeKey(key: CamelotKey): CamelotKey {
    const number = key.slice(0, -1);
    const letter = key.slice(-1) as 'A' | 'B';
    return `${number}${letter === 'A' ? 'B' : 'A'}` as CamelotKey;
}

/**
 * Get adjacent keys (+1 and -1 on the wheel)
 * 
 * @param key - Camelot key
 * @returns Array of adjacent keys
 */
export function getAdjacentKeys(key: CamelotKey): CamelotKey[] {
    const number = parseInt(key.slice(0, -1));
    const letter = key.slice(-1) as 'A' | 'B';

    const nextNumber = number === 12 ? 1 : number + 1;
    const prevNumber = number === 1 ? 12 : number - 1;

    return [
        `${nextNumber}${letter}` as CamelotKey,
        `${prevNumber}${letter}` as CamelotKey
    ];
}

/**
 * Get key compatibility level
 * 
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns Compatibility level: 'perfect', 'compatible', or 'incompatible'
 */
export function getKeyCompatibilityLevel(
    key1: CamelotKey,
    key2: CamelotKey
): 'perfect' | 'compatible' | 'incompatible' {
    if (key1 === key2) {
        return 'perfect';
    }

    const compatible = getCompatibleKeys(key1);
    if (compatible.includes(key2)) {
        return 'compatible';
    }

    return 'incompatible';
}

/**
 * Calculate key distance on the Camelot wheel
 * 
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns Distance (0-6 for same letter, Infinity for different letters)
 */
export function getKeyDistance(key1: CamelotKey, key2: CamelotKey): number {
    const num1 = parseInt(key1.slice(0, -1));
    const num2 = parseInt(key2.slice(0, -1));
    const letter1 = key1.slice(-1);
    const letter2 = key2.slice(-1);

    // Different letters (A vs B) - not directly comparable
    if (letter1 !== letter2) {
        return Infinity;
    }

    // Calculate circular distance
    const diff = Math.abs(num1 - num2);
    return Math.min(diff, 12 - diff);
}

/**
 * All valid Camelot keys
 */
export const ALL_CAMELOT_KEYS: CamelotKey[] = [
    '1A', '1B', '2A', '2B', '3A', '3B',
    '4A', '4B', '5A', '5B', '6A', '6B',
    '7A', '7B', '8A', '8B', '9A', '9B',
    '10A', '10B', '11A', '11B', '12A', '12B'
];

/**
 * Validate if a string is a valid Camelot key
 * 
 * @param key - String to validate
 * @returns true if valid Camelot key
 */
export function isValidCamelotKey(key: string): key is CamelotKey {
    return ALL_CAMELOT_KEYS.includes(key as CamelotKey);
}
