/**
 * Track - Music Track Model
 * 
 * Represents a single track in the DJ's music library with all metadata
 * and features needed for crate planning.
 */

/**
 * Camelot Key notation for harmonic mixing
 * Format: Number (1-12) + Letter (A for minor, B for major)
 */
export type CamelotKey = 
    | '1A' | '1B' | '2A' | '2B' | '3A' | '3B' 
    | '4A' | '4B' | '5A' | '5B' | '6A' | '6B'
    | '7A' | '7B' | '8A' | '8B' | '9A' | '9B'
    | '10A' | '10B' | '11A' | '11B' | '12A' | '12B';

/**
 * Track section types for phrase-aware mixing
 */
export interface TrackSection {
    type: 'intro' | 'verse' | 'chorus' | 'breakdown' | 'buildup' | 'drop' | 'outro';
    startTime: number; // in seconds
    endTime: number;   // in seconds
}

/**
 * Complete track representation
 */
export interface Track {
    // Unique identifier
    id: string;
    
    // Tags (basic metadata)
    artist: string;
    title: string;
    genre?: string;
    duration_sec: number;
    
    // Features (analysis data)
    bpm: number;
    key: CamelotKey;
    energy?: 1 | 2 | 3 | 4 | 5; // Energy level (1=low, 5=high)
    sections?: TrackSection[];
    
    // Optional metadata
    filePath?: string;
    album?: string;
    year?: number;
    label?: string;
    
    // Timestamps
    registeredAt?: Date;
    updatedAt?: Date;
}

/**
 * Filter criteria for searching tracks
 */
export interface TrackFilter {
    genre?: string;
    bpmRange?: { min: number; max: number };
    key?: CamelotKey;
    keys?: CamelotKey[]; // Multiple keys
    energyRange?: { min: number; max: number };
    durationRange?: { min: number; max: number }; // in seconds
    artist?: string;
    artists?: string[]; // Multiple artists
    excludeArtists?: string[];
    ids?: string[]; // Specific track IDs
}
