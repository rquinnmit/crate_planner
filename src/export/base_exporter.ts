/**
 * Base Exporter - Shared functionality for all exporters
 * 
 * Provides common utilities for playlist/crate export operations.
 */

import { CratePlan } from '../core/crate_planner';
import { Track } from '../core/track';
import { MusicAssetCatalog } from '../core/catalog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Common M3U8 export options
 */
export interface M3U8ExportOptions {
    outputPath: string;
    playlistName: string;
    includeMetadata?: boolean;
    relativePaths?: boolean;
}

/**
 * Export result information
 */
export interface ExportResult {
    success: boolean;
    filePath?: string;
    error?: string;
    tracksExported: number;
}

/**
 * Base exporter class with shared functionality
 */
export abstract class BaseExporter {
    protected catalog: MusicAssetCatalog;

    constructor(catalog: MusicAssetCatalog) {
        this.catalog = catalog;
    }

    /**
     * Export a crate plan to a platform-specific format
     */
    abstract export(plan: CratePlan, options: any): Promise<ExportResult>;

    /**
     * Export multiple plans as a collection
     * Creates separate files for each plan
     */
    async exportMultiple(
        plans: CratePlan[],
        platform: 'rekordbox' | 'serato',
        baseOptions: Omit<any, 'outputPath' | 'playlistName' | 'crateName'>
    ): Promise<ExportResult[]> {
        const results: ExportResult[] = [];
        const nameKey = platform === 'rekordbox' ? 'playlistName' : 'crateName';
        const nameTemplate = platform === 'rekordbox' ? 'Plan' : 'Crate';
        const fileTemplate = platform === 'rekordbox' ? 'plan' : 'crate';

        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            const playlistName = `CratePilot ${nameTemplate} ${i + 1}`;
            const outputPath = `./exports/${platform}_${fileTemplate}_${i + 1}.${baseOptions.format}`;

            const options = {
                ...baseOptions,
                outputPath,
                [nameKey]: playlistName
            };

            const result = await this.export(plan, options);
            results.push(result);
        }

        return results;
    }

    /**
     * Validate that a plan is ready for export
     * 
     * @param plan - Plan to validate
     * @returns Validation result
     */
    protected validatePlanForExport(plan: CratePlan): ExportResult | null {
        if (!plan.isFinalized) {
            return {
                success: false,
                error: 'Cannot export non-finalized plan. Call finalize() first.',
                tracksExported: 0
            };
        }

        const tracks = this.getTracksFromPlan(plan);
        if (tracks.length === 0) {
            return {
                success: false,
                error: 'No valid tracks found in plan',
                tracksExported: 0
            };
        }

        return null; // No errors
    }

    /**
     * Get track objects from a plan
     * 
     * @param plan - Crate plan
     * @returns Array of valid tracks
     */
    protected getTracksFromPlan(plan: CratePlan): Track[] {
        return plan.trackList
            .map(id => this.catalog.getTrack(id))
            .filter((track): track is Track => track !== undefined);
    }

    /**
     * Generate M3U8 content
     * Can be overridden for platform-specific metadata
     */
    protected async _exportM3U8(tracks: Track[], options: M3U8ExportOptions): Promise<string> {
        let content = '#EXTM3U\n';
        content += `#PLAYLIST:${options.playlistName}\n\n`;

        for (const track of tracks) {
            const duration = Math.floor(track.duration_sec);
            const artist = this.escapeM3U(track.artist);
            const title = this.escapeM3U(track.title);
            
            content += `#EXTINF:${duration},${artist} - ${title}\n`;

            if (options.includeMetadata) {
                content += this.getM3UExtraMetadata(track);
            }

            const filePath = this.getFilePath(track, options.relativePaths || false, options.outputPath);
            content += `${filePath}\n\n`;
        }

        const outputPath = this.ensureExtension(options.outputPath, '.m3u8');
        return this.writeFile(outputPath, content);
    }

    /**
     * Get platform-specific M3U metadata
     * Base implementation provides common metadata
     */
    protected getM3UExtraMetadata(track: Track): string {
        let metadata = '';
        metadata += `#EXTALB:${this.escapeM3U(track.album || '')}\n`;
        metadata += `#EXTGENRE:${this.escapeM3U(track.genre || '')}\n`;
        metadata += `#EXTBPM:${track.bpm}\n`;
        metadata += `#EXTKEY:${track.key}\n`;
        return metadata;
    }

    /**
     * Validate that all tracks have file paths before export
     * 
     * @param plan - Plan to validate
     * @returns Validation result
     */
    validateTracksForExport(plan: CratePlan): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        for (const trackId of plan.trackList) {
            const track = this.catalog.getTrack(trackId);
            
            if (!track) {
                errors.push(`Track ${trackId} not found in catalog`);
                continue;
            }

            if (!track.filePath) {
                errors.push(`Track ${trackId} (${track.artist} - ${track.title}) has no file path`);
            } else if (!fs.existsSync(track.filePath)) {
                errors.push(`Track ${trackId} file not found: ${track.filePath}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get file path for a track (absolute or relative)
     * 
     * @param track - Track object
     * @param relative - Use relative paths
     * @param basePath - Base path for relative calculation
     * @returns File path string
     */
    protected getFilePath(track: Track, relative: boolean, basePath: string): string {
        if (!track.filePath) {
            throw new Error(`Track ${track.id} has no file path`);
        }

        if (relative) {
            const baseDir = path.dirname(basePath);
            return path.relative(baseDir, track.filePath);
        }

        return track.filePath;
    }

    /**
     * Ensure file has correct extension
     * 
     * @param filePath - Original file path
     * @param extension - Required extension (with dot)
     * @returns File path with correct extension
     */
    protected ensureExtension(filePath: string, extension: string): string {
        if (!filePath.toLowerCase().endsWith(extension)) {
            return filePath + extension;
        }
        return filePath;
    }

    /**
     * Escape special characters for M3U format
     * 
     * @param text - Text to escape
     * @returns Escaped text
     */
    protected escapeM3U(text: string): string {
        return text.replace(/[\r\n]/g, ' ');
    }

    /**
     * Escape special characters for XML
     * 
     * @param text - Text to escape
     * @returns Escaped text
     */
    protected escapeXML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Escape special characters for CSV
     * 
     * @param text - Text to escape
     * @returns Escaped text
     */
    protected escapeCSV(text: string): string {
        // If text contains comma, quote, or newline, wrap in quotes and escape quotes
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    /**
     * Write content to file
     * 
     * @param outputPath - Path to write to
     * @param content - Content to write
     * @returns Final output path
     */
    protected async writeFile(outputPath: string, content: string): Promise<string> {
        await fs.promises.writeFile(outputPath, content, 'utf-8');
        return outputPath;
    }

    /**
     * Handle export errors consistently
     * 
     * @param error - Error object
     * @returns Export result with error
     */
    protected handleExportError(error: unknown): ExportResult {
        return {
            success: false,
            error: `Export failed: ${(error as Error).message}`,
            tracksExported: 0
        };
    }
}
