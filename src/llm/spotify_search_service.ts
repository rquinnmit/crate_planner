/**
 * Spotify Search Service - LLM-Driven Track Discovery
 * 
 * Uses LLM to generate Spotify Query Plans (Search + Recommendations),
 * then fetches tracks using proper API metadata and constraints.
 * 
 * Dual-source approach:
 * 1. Search API: broad discovery with plain text + allowed filters
 * 2. Recommendations API: precise constraints (tempo, energy, popularity)
 * 3. Post-filter: BPM, key compatibility, energy level
 */

import { GeminiLLM } from './gemini-llm';
import { SpotifyImporter, RecommendationsParams } from '../import/spotify_importer';
import { MusicAssetCatalog } from '../core/catalog';
import { DerivedIntent, SpotifyQueryPlan } from '../core/crate_planner';
import { Track, CamelotKey } from '../core/track';
import { createQueryPlanPrompt } from '../prompts/crate_prompting';
import { camelotToSpotifyKey } from '../import/spotify_key_converter';

/**
 * Spotify search service for LLM-driven track discovery
 */
export class SpotifySearchService {
    private spotifyImporter: SpotifyImporter;
    private llm: GeminiLLM;
    private catalog: MusicAssetCatalog;
    private availableGenreSeeds: string[] = [];

    constructor(spotifyImporter: SpotifyImporter, llm: GeminiLLM, catalog: MusicAssetCatalog) {
        this.spotifyImporter = spotifyImporter;
        this.llm = llm;
        this.catalog = catalog;
    }

    /**
     * Search Spotify for tracks matching the derived intent
     * Uses dual-source approach: Search + Recommendations
     * 
     * @param intent - Derived intent from user prompt
     * @param maxTracksPerQuery - Maximum tracks to fetch per search query
     * @returns Array of tracks from Spotify
     */
    async searchTracksForIntent(intent: DerivedIntent, maxTracksPerQuery: number = 20): Promise<Track[]> {
        try {
            // Fetch available genre seeds if not cached
            if (this.availableGenreSeeds.length === 0) {
                console.log('   Fetching available genre seeds...');
                this.availableGenreSeeds = await this.spotifyImporter.getAvailableGenreSeeds();
                if (this.availableGenreSeeds.length > 0) {
                    console.log(`   ✓ Loaded ${this.availableGenreSeeds.length} genre seeds`);
                } else {
                    console.log('   ⚠️  No genre seeds available (will use search queries only)');
                }
            }

            // Generate Query Plan using LLM
            console.log('🔍 Generating Spotify Query Plan with LLM...');
            const queryPlan = await this.createQueryPlanLLM(intent);
            
            console.log(`   Search Queries: ${queryPlan.searchQueries.length}`);
            console.log(`   Seed Genres: ${queryPlan.seedGenres.join(', ') || 'none'}`);
            console.log(`   Seed Artists: ${queryPlan.seedArtists.join(', ') || 'none'}`);
            console.log(`   Reasoning: ${queryPlan.reasoning}`);

            const allTracks: Track[] = [];
            const seenTrackIds = new Set<string>();

            // Source 1: Search API queries
            console.log('\n📡 Executing Search API queries...');
            for (const query of queryPlan.searchQueries) {
                const sanitized = this.sanitizeSearchQuery(query);
                console.log(`   Searching: "${sanitized}"`);
                
                try {
                    const result = await this.spotifyImporter.searchAndImport(sanitized, maxTracksPerQuery);
                    const importedTracks = this.catalog.getAllTracks().slice(-result.tracksImported);
                    
                    for (const track of importedTracks) {
                        if (!seenTrackIds.has(track.id)) {
                            seenTrackIds.add(track.id);
                            allTracks.push(track);
                        }
                    }
                    
                    console.log(`   ✓ Found ${result.tracksImported} tracks`);
                } catch (error) {
                    console.warn(`   ⚠️ Search failed: ${(error as Error).message}`);
                }
            }

            // Source 2: Recommendations API
            if (queryPlan.seedGenres.length > 0 || queryPlan.seedArtists.length > 0 || queryPlan.seedTracks.length > 0) {
                console.log('\n🎯 Executing Recommendations API...');
                const recTracks = await this.getRecommendations(queryPlan, intent);
                
                for (const track of recTracks) {
                    if (!seenTrackIds.has(track.id)) {
                        seenTrackIds.add(track.id);
                        allTracks.push(track);
                    }
                }
                
                console.log(`   ✓ Found ${recTracks.length} recommendations`);
            }

            console.log(`\n✅ Total unique tracks before filtering: ${allTracks.length}`);

            // Post-filter by BPM, key, energy
            const filtered = this.postFilter(allTracks, intent);
            console.log(`✅ After filtering: ${filtered.length} tracks match constraints`);

            return filtered;
            
        } catch (error) {
            console.error('❌ Spotify search failed:', (error as Error).message);
            return [];
        }
    }

    /**
     * Create Spotify Query Plan using LLM
     */
    private async createQueryPlanLLM(intent: DerivedIntent): Promise<SpotifyQueryPlan> {
        const prompt = createQueryPlanPrompt(intent, this.availableGenreSeeds);
        const response = await this.llm.executeLLM(prompt);
        
        return this.parseQueryPlan(response, intent);
    }

    /**
     * Parse LLM response to extract Query Plan
     */
    private parseQueryPlan(response: string, intent: DerivedIntent): SpotifyQueryPlan {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate and return
            return {
                searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
                seedGenres: Array.isArray(parsed.seedGenres) ? parsed.seedGenres.slice(0, 3) : [],
                seedArtists: Array.isArray(parsed.seedArtists) ? parsed.seedArtists.slice(0, 2) : [],
                seedTracks: Array.isArray(parsed.seedTracks) ? parsed.seedTracks.slice(0, 2) : [],
                tunables: parsed.tunables || {},
                reasoning: parsed.reasoning || 'No reasoning provided'
            };
            
        } catch (error) {
            console.warn('⚠️ Failed to parse Query Plan, using fallback');
            return this.createFallbackQueryPlan(intent);
        }
    }

    /**
     * Create fallback Query Plan if LLM fails
     */
    private createFallbackQueryPlan(intent: DerivedIntent): SpotifyQueryPlan {
        const queries: string[] = [];
        const recentYears = 'year:2021-2024';
        
        // Add genre-based search queries
        for (const genre of intent.targetGenres.slice(0, 3)) {
            queries.push(`${genre} ${recentYears}`);
        }
        
        // Add artist queries if specified
        for (const artist of intent.mustIncludeArtists.slice(0, 2)) {
            queries.push(`artist:"${artist}" ${recentYears}`);
        }
        
        // Fallback seed genres (match intent genres to available seeds)
        const seedGenres: string[] = [];
        for (const genre of intent.targetGenres.slice(0, 3)) {
            const normalized = genre.toLowerCase().replace(/\s+/g, '-');
            if (this.availableGenreSeeds.includes(normalized)) {
                seedGenres.push(normalized);
            }
        }
        
        // Determine fallback genre based on intent, not hardcoded 'house'
        const fallbackGenre = intent.targetGenres[0] || 'electronic';
        const fallbackQuery = `${fallbackGenre} ${recentYears}`;
        
        return {
            searchQueries: queries.length > 0 ? queries : [fallbackQuery],
            seedGenres,
            seedArtists: intent.mustIncludeArtists.slice(0, 2),
            seedTracks: [],
            tunables: {
                min_tempo: intent.tempoRange.min,
                max_tempo: intent.tempoRange.max,
                target_energy: intent.targetEnergy || 0.6,
                min_popularity: intent.minPopularity || 30
            },
            reasoning: 'Fallback query plan (LLM parsing failed)'
        };
    }

    /**
     * Get recommendations from Spotify using seeds and tunables
     */
    private async getRecommendations(queryPlan: SpotifyQueryPlan, intent: DerivedIntent): Promise<Track[]> {
        try {
            // Resolve artist names to IDs
            const artistIds: string[] = [];
            for (const artistName of queryPlan.seedArtists) {
                const ids = await this.spotifyImporter.searchArtistsByName(artistName, 1);
                if (ids.length > 0) {
                    artistIds.push(ids[0]);
                }
            }

            // Resolve track names to IDs
            const trackIds: string[] = [];
            for (const trackName of queryPlan.seedTracks) {
                const ids = await this.spotifyImporter.searchTracksByName(trackName, 1);
                if (ids.length > 0) {
                    trackIds.push(ids[0]);
                }
            }

            // Validate seed_genres against available genre seeds
            const validGenres = queryPlan.seedGenres.filter(genre => 
                this.availableGenreSeeds.includes(genre.toLowerCase())
            );

            // If no valid seeds at all, use safe fallback genres
            if (validGenres.length === 0 && artistIds.length === 0 && trackIds.length === 0) {
                // Add safe fallback genres based on intent
                const fallbackGenres = ['house', 'techno', 'electronic', 'dance', 'deep-house']
                    .filter(g => this.availableGenreSeeds.includes(g));
                validGenres.push(...fallbackGenres.slice(0, 2));
            }

            // Calculate seed distribution (max 5 total seeds)
            const totalAvailable = validGenres.length + artistIds.length + trackIds.length;
            const maxGenres = Math.min(validGenres.length, 5 - artistIds.length - trackIds.length);
            const maxArtists = Math.min(artistIds.length, 5 - validGenres.length - trackIds.length);
            const maxTracks = Math.min(trackIds.length, 5 - validGenres.length - artistIds.length);

            // Build recommendations params
            const params: RecommendationsParams = {
                seed_genres: validGenres.slice(0, Math.max(0, maxGenres)),
                seed_artists: artistIds.slice(0, Math.max(0, maxArtists)),
                seed_tracks: trackIds.slice(0, Math.max(0, maxTracks)),
                limit: 50,
                ...queryPlan.tunables
            };

            // Verify we have at least one seed
            const totalSeeds = (params.seed_genres?.length || 0) + 
                             (params.seed_artists?.length || 0) + 
                             (params.seed_tracks?.length || 0);
            
            if (totalSeeds === 0) {
                console.warn('⚠️ No valid seeds available for recommendations, skipping');
                return [];
            }

            console.log(`   Using seeds: ${params.seed_genres?.length || 0} genres, ${params.seed_artists?.length || 0} artists, ${params.seed_tracks?.length || 0} tracks`);

            // Convert Camelot key to Spotify key if specified
            if (intent.targetKeyCamelot) {
                const spotifyKey = camelotToSpotifyKey(intent.targetKeyCamelot);
                if (spotifyKey) {
                    params.target_key = spotifyKey.key;
                    params.target_mode = spotifyKey.mode;
                }
            }

            const result = await this.spotifyImporter.getRecommendations(params);
            return this.catalog.getAllTracks().slice(-result.tracksImported);
            
        } catch (error) {
            console.warn('⚠️ Recommendations failed:', (error as Error).message);
            return [];
        }
    }

    /**
     * Sanitize search query: remove unsupported filters
     */
    private sanitizeSearchQuery(query: string): string {
        let q = query;

        // Remove unsupported filter prefixes (but keep genre as plain text)
        // Spotify Search API doesn't support these filters, only artist:, track:, album:, year:
        const unsupported = [
            'bpm', 'tempo', 'key', 'camelot', 'mood', 'energy', 'danceability', 
            'duration', 'popularity', 'valence', 'loudness', 'tag'
        ];
        
        for (const token of unsupported) {
            const re = new RegExp(`\\b${token}\\s*:\\s*(\\"[^\\"]*\\"|[^\\s]+)`, 'ig');
            q = q.replace(re, '').trim();
        }

        // Convert genre: filter to plain text (Spotify doesn't support genre: in search)
        q = q.replace(/\bgenre\s*:\s*(\\"[^\\"]*\\"|[^\\s]+)/ig, '$1').trim();

        // Collapse whitespace
        q = q.replace(/\s{2,}/g, ' ').trim();

        // Add a wider year filter if missing and query has content
        // Use 2018-2025 for better coverage
        if (!/\byear:\s*\d{4}(?:-\d{4})?/i.test(q) && q.length > 0) {
            // Only add year if query doesn't have artist: or track: filters (those work well without years)
            if (!/\b(artist|track)\s*:/i.test(q)) {
                q = `${q} year:2018-2025`.trim();
            }
        }

        return q || 'house year:2018-2025';
    }

    /**
     * Get default energy level based on mix style
     */
    private getDefaultEnergy(mixStyle: string): number {
        switch (mixStyle) {
            case 'smooth':
                return 2; // Low energy for smooth/chill sets
            case 'energetic':
                return 4; // High energy for peak hour/club sets
            case 'eclectic':
                return 3; // Medium energy for varied sets
            default:
                return 3; // Default medium
        }
    }

    /**
     * Get energy tolerance based on mix style
     */
    private getEnergyTolerance(mixStyle: string): number {
        // Eclectic sets allow wider energy range
        return mixStyle === 'eclectic' ? 0.4 : 0.3;
    }

    /**
     * Post-filter tracks by BPM, key compatibility, energy
     */
    private postFilter(tracks: Track[], intent: DerivedIntent): Track[] {
        return tracks.filter(track => {
            // BPM filter
            const bpmMatch = track.bpm >= intent.tempoRange.min && track.bpm <= intent.tempoRange.max;
            
            // Key filter (if allowedKeys specified)
            const keyMatch = intent.allowedKeys.length === 0 || intent.allowedKeys.includes(track.key);
            
            // Energy filter (map 1-5 to 0-1 scale)
            const defaultEnergy = this.getDefaultEnergy(intent.mixStyle);
            const trackEnergy = (track.energy || defaultEnergy) / 5;
            const targetEnergy = intent.targetEnergy || (defaultEnergy / 5);
            const energyTolerance = this.getEnergyTolerance(intent.mixStyle);
            const energyMatch = Math.abs(trackEnergy - targetEnergy) < energyTolerance;
            
            return bpmMatch && keyMatch && energyMatch;
        });
    }

    /**
     * Get search statistics
     */
    getSearchStats(): {
        totalSearches: number;
        successfulSearches: number;
        failedSearches: number;
    } {
        return {
            totalSearches: this.spotifyImporter.getRequestCount(),
            successfulSearches: 0,
            failedSearches: 0
        };
    }

    /**
     * Reset search statistics
     */
    resetSearchStats(): void {
        this.spotifyImporter.resetRequestCount();
    }
}
