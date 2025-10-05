/**
 * Base Importer - Foundation for all API importers
 * 
 * Provides common functionality for importing track data from external APIs
 * into the CratePilot catalog.
 */

import { Track } from '../core/track';
import { MusicAssetCatalog } from '../core/catalog';

/**
 * Import result information
 */
export interface ImportResult {
    success: boolean;
    tracksImported: number;
    tracksFailed: number;
    errors: string[];
    warnings: string[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
    requestsPerSecond: number;
    requestsPerMinute: number;
    retryAttempts: number;
    retryDelayMs: number;
}

/**
 * API credentials/configuration
 */
export interface APIConfig {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    baseURL: string;
    rateLimit?: RateLimitConfig;
}

/**
 * External track data (raw from API - needs normalization)
 */
export interface ExternalTrackData {
    id: string;
    artist: string;
    title: string;
    [key: string]: any; // Other API-specific fields
}

/**
 * Base class for all API importers
 */
export abstract class BaseImporter {
    protected catalog: MusicAssetCatalog;
    protected config: APIConfig;
    protected requestCount: number = 0;
    protected lastRequestTime: number = 0;

    constructor(catalog: MusicAssetCatalog, config: APIConfig) {
        this.catalog = catalog;
        this.config = config;
    }

    /**
     * Import tracks by search query
     * 
     * @param query - Search query (e.g., artist name, genre)
     * @param limit - Maximum number of tracks to import
     * @returns Import result with statistics
     */
    abstract searchAndImport(query: string, limit?: number): Promise<ImportResult>;

    /**
     * Import a single track by ID
     * 
     * @param externalId - Track ID in the external system
     * @returns Import result
     */
    abstract importById(externalId: string): Promise<ImportResult>;

    /**
     * Normalize external data to CratePilot Track format
     * Must be implemented by each API-specific importer
     * 
     * @param externalData - Raw data from API
     * @returns Normalized Track object
     */
    protected abstract normalizeTrack(externalData: ExternalTrackData): Track | null;

    /**
     * Make an API request with rate limiting
     * 
     * @param endpoint - API endpoint
     * @param options - Fetch options
     * @returns Response data
     */
    protected async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
        // Rate limiting
        await this.enforceRateLimit();

        const url = `${this.config.baseURL}${endpoint}`;
        
        // Only add Content-Type for POST/PUT/PATCH requests (not GET)
        const method = options?.method || 'GET';
        const baseHeaders: Record<string, string> = this.getAuthHeaders();
        
        if (method !== 'GET' && method !== 'HEAD') {
            baseHeaders['Content-Type'] = 'application/json';
        }
        
        const headers = {
            ...baseHeaders,
            ...(options?.headers || {})
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        this.requestCount++;
        this.lastRequestTime = Date.now();

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Get authentication headers (override in subclasses)
     */
    protected getAuthHeaders(): Record<string, string> {
        if (this.config.apiKey) {
            return { 'Authorization': `Bearer ${this.config.apiKey}` };
        }
        return {};
    }

    /**
     * Enforce rate limiting
     */
    protected async enforceRateLimit(): Promise<void> {
        if (!this.config.rateLimit) return;

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minTimeBetweenRequests = 1000 / this.config.rateLimit.requestsPerSecond;

        if (timeSinceLastRequest < minTimeBetweenRequests) {
            const delay = minTimeBetweenRequests - timeSinceLastRequest;
            await this.sleep(delay);
        }
    }

    /**
     * Sleep helper
     */
    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Import multiple tracks with error handling
     * 
     * @param externalTracks - Array of external track data
     * @returns Import result with statistics
     */
    protected async importTracks(externalTracks: ExternalTrackData[]): Promise<ImportResult> {
        const result: ImportResult = {
            success: true,
            tracksImported: 0,
            tracksFailed: 0,
            errors: [],
            warnings: []
        };

        for (const externalTrack of externalTracks) {
            try {
                const normalizedTrack = this.normalizeTrack(externalTrack);
                
                if (!normalizedTrack) {
                    result.tracksFailed++;
                    result.warnings.push(`Could not normalize track: ${externalTrack.artist} - ${externalTrack.title}`);
                    continue;
                }

                // Check if track already exists
                if (this.catalog.hasTrack(normalizedTrack.id)) {
                    result.warnings.push(`Track already exists: ${normalizedTrack.id}`);
                    continue;
                }

                this.catalog.addTrack(normalizedTrack);
                result.tracksImported++;
                
            } catch (error) {
                result.tracksFailed++;
                result.errors.push(`Failed to import track: ${(error as Error).message}`);
            }
        }

        result.success = result.errors.length === 0;
        return result;
    }

    /**
     * Validate track data before importing
     */
    protected validateTrackData(track: Partial<Track>): boolean {
        return !!(
            track.id &&
            track.artist &&
            track.title &&
            track.bpm &&
            track.key &&
            track.duration_sec
        );
    }

    /**
     * Generate internal track ID from external ID
     * 
     * @param externalId - External track ID
     * @param source - Source name (e.g., 'beatport', 'beatsource')
     * @returns Internal track ID
     */
    protected generateTrackId(externalId: string, source: string): string {
        return `${source}-${externalId}`;
    }

    /**
     * Get import statistics
     */
    getRequestCount(): number {
        return this.requestCount;
    }

    /**
     * Reset request counter
     */
    resetRequestCount(): void {
        this.requestCount = 0;
    }
}
