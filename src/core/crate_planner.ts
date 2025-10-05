/**
 * CratePlanner - AI-Augmented DJ Crate Planning
 * 
 * Implements the CratePlanningAI concept from spec/CratePlanningAI.spec
 * Produces ordered song crates that satisfy event prompts using both
 * deterministic heuristics and optional LLM-powered planning.
 */

import { MusicAssetCatalog } from './catalog';
import { Track, CamelotKey } from './track';
import { GeminiLLM } from '../llm/gemini-llm';
import { SpotifySearchService } from '../llm/spotify_search_service';
import { 
    parseDerivedIntent, 
    parseCandidatePoolSelection, 
    parseTrackSequence, 
    parsePlanRevision 
} from '../llm/parsers';
import {
    createDeriveIntentPrompt,
    createCandidatePoolPrompt,
    createSequencePlanPrompt,
    createExplainPlanPrompt,
    createRevisionPrompt
} from '../prompts/crate_prompting';
import {
    formatSeedTracks,
    formatTrackList,
    formatSeedTrackIds,
    formatCrateTracks
} from '../prompts/formatters';
import { formatMMSS, formatMinutes } from '../utils/time_formatters';
import { validateCratePlan, ValidationResult } from '../validation/constraints';

/**
 * User prompt for crate planning
 */
export interface CratePrompt {
    tempoRange?: { min: number; max: number };
    targetKey?: CamelotKey;
    targetGenre?: string;
    sampleTracks?: string[]; // Track IDs
    targetDuration?: number; // in seconds
    notes?: string;
}

/**
 * Derived intent from LLM analysis of the prompt
 */
export interface DerivedIntent {
    tempoRange: { min: number; max: number };
    allowedKeys: CamelotKey[];
    targetGenres: string[];
    duration: number;
    mixStyle: 'smooth' | 'energetic' | 'eclectic';
    mustIncludeArtists: string[];
    avoidArtists: string[];
    mustIncludeTracks: string[];
    avoidTracks: string[];
    energyCurve?: 'linear' | 'wave' | 'peak';
    // Tunables for Spotify Recommendations
    targetEnergy?: number;      // 0-1
    minPopularity?: number;     // 0-100
    targetKeyCamelot?: CamelotKey;
}

/**
 * Spotify Query Plan from LLM
 */
export interface SpotifyQueryPlan {
    searchQueries: string[];        // Plain text + allowed filters only
    seedGenres: string[];           // From available-genre-seeds
    seedArtists: string[];          // Artist names (will be resolved to IDs)
    seedTracks: string[];           // Track names (will be resolved to IDs)
    tunables: {
        min_tempo?: number;
        max_tempo?: number;
        target_tempo?: number;
        min_energy?: number;
        max_energy?: number;
        target_energy?: number;
        min_popularity?: number;
        target_key?: number;        // Spotify key 0-11
        target_mode?: number;       // 0=minor, 1=major
    };
    reasoning: string;
}

/**
 * LLM configuration settings
 */
export interface LLMSettings {
    model: string;
    temperature: number;
    promptTemplate?: string;
    outputTemplate?: string;
}

/**
 * A finalized crate plan
 */
export interface CratePlan {
    prompt: CratePrompt;
    trackList: string[]; // Ordered list of track IDs
    annotations: string;
    totalDuration: number;
    planDetails: {
        llmModel?: string;
        llmTraceId?: string;
        usedAI: boolean;
    };
    isFinalized: boolean;
}

/**
 * Candidate pool for track selection
 */
export interface CandidatePool {
    sourcePrompt: CratePrompt;
    tracks: Set<string>; // Track IDs
    filtersApplied: string;
}

/**
 * CratePlanner class - main planning engine
 */
export class CratePlanner {
    private catalog: MusicAssetCatalog;
    private currentPlan?: CratePlan;
    private llmSettings: LLMSettings;
    private finalizedPlans: CratePlan[] = [];
    private spotifySearchService?: SpotifySearchService;

    constructor(catalog: MusicAssetCatalog) {
        this.catalog = catalog;
        this.llmSettings = {
            model: 'gemini-2.5-flash-lite',
            temperature: 0.7
        };
    }

    /**
     * Create a plan using deterministic heuristics (no LLM)
     */
    createPlan(prompt: CratePrompt, seedTracks: string[]): CratePlan {
        // Validate seed tracks exist
        for (const trackId of seedTracks) {
            const track = this.catalog.getTrack(trackId);
            if (!track) {
                throw new Error(`Seed track ${trackId} not found in catalog`);
            }
        }

        // Generate candidate pool using deterministic filtering
        const candidates = this.generateCandidatePoolDeterministic(prompt);

        // Create ordered track list starting with seed tracks
        const trackList = this.sequencePlanDeterministic(prompt, candidates, seedTracks);

        return this._createPlanObject(
            prompt,
            trackList,
            'Plan created using deterministic heuristics',
            false
        );
    }

    /**
     * Derive intent from prompt using LLM
     */
    async deriveIntentLLM(prompt: CratePrompt, seedTracks: string[], llm: GeminiLLM): Promise<DerivedIntent> {
        // Get seed track objects and format them
        const seedTrackObjects = seedTracks
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
        
        const seedTrackInfo = formatSeedTracks(seedTrackObjects);
        const llmPrompt = createDeriveIntentPrompt(prompt, seedTrackInfo);
        const response = await llm.executeLLM(llmPrompt);
        
        return this._parseLLMResponse(
            response,
            parseDerivedIntent,
            (intent) => {
                // Validate and set defaults
                if (!intent.tempoRange) {
                    intent.tempoRange = prompt.tempoRange || { min: 100, max: 140 };
                }
                if (!intent.duration) {
                    intent.duration = prompt.targetDuration || 3600;
                }
                return intent;
            },
            () => this.createFallbackIntent(prompt),
            'intent'
        );
    }

    /**
     * Generate candidate pool using LLM with Spotify search
     */
    async generateCandidatePoolLLM(intent: DerivedIntent, llm: GeminiLLM): Promise<CandidatePool> {
        // Use Spotify search service if available, otherwise fall back to local catalog
        if (this.spotifySearchService) {
            return this.generateCandidatePoolWithSpotify(intent, llm);
        } else {
            return this.generateCandidatePoolFromCatalog(intent, llm);
        }
    }

    /**
     * Generate candidate pool using Spotify search
     */
    private async generateCandidatePoolWithSpotify(intent: DerivedIntent, llm: GeminiLLM): Promise<CandidatePool> {
        try {
            // Search Spotify for tracks matching the intent
            const spotifyTracks = await this.spotifySearchService!.searchTracksForIntent(intent, 20);
            
            if (spotifyTracks.length === 0) {
                return {
                    sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                    tracks: new Set(),
                    filtersApplied: 'No tracks found on Spotify matching the specified intent.'
                };
            }

            // Format track list for LLM with Spotify tracks
            const trackList = formatTrackList(spotifyTracks);
            const llmPrompt = createCandidatePoolPrompt(intent, trackList);
            const response = await llm.executeLLM(llmPrompt);

            return this._parseLLMResponse(
                response,
                parseCandidatePoolSelection,
                (result) => ({
                    sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                    tracks: new Set(result.selectedTrackIds),
                    filtersApplied: result.reasoning
                }),
                () => {
                    // Fallback: use all Spotify tracks if LLM parsing fails
                    return {
                        sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                        tracks: new Set(spotifyTracks.map(t => t.id)),
                        filtersApplied: 'Using all Spotify tracks (LLM parsing failed)'
                    };
                },
                'candidate pool'
            );
            
        } catch (error) {
            console.warn('⚠️ Spotify search failed, falling back to local catalog:', (error as Error).message);
            return this.generateCandidatePoolFromCatalog(intent, llm);
        }
    }

    /**
     * Generate candidate pool from local catalog (fallback)
     */
    private async generateCandidatePoolFromCatalog(intent: DerivedIntent, llm: GeminiLLM): Promise<CandidatePool> {
        // Get ALL tracks from catalog for LLM to choose from
        let allTracks = this.catalog.getAllTracks();
        
        // If no tracks available, return empty pool
        if (allTracks.length === 0) {
            return {
                sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                tracks: new Set(),
                filtersApplied: 'No tracks available to select from. Therefore, no tracks could be chosen that match the specified intent.'
            };
        }

        // Token limit protection: Pre-filter if catalog is too large
        // Each track ~50 tokens, limit to 200 tracks (~10k tokens) to stay within context window
        const MAX_TRACKS_FOR_LLM = 200;
        if (allTracks.length > MAX_TRACKS_FOR_LLM) {
            console.log(`⚠️  Large catalog detected (${allTracks.length} tracks). Pre-filtering to ${MAX_TRACKS_FOR_LLM}...`);
            
            // First, try filtering by BPM and genre
            let filtered = this.catalog.searchTracks({
                bpmRange: intent.tempoRange,
                genre: intent.targetGenres[0]
            });
            
            // If still too many, take the most recent tracks
            if (filtered.length > MAX_TRACKS_FOR_LLM) {
                filtered = filtered
                    .sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0))
                    .slice(0, MAX_TRACKS_FOR_LLM);
            }
            
            // If filtering didn't help enough, just take first MAX_TRACKS_FOR_LLM
            allTracks = filtered.length > 0 ? filtered : allTracks.slice(0, MAX_TRACKS_FOR_LLM);
            
            console.log(`   ✓ Reduced to ${allTracks.length} tracks for LLM selection`);
        }

        // Format track list for LLM with filtered tracks
        const trackList = formatTrackList(allTracks);
        const llmPrompt = createCandidatePoolPrompt(intent, trackList);
        const response = await llm.executeLLM(llmPrompt);

        return this._parseLLMResponse(
            response,
            parseCandidatePoolSelection,
            (result) => ({
                sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                tracks: new Set(result.selectedTrackIds),
                filtersApplied: result.reasoning
            }),
            () => {
                // Fallback: use broader deterministic filtering if LLM fails
                const fallbackCandidates = this.catalog.searchTracks({
                    bpmRange: intent.tempoRange
                });
                return {
                    sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                    tracks: new Set(fallbackCandidates.map(t => t.id)),
                    filtersApplied: 'Deterministic filtering (LLM parsing failed)'
                };
            },
            'candidate pool'
        );
    }

    /**
     * Sequence tracks using LLM
     */
    async sequencePlanLLM(
        intent: DerivedIntent,
        pool: CandidatePool,
        seedTracks: string[],
        llm: GeminiLLM
    ): Promise<CratePlan> {
        if (pool.tracks.size === 0) {
            throw new Error('Candidate pool is empty');
        }

        // Get track objects and format them
        const candidateTracks = Array.from(pool.tracks)
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
        
        const seedTrackObjects = seedTracks
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);

        const trackInfo = formatTrackList(candidateTracks, { withDuration: true });
        const seedInfo = formatSeedTrackIds(seedTrackObjects);
        const llmPrompt = createSequencePlanPrompt(intent, trackInfo, seedInfo);
        const response = await llm.executeLLM(llmPrompt);

        return this._parseLLMResponse(
            response,
            parseTrackSequence,
            (result) => {
                const validTracks = result.orderedTrackIds.filter(id => this.catalog.getTrack(id));
                return this._createPlanObject(
                    pool.sourcePrompt,
                    validTracks,
                    result.reasoning,
                    true,
                    this.llmSettings.model
                );
            },
            () => {
                const trackList = this.sequencePlanDeterministic(
                    pool.sourcePrompt,
                    candidateTracks,
                    seedTracks
                );
                return this._createPlanObject(
                    pool.sourcePrompt,
                    trackList,
                    'Deterministic sequencing (LLM parsing failed)',
                    false
                );
            },
            'sequence'
        );
    }

    /**
     * Generate explanations for a plan using LLM
     */
    async explainPlanLLM(plan: CratePlan, llm: GeminiLLM): Promise<CratePlan> {
        // Get track objects and format them
        const tracks = plan.trackList
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);

        const trackDetails = formatCrateTracks(tracks, false);
        const llmPrompt = createExplainPlanPrompt(trackDetails, plan.totalDuration);
        const response = await llm.executeLLM(llmPrompt);

        return {
            ...plan,
            annotations: response.trim()
        };
    }

    /**
     * Revise a plan based on user instructions using LLM
     */
    async revisePlanLLM(plan: CratePlan, instructions: string, llm: GeminiLLM): Promise<CratePlan> {
        // Validate instructions
        if (!instructions || instructions.trim().length < 5) {
            throw new Error('Revision instructions must be at least 5 characters');
        }
        
        if (instructions.trim().length > 500) {
            throw new Error('Revision instructions are too long (max 500 characters)');
        }
        
        // Get current crate tracks and format them
        const currentTracks = plan.trackList
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
        
        const trackDetails = formatCrateTracks(currentTracks, true);

        // Get replacement tracks - use smart filtering based on current plan
        const replacementTracks = this.getReplacementTracks(plan, 100);
        const availableTrackInfo = formatTrackList(replacementTracks);

        const llmPrompt = createRevisionPrompt(
            trackDetails, 
            instructions, 
            availableTrackInfo,
            plan.totalDuration  // Add duration constraint
        );
        const response = await llm.executeLLM(llmPrompt);

        return this._parseLLMResponse(
            response,
            parsePlanRevision,
            (result) => {
                const validTracks = result.revisedTrackIds.filter(id => this.catalog.getTrack(id));
                
                // Warn if duration changed significantly
                const newDuration = this._calculateTotalDuration(validTracks);
                const durationDiff = Math.abs(newDuration - plan.totalDuration);
                if (durationDiff > 600) { // > 10 minutes
                    console.warn(`   ⚠️  Duration changed by ${Math.floor(durationDiff / 60)} minutes`);
                }
                
                const revisedPlan: CratePlan = {
                    ...plan,
                    trackList: validTracks,
                    annotations: result.changesExplanation,
                    totalDuration: newDuration,
                    isFinalized: false
                };
                this.currentPlan = revisedPlan;
                return revisedPlan;
            },
            () => {
                throw new Error('Failed to revise plan: LLM response parsing failed');
            },
            'revision'
        );
    }
    
    /**
     * Get smart replacement tracks for revision
     * Filters tracks similar to current plan characteristics
     */
    private getReplacementTracks(plan: CratePlan, maxTracks: number): Track[] {
        const currentTracks = plan.trackList
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
        
        if (currentTracks.length === 0) {
            return this.catalog.getAllTracks().slice(0, maxTracks);
        }
        
        // Calculate plan characteristics
        const avgBPM = currentTracks.reduce((sum, t) => sum + t.bpm, 0) / currentTracks.length;
        const usedKeys = new Set(currentTracks.map(t => t.key));
        const usedGenres = new Set(currentTracks.map(t => t.genre).filter(g => g));
        
        // Get similar tracks
        let similarTracks = this.catalog.searchTracks({
            bpmRange: {
                min: Math.floor(avgBPM - 10),
                max: Math.ceil(avgBPM + 10)
            }
        });
        
        // If we have genre info, filter by that too
        if (usedGenres.size > 0) {
            const genreFiltered = similarTracks.filter(t => 
                t.genre && usedGenres.has(t.genre)
            );
            if (genreFiltered.length > maxTracks / 2) {
                similarTracks = genreFiltered;
            }
        }
        
        // Limit and sort by recency
        if (similarTracks.length > maxTracks) {
            similarTracks = similarTracks
                .sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0))
                .slice(0, maxTracks);
        }
        
        return similarTracks;
    }

    /**
     * Validate a plan
     * Uses centralized validation logic with catalog-specific checks
     */
    validate(plan: CratePlan, toleranceSeconds: number = 300): ValidationResult {
        // Use centralized validation
        const result = validateCratePlan(plan, toleranceSeconds);
        
        // Add catalog-specific validation
        for (const trackId of plan.trackList) {
            if (!this.catalog.getTrack(trackId)) {
                result.errors.push(`Track ${trackId} not found in catalog`);
                result.isValid = false;
            }
        }

        return result;
    }

    /**
     * Finalize a plan
     */
    finalize(plan: CratePlan): void {
        const validation = this.validate(plan);
        
        if (!validation.isValid) {
            throw new Error(`Cannot finalize invalid plan: ${validation.errors.join(', ')}`);
        }

        plan.isFinalized = true;
        this.finalizedPlans.push(plan);
    }

    /**
     * Set LLM settings
     */
    setLLMSettings(settings: Partial<LLMSettings>): void {
        this.llmSettings = { ...this.llmSettings, ...settings };
    }

    /**
     * Set Spotify search service for real-time track discovery
     */
    setSpotifySearchService(service: SpotifySearchService): void {
        this.spotifySearchService = service;
    }

    /**
     * Check if Spotify search is enabled
     */
    isSpotifySearchEnabled(): boolean {
        return this.spotifySearchService !== undefined;
    }

    /**
     * Get current plan
     */
    getCurrentPlan(): CratePlan | undefined {
        return this.currentPlan;
    }

    /**
     * Get all finalized plans
     */
    getFinalizedPlans(): CratePlan[] {
        return this.finalizedPlans;
    }

    /**
     * Display current crate plan
     */
    displayCrate(): void {
        if (!this.currentPlan) {
            console.log('No current plan');
            return;
        }

        console.log('\n📋 Current Crate Plan');
        console.log('====================');
        console.log(`Total Duration: ${formatMinutes(this.currentPlan.totalDuration)}`);
        console.log(`Tracks: ${this.currentPlan.trackList.length}`);
        console.log(`AI-Generated: ${this.currentPlan.planDetails.usedAI ? 'Yes' : 'No'}`);
        console.log(`Finalized: ${this.currentPlan.isFinalized ? 'Yes' : 'No'}\n`);

        this.currentPlan.trackList.forEach((trackId, index) => {
            const track = this.catalog.getTrack(trackId);
            if (track) {
                console.log(`${index + 1}. ${track.artist} - ${track.title}`);
                console.log(`   ${track.bpm} BPM | ${track.key} | ${formatMMSS(track.duration_sec)} | Energy: ${track.energy || 'N/A'}`);
            }
        });

        if (this.currentPlan.annotations) {
            console.log('\n💡 Notes:');
            console.log(this.currentPlan.annotations);
        }
    }

    // ========== PRIVATE HELPER METHODS ==========

    /**
     * Parse LLM response with a fallback mechanism
     */
    private _parseLLMResponse<T, U>(
        response: string,
        parser: (text: string) => T,
        onSuccess: (parsed: T) => U,
        onFailure: () => U,
        errorContext: string
    ): U {
        try {
            const parsed = parser(response);
            return onSuccess(parsed);
        } catch (error) {
            console.error(`❌ Error parsing LLM ${errorContext} response:`, (error as Error).message);
            return onFailure();
        }
    }

    /**
     * Calculate total duration of a track list
     */
    private _calculateTotalDuration(trackIds: string[]): number {
        return trackIds.reduce((sum, id) => {
            const track = this.catalog.getTrack(id);
            return sum + (track?.duration_sec || 0);
        }, 0);
    }

    /**
     * Create a CratePlan object
     */
    private _createPlanObject(
        prompt: CratePrompt,
        trackList: string[],
        annotations: string,
        usedAI: boolean,
        llmModel?: string
    ): CratePlan {
        const plan: CratePlan = {
            prompt,
            trackList,
            annotations,
            totalDuration: this._calculateTotalDuration(trackList),
            planDetails: {
                usedAI,
                llmModel,
            },
            isFinalized: false,
        };
        this.currentPlan = plan;
        return plan;
    }

    /**
     * Generate candidate pool using deterministic filtering
     */
    private generateCandidatePoolDeterministic(prompt: CratePrompt): Track[] {
        return this.catalog.searchTracks({
            bpmRange: prompt.tempoRange,
            genre: prompt.targetGenre,
            key: prompt.targetKey
        });
    }

    /**
     * Sequence tracks using deterministic heuristics
     */
    private sequencePlanDeterministic(
        prompt: CratePrompt,
        candidates: Track[],
        seedTracks: string[]
    ): string[] {
        const result: string[] = [];
        const used = new Set<string>();

        // Add seed tracks first
        for (const seedId of seedTracks) {
            if (!used.has(seedId)) {
                result.push(seedId);
                used.add(seedId);
            }
        }

        // Sort remaining candidates by BPM
        const remaining = candidates
            .filter(t => !used.has(t.id))
            .sort((a, b) => a.bpm - b.bpm);

        // Add tracks until we reach target duration
        const targetDuration = prompt.targetDuration || 3600;
        let currentDuration = result.reduce((sum, id) => {
            const track = this.catalog.getTrack(id);
            return sum + (track?.duration_sec || 0);
        }, 0);

        for (const track of remaining) {
            if (currentDuration >= targetDuration) break;
            result.push(track.id);
            used.add(track.id);
            currentDuration += track.duration_sec;
        }

        return result;
    }

    /**
     * Create fallback intent when LLM fails
     */
    private createFallbackIntent(prompt: CratePrompt): DerivedIntent {
        return {
            tempoRange: prompt.tempoRange || { min: 100, max: 140 },
            allowedKeys: [], // All keys allowed
            targetGenres: prompt.targetGenre ? [prompt.targetGenre] : [],
            duration: prompt.targetDuration || 3600,
            mixStyle: 'smooth',
            mustIncludeArtists: [],
            avoidArtists: [],
            mustIncludeTracks: prompt.sampleTracks || [],
            avoidTracks: [],
            energyCurve: 'linear'
        };
    }
}
