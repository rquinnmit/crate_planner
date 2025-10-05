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
 * Spotify artist object (simplified)
 */
interface SpotifyArtist {
    id: string;
    name: string;
    uri: string;
}

/**
 * Spotify artist search response
 */
interface SpotifyArtistSearchResponse {
    artists: {
        items: SpotifyArtist[];
        total: number;
    };
}

/**
 * Spotify recommendations parameters
 */
export interface RecommendationsParams {
    seed_artists?: string[];  // Up to 5 artist IDs
    seed_tracks?: string[];   // Up to 5 track IDs
    seed_genres?: string[];   // Up to 5 genre seeds
    limit?: number;           // Max 100
    market?: string;
    min_tempo?: number;
    max_tempo?: number;
    target_tempo?: number;
    min_energy?: number;
    max_energy?: number;
    target_energy?: number;
    min_popularity?: number;
    max_popularity?: number;
    target_key?: number;      // 0-11
    target_mode?: number;     // 0=minor, 1=major
}

/**
 * Spotify recommendations response
 */
interface SpotifyRecommendationsResponse {
    tracks: SpotifyTrack[];
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
        let tracksWithoutFeatures = 0;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const features = audioFeatures[i];

            if (!features) {
                tracksWithoutFeatures++;
                // Still include the track, normalizeTrack will use fallback values
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

        if (tracksWithoutFeatures > 0) {
            console.log(`   ℹ️  ${tracksWithoutFeatures} track(s) missing audio features (will use fallback values)`);
        }

        return enrichedTracks;
    }

    /**
     * Get audio features for multiple tracks (batch)
     * Falls back to nulls if endpoint is unavailable (403/404 with Client Credentials)
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
            try {
                const response = await this.makeRequest<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
                    `/audio-features?ids=${ids}`
                );
                allFeatures.push(...response.audio_features);
            } catch (error) {
                // Audio features endpoint may be unavailable with Client Credentials flow
                const errorMsg = (error as Error).message;
                if (errorMsg.includes('403') || errorMsg.includes('404')) {
                    console.warn(`   ⚠️  Audio features unavailable (using fallbacks for ${batch.length} tracks)`);
                    // Return nulls for all tracks in this batch
                    allFeatures.push(...batch.map(() => null));
                } else {
                    throw error;
                }
            }
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

        if (!spotifyTrack) {
            return null;
        }

        // If no audio features, use fallback values
        let camelotKey: CamelotKey;
        let bpm: number;
        let energy: 1 | 2 | 3 | 4 | 5;

        if (audioFeatures) {
            // Convert Spotify key + mode to Camelot
            const convertedKey = spotifyKeyToCamelot(audioFeatures.key, audioFeatures.mode);
            if (!convertedKey) {
                // Use a default key if conversion fails
                camelotKey = '8A' as CamelotKey;
            } else {
                camelotKey = convertedKey;
            }

            bpm = Math.round(audioFeatures.tempo);
            energy = Math.ceil(audioFeatures.energy * 5) as 1 | 2 | 3 | 4 | 5;
        } else {
            // Fallback values when audio features are missing
            camelotKey = '8A' as CamelotKey; // Neutral key
            bpm = 120; // Average dance music tempo
            energy = 3; // Medium energy
        }

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
            bpm,
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
     * Get recommendations from Spotify based on seeds and tunables
     * 
     * @param params - Recommendations parameters (seeds, constraints)
     * @returns Import result with recommended tracks
     */
    async getRecommendations(params: RecommendationsParams): Promise<ImportResult> {
        await this.ensureValidToken();

        try {
            // Validate seeds (max 5 total)
            const totalSeeds = (params.seed_artists?.length || 0) + 
                             (params.seed_tracks?.length || 0) + 
                             (params.seed_genres?.length || 0);
            
            if (totalSeeds === 0) {
                return {
                    success: false,
                    tracksImported: 0,
                    tracksFailed: 0,
                    errors: ['At least one seed (artist, track, or genre) is required'],
                    warnings: []
                };
            }
            
            if (totalSeeds > 5) {
                console.warn(`⚠️ Total seeds (${totalSeeds}) exceeds 5, Spotify will use first 5`);
            }

            // Build query parameters
            const queryParams = new URLSearchParams();
            
            if (params.seed_artists) queryParams.append('seed_artists', params.seed_artists.join(','));
            if (params.seed_tracks) queryParams.append('seed_tracks', params.seed_tracks.join(','));
            if (params.seed_genres) queryParams.append('seed_genres', params.seed_genres.join(','));
            if (params.limit) queryParams.append('limit', params.limit.toString());
            if (params.market) queryParams.append('market', params.market);
            if (params.min_tempo) queryParams.append('min_tempo', params.min_tempo.toString());
            if (params.max_tempo) queryParams.append('max_tempo', params.max_tempo.toString());
            if (params.target_tempo) queryParams.append('target_tempo', params.target_tempo.toString());
            if (params.min_energy !== undefined) queryParams.append('min_energy', params.min_energy.toString());
            if (params.max_energy !== undefined) queryParams.append('max_energy', params.max_energy.toString());
            if (params.target_energy !== undefined) queryParams.append('target_energy', params.target_energy.toString());
            if (params.min_popularity) queryParams.append('min_popularity', params.min_popularity.toString());
            if (params.max_popularity) queryParams.append('max_popularity', params.max_popularity.toString());
            if (params.target_key !== undefined) queryParams.append('target_key', params.target_key.toString());
            if (params.target_mode !== undefined) queryParams.append('target_mode', params.target_mode.toString());

            const response = await this.makeRequest<SpotifyRecommendationsResponse>(
                `/recommendations?${queryParams.toString()}`
            );

            const enrichedTracks = await this.enrichTracksWithFeatures(response.tracks);
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
     * Get available genre seeds for recommendations
     * Falls back to common genre list if API endpoint is unavailable
     * 
     * @returns Array of available genre strings
     */
    async getAvailableGenreSeeds(): Promise<string[]> {
        await this.ensureValidToken();

        try {
            const response = await this.makeRequest<{ genres: string[] }>(
                '/recommendations/available-genre-seeds'
            );
            return response.genres;
        } catch (error) {
            console.warn('⚠️  Genre seeds endpoint unavailable, using fallback list');
            // Return common dance music genres as fallback
            return this.getFallbackGenreSeeds();
        }
    }

    /**
     * Fallback genre seeds list (common dance/electronic genres)
     * Used when the Spotify API endpoint is unavailable
     */
    private getFallbackGenreSeeds(): string[] {
        return [
            'house', 'tech-house', 'deep-house', 'progressive-house', 'electro-house',
            'techno', 'minimal-techno', 'detroit-techno',
            'trance', 'progressive-trance', 'psytrance',
            'drum-and-bass', 'dubstep', 'trap', 'bass',
            'ambient', 'downtempo', 'chill',
            'disco', 'funk', 'soul',
            'indie', 'indie-pop', 'alternative',
            'electronic', 'edm', 'dance',
            'hip-hop', 'rap', 'r-n-b',
            'pop', 'rock', 'indie-rock'
        ];
    }

    /**
     * Search for artists by name and return their IDs
     * 
     * @param artistName - Artist name to search for
     * @param limit - Maximum number of results (default: 1)
     * @returns Array of artist IDs
     */
    async searchArtistsByName(artistName: string, limit: number = 1): Promise<string[]> {
        await this.ensureValidToken();

        try {
            const response = await this.makeRequest<SpotifyArtistSearchResponse>(
                `/search?q=${encodeURIComponent(artistName)}&type=artist&limit=${limit}`
            );
            return response.artists.items.map(artist => artist.id);
        } catch (error) {
            console.warn(`Failed to search artist "${artistName}":`, (error as Error).message);
            return [];
        }
    }

    /**
     * Search for tracks by name and return their IDs
     * 
     * @param trackName - Track name to search for
     * @param limit - Maximum number of results (default: 1)
     * @returns Array of track IDs
     */
    async searchTracksByName(trackName: string, limit: number = 1): Promise<string[]> {
        await this.ensureValidToken();

        try {
            const response = await this.makeRequest<SpotifySearchResponse>(
                `/search?q=${encodeURIComponent(trackName)}&type=track&limit=${limit}`
            );
            return response.tracks.items.map(track => track.id);
        } catch (error) {
            console.warn(`Failed to search track "${trackName}":`, (error as Error).message);
            return [];
        }
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
