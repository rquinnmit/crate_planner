/**
 * MusicAssetCatalog - DJ Music Library Management
 * 
 * Implements the MusicAssetCatalog concept from spec/MusicAssetCatalog.spec
 * Normalizes and preserves track metadata and analysis features for a DJ's library.
 */

import { Track, CamelotKey, TrackFilter } from './track';
import { getCompatibleKeys } from '../utils/camelot';

/**
 * MusicAssetCatalog class - manages the DJ's music library
 */
export class MusicAssetCatalog {
    private tracks: Map<string, Track> = new Map();

    /**
     * Add a track to the catalog (register)
     * 
     * @param track - Track object with all metadata
     * @returns The registered track with timestamps
     */
    addTrack(track: Track): Track {
        // Add registration timestamp if not present
        const now = new Date();
        const registeredTrack: Track = {
            ...track,
            registeredAt: track.registeredAt || now,
            updatedAt: now
        };

        this.tracks.set(track.id, registeredTrack);
        return registeredTrack;
    }

    /**
     * Remove a track from the catalog (unregister)
     * 
     * @param id - Track ID to remove
     * @returns true if track was removed, false if not found
     */
    removeTrack(id: string): boolean {
        return this.tracks.delete(id);
    }

    /**
     * Get a single track by ID (getAttributes)
     * 
     * @param id - Track ID
     * @returns Track object or undefined if not found
     */
    getTrack(id: string): Track | undefined {
        return this.tracks.get(id);
    }

    /**
     * Get multiple tracks by IDs
     * 
     * @param ids - Array of track IDs
     * @returns Array of tracks (skips IDs not found)
     */
    getTracks(ids: string[]): Track[] {
        return ids
            .map(id => this.tracks.get(id))
            .filter((track): track is Track => track !== undefined);
    }

    /**
     * Get all tracks in the catalog
     * 
     * @returns Array of all tracks
     */
    getAllTracks(): Track[] {
        return Array.from(this.tracks.values());
    }

    /**
     * Search tracks with filters (listCandidates)
     * 
     * @param filter - Filter criteria
     * @returns Array of tracks matching the filter
     */
    searchTracks(filter: TrackFilter = {}): Track[] {
        let results = Array.from(this.tracks.values());

        // Filter by specific IDs
        if (filter.ids && filter.ids.length > 0) {
            const idSet = new Set(filter.ids);
            results = results.filter(track => idSet.has(track.id));
        }

        // Filter by genre
        if (filter.genre) {
            results = results.filter(track => 
                track.genre?.toLowerCase() === filter.genre?.toLowerCase()
            );
        }

        // Filter by BPM range
        if (filter.bpmRange) {
            results = results.filter(track => 
                track.bpm >= filter.bpmRange!.min && 
                track.bpm <= filter.bpmRange!.max
            );
        }

        // Filter by single key
        if (filter.key) {
            results = results.filter(track => track.key === filter.key);
        }

        // Filter by multiple keys
        if (filter.keys && filter.keys.length > 0) {
            const keySet = new Set(filter.keys);
            results = results.filter(track => keySet.has(track.key));
        }

        // Filter by energy range
        if (filter.energyRange) {
            results = results.filter(track => {
                if (!track.energy) return false;
                return track.energy >= filter.energyRange!.min && 
                       track.energy <= filter.energyRange!.max;
            });
        }

        // Filter by duration range
        if (filter.durationRange) {
            results = results.filter(track => 
                track.duration_sec >= filter.durationRange!.min && 
                track.duration_sec <= filter.durationRange!.max
            );
        }

        // Filter by single artist
        if (filter.artist) {
            results = results.filter(track => 
                track.artist.toLowerCase() === filter.artist?.toLowerCase()
            );
        }

        // Filter by multiple artists
        if (filter.artists && filter.artists.length > 0) {
            const artistSet = new Set(
                filter.artists.map(a => a.toLowerCase())
            );
            results = results.filter(track => 
                artistSet.has(track.artist.toLowerCase())
            );
        }

        // Exclude specific artists
        if (filter.excludeArtists && filter.excludeArtists.length > 0) {
            const excludeSet = new Set(
                filter.excludeArtists.map(a => a.toLowerCase())
            );
            results = results.filter(track => 
                !excludeSet.has(track.artist.toLowerCase())
            );
        }

        return results;
    }

    /**
     * Update an existing track's metadata
     * 
     * @param id - Track ID
     * @param updates - Partial track object with fields to update
     * @returns Updated track or undefined if not found
     */
    updateTrack(id: string, updates: Partial<Track>): Track | undefined {
        const track = this.tracks.get(id);
        if (!track) return undefined;

        const updatedTrack: Track = {
            ...track,
            ...updates,
            id: track.id, // Ensure ID doesn't change
            registeredAt: track.registeredAt, // Preserve registration time
            updatedAt: new Date()
        };

        this.tracks.set(id, updatedTrack);
        return updatedTrack;
    }

    /**
     * Check if a track exists in the catalog
     * 
     * @param id - Track ID
     * @returns true if track exists
     */
    hasTrack(id: string): boolean {
        return this.tracks.has(id);
    }

    /**
     * Get the total number of tracks in the catalog
     * 
     * @returns Number of tracks
     */
    getTrackCount(): number {
        return this.tracks.size;
    }

    /**
     * Get tracks by genre
     * 
     * @param genre - Genre name
     * @returns Array of tracks in that genre
     */
    getTracksByGenre(genre: string): Track[] {
        return this.searchTracks({ genre });
    }

    /**
     * Get tracks by artist
     * 
     * @param artist - Artist name
     * @returns Array of tracks by that artist
     */
    getTracksByArtist(artist: string): Track[] {
        return this.searchTracks({ artist });
    }

    /**
     * Get tracks in a BPM range
     * 
     * @param min - Minimum BPM
     * @param max - Maximum BPM
     * @returns Array of tracks in that BPM range
     */
    getTracksByBPMRange(min: number, max: number): Track[] {
        return this.searchTracks({ bpmRange: { min, max } });
    }

    /**
     * Get tracks with a specific key
     * 
     * @param key - Camelot key
     * @returns Array of tracks in that key
     */
    getTracksByKey(key: CamelotKey): Track[] {
        return this.searchTracks({ key });
    }

    /**
     * Get compatible keys for harmonic mixing
     * Based on Camelot wheel: same key, adjacent keys (+/-1), and relative key (A↔B)
     * 
     * @param key - Starting Camelot key
     * @returns Array of compatible keys
     */
    getCompatibleKeys(key: CamelotKey): CamelotKey[] {
        return getCompatibleKeys(key);
    }

    /**
     * Get tracks with keys compatible with the given key
     * 
     * @param key - Starting Camelot key
     * @returns Array of tracks with compatible keys
     */
    getTracksWithCompatibleKeys(key: CamelotKey): Track[] {
        const compatibleKeys = this.getCompatibleKeys(key);
        return this.searchTracks({ keys: compatibleKeys });
    }

    /**
     * Get catalog statistics
     * 
     * @returns Object with catalog statistics
     */
    getStatistics(): {
        totalTracks: number;
        genres: Map<string, number>;
        bpmRange: { min: number; max: number };
        averageBPM: number;
        averageDuration: number;
        keyDistribution: Map<CamelotKey, number>;
    } {
        const tracks = Array.from(this.tracks.values());
        
        if (tracks.length === 0) {
            return {
                totalTracks: 0,
                genres: new Map(),
                bpmRange: { min: 0, max: 0 },
                averageBPM: 0,
                averageDuration: 0,
                keyDistribution: new Map()
            };
        }

        // Genre distribution
        const genres = new Map<string, number>();
        tracks.forEach(track => {
            if (track.genre) {
                genres.set(track.genre, (genres.get(track.genre) || 0) + 1);
            }
        });

        // BPM statistics
        const bpms = tracks.map(t => t.bpm);
        const minBPM = Math.min(...bpms);
        const maxBPM = Math.max(...bpms);
        const avgBPM = bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length;

        // Duration statistics
        const durations = tracks.map(t => t.duration_sec);
        const avgDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;

        // Key distribution
        const keyDistribution = new Map<CamelotKey, number>();
        tracks.forEach(track => {
            keyDistribution.set(track.key, (keyDistribution.get(track.key) || 0) + 1);
        });

        return {
            totalTracks: tracks.length,
            genres,
            bpmRange: { min: minBPM, max: maxBPM },
            averageBPM: Math.round(avgBPM * 10) / 10,
            averageDuration: Math.round(avgDuration),
            keyDistribution
        };
    }

    /**
     * Clear all tracks from the catalog
     */
    clear(): void {
        this.tracks.clear();
    }

    /**
     * Import tracks in bulk
     * 
     * @param tracks - Array of tracks to import
     * @returns Number of tracks imported
     */
    importTracks(tracks: Track[]): number {
        tracks.forEach(track => this.addTrack(track));
        return tracks.length;
    }

    /**
     * Export all tracks as JSON
     * 
     * @returns JSON string of all tracks
     */
    exportToJSON(): string {
        const tracks = Array.from(this.tracks.values());
        return JSON.stringify(tracks, null, 2);
    }

    /**
     * Import tracks from JSON
     * 
     * @param json - JSON string of tracks
     * @returns Number of tracks imported
     */
    importFromJSON(json: string): number {
        try {
            const tracks = JSON.parse(json) as Track[];
            return this.importTracks(tracks);
        } catch (error) {
            throw new Error(`Failed to import tracks from JSON: ${(error as Error).message}`);
        }
    }
}
