/**
 * Spotify Key Converter - Convert Spotify key/mode to Camelot notation
 * 
 * Spotify represents keys as:
 * - key: Integer (0-11) representing pitch class (0=C, 1=C#/Db, 2=D, etc.)
 * - mode: Integer (0=minor, 1=major)
 * 
 * This module converts to Camelot notation used by DJs for harmonic mixing.
 */

import { CamelotKey } from '../core/track';

/**
 * Mapping of Spotify key number to Camelot notation
 * Format: [pitch_class][mode] -> Camelot
 * 
 * Pitch classes (Spotify key values):
 * 0 = C, 1 = C#/Db, 2 = D, 3 = D#/Eb, 4 = E, 5 = F,
 * 6 = F#/Gb, 7 = G, 8 = G#/Ab, 9 = A, 10 = A#/Bb, 11 = B
 * 
 * Mode: 0 = minor (A), 1 = major (B)
 */
const SPOTIFY_KEY_TO_CAMELOT: Record<string, CamelotKey> = {
    // Minor keys (mode = 0, Camelot A notation)
    '0-0': '5A',   // C minor
    '1-0': '12A',  // C# minor / Db minor
    '2-0': '7A',   // D minor
    '3-0': '2A',   // D# minor / Eb minor
    '4-0': '9A',   // E minor
    '5-0': '4A',   // F minor
    '6-0': '11A',  // F# minor / Gb minor
    '7-0': '6A',   // G minor
    '8-0': '1A',   // G# minor / Ab minor
    '9-0': '8A',   // A minor
    '10-0': '3A',  // A# minor / Bb minor
    '11-0': '10A', // B minor

    // Major keys (mode = 1, Camelot B notation)
    '0-1': '8B',   // C major
    '1-1': '3B',   // C# major / Db major
    '2-1': '10B',  // D major
    '3-1': '5B',   // D# major / Eb major
    '4-1': '12B',  // E major
    '5-1': '7B',   // F major
    '6-1': '2B',   // F# major / Gb major
    '7-1': '9B',   // G major
    '8-1': '4B',   // G# major / Ab major
    '9-1': '11B',  // A major
    '10-1': '6B',  // A# major / Bb major
    '11-1': '1B'   // B major
};

/**
 * Convert Spotify key and mode to Camelot notation
 * 
 * @param key - Spotify key (0-11, or -1 for no key detected)
 * @param mode - Spotify mode (0=minor, 1=major)
 * @returns Camelot key or null if invalid
 * 
 * @example
 * spotifyKeyToCamelot(0, 1) // Returns '8B' (C major)
 * spotifyKeyToCamelot(9, 0) // Returns '8A' (A minor)
 * spotifyKeyToCamelot(-1, 0) // Returns null (no key detected)
 */
export function spotifyKeyToCamelot(key: number, mode: number): CamelotKey | null {
    // Spotify returns -1 when no key is detected
    if (key < 0 || key > 11) {
        return null;
    }

    // Mode should be 0 or 1
    if (mode !== 0 && mode !== 1) {
        return null;
    }

    const lookupKey = `${key}-${mode}`;
    return SPOTIFY_KEY_TO_CAMELOT[lookupKey] || null;
}

/**
 * Convert Camelot key back to Spotify key and mode
 * Useful for reverse lookups or validation
 * 
 * @param camelotKey - Camelot key (e.g., '8B', '5A')
 * @returns Object with key and mode, or null if invalid
 * 
 * @example
 * camelotToSpotifyKey('8B') // Returns { key: 0, mode: 1 } (C major)
 * camelotToSpotifyKey('8A') // Returns { key: 9, mode: 0 } (A minor)
 */
export function camelotToSpotifyKey(camelotKey: CamelotKey): { key: number; mode: number } | null {
    // Reverse lookup
    for (const [spotifyKey, camelot] of Object.entries(SPOTIFY_KEY_TO_CAMELOT)) {
        if (camelot === camelotKey) {
            const [key, mode] = spotifyKey.split('-').map(Number);
            return { key, mode };
        }
    }
    return null;
}

/**
 * Get the standard music notation for a Spotify key
 * 
 * @param key - Spotify key (0-11)
 * @param mode - Spotify mode (0=minor, 1=major)
 * @returns Standard notation (e.g., "C major", "A minor")
 */
export function spotifyKeyToStandard(key: number, mode: number): string | null {
    if (key < 0 || key > 11) {
        return null;
    }

    const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pitchClass = pitchClasses[key];
    const modeName = mode === 1 ? 'major' : 'minor';

    return `${pitchClass} ${modeName}`;
}

/**
 * Validate Spotify key and mode values
 * 
 * @param key - Spotify key
 * @param mode - Spotify mode
 * @returns True if valid
 */
export function isValidSpotifyKey(key: number, mode: number): boolean {
    return key >= 0 && key <= 11 && (mode === 0 || mode === 1);
}

/**
 * Get all compatible keys for harmonic mixing (Camelot wheel)
 * Returns keys that are harmonically compatible with the given Spotify key
 * 
 * @param key - Spotify key (0-11)
 * @param mode - Spotify mode (0=minor, 1=major)
 * @returns Array of compatible Camelot keys
 */
export function getCompatibleKeys(key: number, mode: number): CamelotKey[] {
    const camelotKey = spotifyKeyToCamelot(key, mode);
    if (!camelotKey) return [];

    // Extract number and letter from Camelot key
    const match = camelotKey.match(/^(\d+)([AB])$/);
    if (!match) return [];

    const num = parseInt(match[1]);
    const letter = match[2];

    const compatible: CamelotKey[] = [camelotKey]; // Same key

    // Adjacent keys on the wheel (+1, -1)
    const nextNum = num === 12 ? 1 : num + 1;
    const prevNum = num === 1 ? 12 : num - 1;
    compatible.push(`${nextNum}${letter}` as CamelotKey);
    compatible.push(`${prevNum}${letter}` as CamelotKey);

    // Relative major/minor (same number, opposite letter)
    const oppositeLetter = letter === 'A' ? 'B' : 'A';
    compatible.push(`${num}${oppositeLetter}` as CamelotKey);

    return compatible;
}
