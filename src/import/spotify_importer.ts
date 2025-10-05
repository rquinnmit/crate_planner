/**
 * Spotify Importer - Import track data from Spotify Web API
 * 
 * Imports comprehensive track metadata including:
 * - Basic metadata (artist, title, album, year, duration)
 * - Audio features (BPM, key, energy, danceability)
 * - Audio analysis (sections for phrase-aware mixing)
 * 
 * Requires Spotify Web API credentials (Client ID + Secret)
 * Documentation: https://developer.spotify.com/documentation/web-api
 */

import { Track, CamelotKey, TrackSection } from '../core/track';
import { MusicAssetCatalog } from '../core/catalog';
import { BaseImporter, APIConfig, ImportResult, ExternalTrackData } from './base_importer';
import { spotifyKeyToCamelot } from './spotify_key_converter';

/**
 * Spotify API configuration
 */
export interface SpotifyConfig extends APIConfig {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    tokenExpiresAt?: number;
}

/**
 * Spotify track object (from API)
 */
interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
        name: string;
        release_date: string;
        images?: Array<{ url: string }>;
    };
    duration_ms: number;
    external_ids?: {
        isrc?: string;
    };
    uri: string;
}

/**
 * Spotify audio features object
 */
interface SpotifyAudioFeatures {
    id: string;
    tempo: number;
    key: number;
    mode: number;
    energy: number;
    danceability: number;
    valence: number;
    loudness: number;
    time_signature: number;
}

/**
 * Spotify audio analysis section
 */
interface SpotifyAnalysisSection {
    start: number;
    duration: number;
    confidence: number;
    loudness: number;
    tempo: number;
    key: number;
    mode: number;
    time_signature: number;
}

/**
 * Spotify audio analysis object
 */
interface SpotifyAudioAnalysis {
    sections: SpotifyAnalysisSection[];
}

/**
 * Spotify search response
 */
interface SpotifySearchResponse {
    tracks: {
        items: SpotifyTrack[];
        total: number;
    };
}

/**
 * Spotify Importer - Main class
 */
export class SpotifyImporter extends BaseImporter {
    private spotifyConfig: SpotifyConfig;

    constructor(catalog: MusicAssetCatalog, config: SpotifyConfig) {
        super(catalog, {
            ...config,
            baseURL: 'https://api.spotify.com/v1',
            rateLimit: config.rateLimit || {
                requestsPerSecond: 10,
                requestsPerMinute: 180,
                retryAttempts: 3,
                retryDelayMs: 1000
            }
        });
        this.spotifyConfig = config;
    }

    /**
     * Search for tracks and import them
     * 
     * @param query - Search query (artist, track name, etc.)
     * @param limit - Maximum number of tracks to import (default: 20, max: 50)
     * @returns Import result
     */
    async searchAndImport(query: string, limit: number = 20): Promise<ImportResult> {
        await this.ensureValidToken();

        try {
            const searchLimit = Math.min(limit, 50);
            const response = await this.makeRequest<SpotifySearchResponse>(
                `/search?q=${encodeURIComponent(query)}&type=track&limit=${searchLimit}`
            );

            if (!response.tracks.items.length) {
                return {
                    success: true,
                    tracksImported: 0,
                    tracksFailed: 0,
                    errors: [],
                    warnings: ['No tracks found for query']
                };
            }

            // Enrich tracks with audio features and analysis
            const enrichedTracks = await this.enrichTracksWithFeatures(response.tracks.items);
            
            return await this.importTracks(enrichedTracks);
        } catch (error) {
            return {
                success: false,
                tracksImported: 0,
                tracksFailed: 0,
                errors: [(error as Error).message],
                warnings: []
            };
        }
    }

    /**
     * Import a single track by Spotify ID
     * 
     * @param spotifyId - Spotify track ID
     * @returns Import result
     */
    async importById(spotifyId: string): Promise<ImportResult> {
        await this.ensureValidToken();

        try {
            const track = await this.makeRequest<SpotifyTrack>(`/tracks/${spotifyId}`);
            const enrichedTracks = await this.enrichTracksWithFeatures([track]);
            
            return await this.importTracks(enrichedTracks);
        } catch (error) {
            return {
                success: false,
                tracksImported: 0,
                tracksFailed: 1,
                errors: [(error as Error).message],
                warnings: []
            };
        }
    }

    /**
     * Import multiple tracks by Spotify IDs (batch operation)
     * 
     * @param spotifyIds - Array of Spotify track IDs (max 50)
     * @returns Import result
     */
    async importByIds(spotifyIds: string[]): Promise<ImportResult> {
        await this.ensureValidToken();

        try {
            // Spotify allows up to 50 tracks per request
            const batches: string[][] = [];
            for (let i = 0; i < spotifyIds.length; i += 50) {
                batches.push(spotifyIds.slice(i, i + 50));
            }

            const allEnrichedTracks: ExternalTrackData[] = [];

            for (const batch of batches) {
                const ids = batch.join(',');
                const response = await this.makeRequest<{ tracks: SpotifyTrack[] }>(
                    `/tracks?ids=${ids}`
                );
                
                const enrichedTracks = await this.enrichTracksWithFeatures(response.tracks);
                allEnrichedTracks.push(...enrichedTracks);
            }

            return await this.importTracks(allEnrichedTracks);
        } catch (error) {
            return {
                success: false,
                tracksImported: 0,
                tracksFailed: spotifyIds.length,
                errors: [(error as Error).message],
                warnings: []
            };
        }
    }

    /**
     * Import tracks from a Spotify playlist
     * 
     * @param playlistId - Spotify playlist ID
     * @param limit - Maximum number of tracks to import (default: all)
     * @returns Import result
     */
    async importFromPlaylist(playlistId: string, limit?: number): Promise<ImportResult> {
        await this.ensureValidToken();

        try {
            const allTracks: SpotifyTrack[] = [];
            let offset = 0;
            const batchSize = 100;

            while (true) {
                const response = await this.makeRequest<{
                    items: Array<{ track: SpotifyTrack }>;
                    total: number;
                    next: string | null;
                }>(`/playlists/${playlistId}/tracks?offset=${offset}&limit=${batchSize}`);

                const tracks = response.items
                    .map(item => item.track)
                    .filter(track => track && track.id); // Filter out null tracks

                allTracks.push(...tracks);

                if (!response.next || (limit && allTracks.length >= limit)) {
                    break;
                }

                offset += batchSize;
            }

            const tracksToImport = limit ? allTracks.slice(0, limit) : allTracks;
            const enrichedTracks = await this.enrichTracksWithFeatures(tracksToImport);
            
            return await this.importTracks(enrichedTracks);
        } catch (error) {
            return {
                success: false,
                tracksImported: 0,
                tracksFailed: 0,
                errors: [(error as Error).message],
                warnings: []
            };
        }
    }

    /**
     * Enrich tracks with audio features and analysis
     * Fetches BPM, key, energy, and sections data
     */
    private async enrichTracksWithFeatures(tracks: SpotifyTrack[]): Promise<ExternalTrackData[]> {
        if (!tracks.length) return [];

        // Batch fetch audio features (up to 100 tracks)
        const trackIds = tracks.map(t => t.id);
        const audioFeatures = await this.getAudioFeatures(trackIds);

        // Map features to tracks
        const enrichedTracks: ExternalTrackData[] = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const features = audioFeatures[i];

            if (!features) {
                enrichedTracks.push({
                    id: track.id,
                    artist: track.artists[0]?.name || 'Unknown Artist',
                    title: track.name,
                    spotifyTrack: track
                });
                continue;
            }

            // Optionally fetch audio analysis for sections (can be expensive)
            // For now, we'll skip this and only fetch on-demand
            const enriched: ExternalTrackData = {
                id: track.id,
                artist: track.artists[0]?.name || 'Unknown Artist',
                title: track.name,
                spotifyTrack: track,
                audioFeatures: features
            };

            enrichedTracks.push(enriched);
        }

        return enrichedTracks;
    }

    /**
     * Get audio features for multiple tracks (batch)
     * 
     * @param trackIds - Array of Spotify track IDs (max 100)
     * @returns Array of audio features (null for tracks without features)
     */
    private async getAudioFeatures(trackIds: string[]): Promise<(SpotifyAudioFeatures | null)[]> {
        const batches: string[][] = [];
        for (let i = 0; i < trackIds.length; i += 100) {
            batches.push(trackIds.slice(i, i + 100));
        }

        const allFeatures: (SpotifyAudioFeatures | null)[] = [];

        for (const batch of batches) {
            const ids = batch.join(',');
            const response = await this.makeRequest<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
                `/audio-features?ids=${ids}`
            );
            allFeatures.push(...response.audio_features);
        }

        return allFeatures;
    }

    /**
     * Get audio analysis for a single track (includes sections)
     * This is a separate endpoint and can be expensive - use sparingly
     * 
     * @param trackId - Spotify track ID
     * @returns Audio analysis with sections
     */
    async getAudioAnalysis(trackId: string): Promise<SpotifyAudioAnalysis | null> {
        await this.ensureValidToken();

        try {
            return await this.makeRequest<SpotifyAudioAnalysis>(`/audio-analysis/${trackId}`);
        } catch (error) {
            console.warn(`Failed to get audio analysis for ${trackId}:`, (error as Error).message);
            return null;
        }
    }

    /**
     * Normalize Spotify data to CratePilot Track format
     */
    protected normalizeTrack(externalData: ExternalTrackData): Track | null {
        const spotifyTrack = externalData.spotifyTrack as SpotifyTrack;
        const audioFeatures = externalData.audioFeatures as SpotifyAudioFeatures | undefined;

        if (!spotifyTrack || !audioFeatures) {
            return null;
        }

        // Convert Spotify key + mode to Camelot
        const camelotKey = spotifyKeyToCamelot(audioFeatures.key, audioFeatures.mode);
        if (!camelotKey) {
            return null; // Skip tracks without valid key
        }

        // Map energy (0-1) to our 1-5 scale
        const energy = Math.ceil(audioFeatures.energy * 5) as 1 | 2 | 3 | 4 | 5;

        // Extract year from release date
        const year = spotifyTrack.album.release_date 
            ? parseInt(spotifyTrack.album.release_date.split('-')[0]) 
            : undefined;

        // Get all artists
        const artist = spotifyTrack.artists.map(a => a.name).join(', ');

        const track: Track = {
            id: this.generateTrackId(spotifyTrack.id, 'spotify'),
            artist,
            title: spotifyTrack.name,
            genre: undefined, // Spotify doesn't provide genre at track level
            duration_sec: Math.round(spotifyTrack.duration_ms / 1000),
            bpm: Math.round(audioFeatures.tempo),
            key: camelotKey,
            energy,
            album: spotifyTrack.album.name,
            year,
            registeredAt: new Date(),
            updatedAt: new Date()
        };

        // Add sections if available (from audio analysis)
        if (externalData.audioAnalysis) {
            const analysis = externalData.audioAnalysis as SpotifyAudioAnalysis;
            track.sections = this.mapSpotifySections(analysis.sections);
        }

        return track;
    }

    /**
     * Map Spotify analysis sections to TrackSection format
     * Attempts to classify sections based on audio characteristics
     */
    private mapSpotifySections(spotifySections: SpotifyAnalysisSection[]): TrackSection[] {
        return spotifySections.map((section, index) => {
            const startTime = section.start;
            const endTime = section.start + section.duration;

            // Simple heuristic classification based on position and characteristics
            let type: TrackSection['type'] = 'verse';

            if (index === 0) {
                type = 'intro';
            } else if (index === spotifySections.length - 1) {
                type = 'outro';
            } else if (section.loudness > -5) {
                // Louder sections might be drops or choruses
                type = section.tempo > 120 ? 'drop' : 'chorus';
            } else if (section.loudness < -10) {
                // Quieter sections might be breakdowns
                type = 'breakdown';
            }

            return {
                type,
                startTime,
                endTime
            };
        });
    }

    /**
     * Get authentication headers with Bearer token
     */
    protected getAuthHeaders(): Record<string, string> {
        if (this.spotifyConfig.accessToken) {
            return {
                'Authorization': `Bearer ${this.spotifyConfig.accessToken}`
            };
        }
        return {};
    }

    /**
     * Ensure we have a valid access token
     * Automatically refreshes if expired
     */
    private async ensureValidToken(): Promise<void> {
        const now = Date.now();
        
        // Check if token exists and is not expired (with 5 min buffer)
        if (this.spotifyConfig.accessToken && 
            this.spotifyConfig.tokenExpiresAt && 
            this.spotifyConfig.tokenExpiresAt > now + 300000) {
            return;
        }

        // Request new token using Client Credentials flow
        await this.refreshAccessToken();
    }

    /**
     * Refresh access token using Client Credentials flow
     * This flow is suitable for server-to-server requests
     */
    private async refreshAccessToken(): Promise<void> {
        const credentials = Buffer.from(
            `${this.spotifyConfig.clientId}:${this.spotifyConfig.clientSecret}`
        ).toString('base64');

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`Failed to get Spotify access token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
            access_token: string;
            token_type: string;
            expires_in: number;
        };

        this.spotifyConfig.accessToken = data.access_token;
        this.spotifyConfig.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    }

    /**
     * Get the current access token (useful for debugging)
     */
    getAccessToken(): string | undefined {
        return this.spotifyConfig.accessToken;
    }
}

/**
 * Quick import function for convenience
 * 
 * @param catalog - Music catalog
 * @param clientId - Spotify Client ID
 * @param clientSecret - Spotify Client Secret
 * @param query - Search query
 * @param limit - Maximum tracks to import
 * @returns Import result
 */
export async function importFromSpotify(
    catalog: MusicAssetCatalog,
    clientId: string,
    clientSecret: string,
    query: string,
    limit: number = 20
): Promise<ImportResult> {
    const importer = new SpotifyImporter(catalog, {
        clientId,
        clientSecret,
        baseURL: 'https://api.spotify.com/v1'
    });

    return importer.searchAndImport(query, limit);
}
