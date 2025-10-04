/**
 * Crate Prompting Formatters
 * 
 * Helper functions for formatting data to be included in LLM prompts.
 */

import { Track } from '../core/track';
import { formatDurationLong, formatBPMRange as formatBPM } from '../utils/time_formatters';

/**
 * Format seed tracks for prompt inclusion
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
 */
export function formatTrackList(tracks: Track[], options: { withDuration?: boolean } = {}): string {
    if (tracks.length === 0) {
        return 'No tracks available';
    }
    
    return tracks
        .map(track => {
            let info = `${track.id}: ${track.artist} - ${track.title} (${track.bpm} BPM, ${track.key}`;
            if (options.withDuration) {
                info += `, ${track.duration_sec}s`;
            }
            info += `, Energy: ${track.energy || 'N/A'})`;
            return info;
        })
        .join('\n');
}

/**
 * Format seed track IDs with basic info for sequencing prompt
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
 */
export function formatDuration(seconds: number): string {
    return formatDurationLong(seconds);
}

/**
 * Format BPM range for display
 * Re-exported from time_formatters for convenience
 */
export function formatBPMRange(min: number, max: number): string {
    return formatBPM(min, max);
}

/**
 * Format key list for display
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
