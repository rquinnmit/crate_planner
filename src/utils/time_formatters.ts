/**
 * Time Formatting Utilities
 * 
 * Centralized time and duration formatting functions for consistent
 * display across the CratePilot application.
 */

/**
 * Format duration in seconds to MM:SS format
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "3:45", "12:03")
 * 
 * @example
 * formatMMSS(225) // Returns: "3:45"
 * formatMMSS(723) // Returns: "12:03"
 */
export function formatMMSS(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human-readable format
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "90 minutes", "1 hour 30 minutes")
 * 
 * @example
 * formatDurationLong(5400) // Returns: "90 minutes"
 * formatDurationLong(5460) // Returns: "1 hour 31 minutes"
 */
export function formatDurationLong(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
        return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
}

/**
 * Format duration in seconds to compact format (e.g., "1h 30m")
 * 
 * @param seconds - Duration in seconds
 * @returns Compact formatted string
 * 
 * @example
 * formatDurationCompact(5400) // Returns: "1h 30m"
 * formatDurationCompact(300) // Returns: "5m"
 */
export function formatDurationCompact(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
        return `${minutes}m`;
    } else if (remainingMinutes === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${remainingMinutes}m`;
    }
}

/**
 * Format duration in minutes (for display in UI)
 * 
 * @param seconds - Duration in seconds
 * @returns Duration in minutes as string
 * 
 * @example
 * formatMinutes(5400) // Returns: "90 min"
 * formatMinutes(300) // Returns: "5 min"
 */
export function formatMinutes(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
}

/**
 * Parse MM:SS format to seconds
 * 
 * @param mmss - Time string in MM:SS format
 * @returns Duration in seconds
 * 
 * @example
 * parseMMSS("3:45") // Returns: 225
 * parseMMSS("12:03") // Returns: 723
 */
export function parseMMSS(mmss: string): number {
    const parts = mmss.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid MM:SS format');
    }
    
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    if (isNaN(minutes) || isNaN(seconds)) {
        throw new Error('Invalid MM:SS format');
    }
    
    return minutes * 60 + seconds;
}

/**
 * Format time range (e.g., for set duration)
 * 
 * @param startSeconds - Start time in seconds
 * @param endSeconds - End time in seconds
 * @returns Formatted time range
 * 
 * @example
 * formatTimeRange(0, 3600) // Returns: "0:00 - 1:00:00"
 */
export function formatTimeRange(startSeconds: number, endSeconds: number): string {
    return `${formatMMSS(startSeconds)} - ${formatMMSS(endSeconds)}`;
}

/**
 * Format duration with tolerance (for validation messages)
 * 
 * @param targetSeconds - Target duration
 * @param toleranceSeconds - Tolerance in seconds
 * @returns Formatted string with tolerance
 * 
 * @example
 * formatDurationWithTolerance(3600, 300) // Returns: "60 min ± 5 min"
 */
export function formatDurationWithTolerance(targetSeconds: number, toleranceSeconds: number): string {
    const targetMin = Math.floor(targetSeconds / 60);
    const toleranceMin = Math.floor(toleranceSeconds / 60);
    return `${targetMin} min ± ${toleranceMin} min`;
}

/**
 * Calculate and format the difference between two durations
 * 
 * @param actual - Actual duration in seconds
 * @param target - Target duration in seconds
 * @returns Formatted difference (e.g., "+5 min", "-3 min")
 */
export function formatDurationDifference(actual: number, target: number): string {
    const diff = actual - target;
    const diffMin = Math.floor(Math.abs(diff) / 60);
    const sign = diff >= 0 ? '+' : '-';
    return `${sign}${diffMin} min`;
}

/**
 * Format BPM range for display
 * 
 * @param min - Minimum BPM
 * @param max - Maximum BPM
 * @returns Formatted BPM range string
 * 
 * @example
 * formatBPMRange(120, 130) // Returns: "120-130 BPM"
 * formatBPMRange(128, 128) // Returns: "128 BPM"
 */
export function formatBPMRange(min: number, max: number): string {
    if (min === max) {
        return `${min} BPM`;
    }
    return `${min}-${max} BPM`;
}

/**
 * Format track position in a set (e.g., "Track 5 of 20")
 * 
 * @param current - Current track number (1-based)
 * @param total - Total number of tracks
 * @returns Formatted position string
 */
export function formatTrackPosition(current: number, total: number): string {
    return `Track ${current} of ${total}`;
}

/**
 * Format percentage (e.g., for progress)
 * 
 * @param value - Current value
 * @param total - Total value
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    const percentage = Math.round((value / total) * 100);
    return `${percentage}%`;
}
