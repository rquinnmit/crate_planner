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
    createRevisionPrompt,
    formatSeedTracks,
    formatTrackList,
    formatTracksWithDuration,
    formatSeedTrackIds,
    formatCrateTracks
} from '../prompts/crate_prompting';
import { formatMMSS, formatMinutes } from '../utils/time_formatters';
import { validateCratePlan } from '../validation/constraints';

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
 * Validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * CratePlanner class - main planning engine
 */
export class CratePlanner {
    private catalog: MusicAssetCatalog;
    private currentPlan?: CratePlan;
    private llmSettings: LLMSettings;
    private finalizedPlans: CratePlan[] = [];

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

        // Calculate total duration
        const totalDuration = trackList.reduce((sum, trackId) => {
            const track = this.catalog.getTrack(trackId);
            return sum + (track?.duration_sec || 0);
        }, 0);

        const plan: CratePlan = {
            prompt,
            trackList,
            annotations: 'Plan created using deterministic heuristics',
            totalDuration,
            planDetails: {
                usedAI: false
            },
            isFinalized: false
        };

        this.currentPlan = plan;
        return plan;
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
        
        try {
            const intent = parseDerivedIntent(response);
            
            // Validate and set defaults
            if (!intent.tempoRange) {
                intent.tempoRange = prompt.tempoRange || { min: 100, max: 140 };
            }
            if (!intent.duration) {
                intent.duration = prompt.targetDuration || 3600;
            }

            return intent;
        } catch (error) {
            console.error('❌ Error parsing LLM intent response:', (error as Error).message);
            // Fallback to basic intent
            return this.createFallbackIntent(prompt);
        }
    }

    /**
     * Generate candidate pool using LLM
     */
    async generateCandidatePoolLLM(intent: DerivedIntent, llm: GeminiLLM): Promise<CandidatePool> {
        // First, get candidates using deterministic filtering
        const deterministicCandidates = this.catalog.searchTracks({
            bpmRange: intent.tempoRange,
            genre: intent.targetGenres[0]
        });

        // Format track list for LLM
        const trackList = formatTrackList(deterministicCandidates);
        const llmPrompt = createCandidatePoolPrompt(intent, trackList);
        const response = await llm.executeLLM(llmPrompt);

        try {
            const result = parseCandidatePoolSelection(response);

            const pool: CandidatePool = {
                sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                tracks: new Set(result.selectedTrackIds),
                filtersApplied: result.reasoning
            };

            return pool;
        } catch (error) {
            console.error('❌ Error parsing LLM candidate pool response:', (error as Error).message);
            // Fallback to deterministic candidates
            return {
                sourcePrompt: { targetGenre: intent.targetGenres[0], tempoRange: intent.tempoRange },
                tracks: new Set(deterministicCandidates.map(t => t.id)),
                filtersApplied: 'Deterministic filtering (LLM parsing failed)'
            };
        }
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

        const trackInfo = formatTracksWithDuration(candidateTracks);
        const seedInfo = formatSeedTrackIds(seedTrackObjects);
        const llmPrompt = createSequencePlanPrompt(intent, trackInfo, seedInfo);
        const response = await llm.executeLLM(llmPrompt);

        try {
            const result = parseTrackSequence(response);

            // Validate tracks exist
            const validTracks = result.orderedTrackIds.filter(id => this.catalog.getTrack(id));

            const totalDuration = validTracks.reduce((sum, id) => {
                const track = this.catalog.getTrack(id);
                return sum + (track?.duration_sec || 0);
            }, 0);

            const plan: CratePlan = {
                prompt: pool.sourcePrompt,
                trackList: validTracks,
                annotations: result.reasoning,
                totalDuration,
                planDetails: {
                    llmModel: this.llmSettings.model,
                    usedAI: true
                },
                isFinalized: false
            };

            this.currentPlan = plan;
            return plan;
        } catch (error) {
            console.error('❌ Error parsing LLM sequence response:', (error as Error).message);
            // Fallback to deterministic sequencing
            const trackList = this.sequencePlanDeterministic(
                pool.sourcePrompt,
                candidateTracks,
                seedTracks
            );

            const totalDuration = trackList.reduce((sum, id) => {
                const track = this.catalog.getTrack(id);
                return sum + (track?.duration_sec || 0);
            }, 0);

            const plan: CratePlan = {
                prompt: pool.sourcePrompt,
                trackList,
                annotations: 'Deterministic sequencing (LLM parsing failed)',
                totalDuration,
                planDetails: {
                    usedAI: false
                },
                isFinalized: false
            };

            this.currentPlan = plan;
            return plan;
        }
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
        // Get current crate tracks and format them
        const currentTracks = plan.trackList
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
        
        const trackDetails = formatCrateTracks(currentTracks, true);

        // Get all available tracks for replacements
        const allTracks = this.catalog.searchTracks({});
        const availableTrackInfo = formatTrackList(allTracks.slice(0, 30));

        const llmPrompt = createRevisionPrompt(trackDetails, instructions, availableTrackInfo);
        const response = await llm.executeLLM(llmPrompt);

        try {
            const result = parsePlanRevision(response);

            // Validate tracks exist
            const validTracks = result.revisedTrackIds.filter(id => this.catalog.getTrack(id));

            const totalDuration = validTracks.reduce((sum, id) => {
                const track = this.catalog.getTrack(id);
                return sum + (track?.duration_sec || 0);
            }, 0);

            const revisedPlan: CratePlan = {
                ...plan,
                trackList: validTracks,
                annotations: result.changesExplanation,
                totalDuration,
                isFinalized: false
            };

            this.currentPlan = revisedPlan;
            return revisedPlan;
        } catch (error) {
            console.error('❌ Error parsing LLM revision response:', (error as Error).message);
            throw new Error('Failed to revise plan: LLM response parsing failed');
        }
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
