/**
 * Serato Exporter
 * 
 * Exports CratePilot plans to Serato-compatible formats:
 * - M3U8 (Extended M3U with UTF-8 encoding) - most compatible
 * - CSV (Serato History format) - includes detailed metadata
 * - TXT (Simple text list) - basic format
 * 
 * These formats can be imported into Serato DJ via:
 * - M3U8: Drag and drop into Serato or use File > Import
 * - CSV: Can be opened in History panel
 * - TXT: Manual import
 */

import { CratePlan } from '../core/crate_planner';
import { Track } from '../core/track';
import { MusicAssetCatalog } from '../core/catalog';
import { formatMMSS } from '../utils/time_formatters';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export options for Serato
 */
export interface SeratoExportOptions {
    format: 'm3u8' | 'csv' | 'txt';
    outputPath: string;
    crateName?: string;
    includeHeaders?: boolean; // For CSV format
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
 * SeratoExporter class - handles crate export to Serato formats
 */
export class SeratoExporter {
    private catalog: MusicAssetCatalog;

    constructor(catalog: MusicAssetCatalog) {
        this.catalog = catalog;
    }

    /**
     * Export a crate plan to Serato format
     * 
     * @param plan - The finalized crate plan to export
     * @param options - Export configuration options
     * @returns Export result with success status and file path
     */
    async export(plan: CratePlan, options: SeratoExportOptions): Promise<ExportResult> {
        try {
            // Validate plan
            if (!plan.isFinalized) {
                return {
                    success: false,
                    error: 'Cannot export non-finalized plan. Call finalize() first.',
                    tracksExported: 0
                };
            }

            // Get track objects
            const tracks = plan.trackList
                .map(id => this.catalog.getTrack(id))
                .filter((track): track is Track => track !== undefined);

            if (tracks.length === 0) {
                return {
                    success: false,
                    error: 'No valid tracks found in plan',
                    tracksExported: 0
                };
            }

            // Export based on format
            let filePath: string;
            switch (options.format) {
                case 'm3u8':
                    filePath = await this.exportM3U8(tracks, options);
                    break;
                case 'csv':
                    filePath = await this.exportCSV(tracks, options);
                    break;
                case 'txt':
                    filePath = await this.exportTXT(tracks, options);
                    break;
            }

            return {
                success: true,
                filePath,
                tracksExported: tracks.length
            };
        } catch (error) {
            return {
                success: false,
                error: `Export failed: ${(error as Error).message}`,
                tracksExported: 0
            };
        }
    }

    /**
     * Export to M3U8 format (Extended M3U with UTF-8)
     * This is the most compatible format for Serato
     */
    private async exportM3U8(tracks: Track[], options: SeratoExportOptions): Promise<string> {
        const crateName = options.crateName || 'CratePilot Crate';
        let content = '#EXTM3U\n';
        content += `#PLAYLIST:${crateName}\n\n`;

        for (const track of tracks) {
            // Add extended info line
            const duration = Math.floor(track.duration_sec);
            const artist = this.escapeM3U(track.artist);
            const title = this.escapeM3U(track.title);
            
            content += `#EXTINF:${duration},${artist} - ${title}\n`;

            // Add Serato-specific metadata if requested
            if (options.includeMetadata) {
                content += `#EXTALB:${this.escapeM3U(track.album || '')}\n`;
                content += `#EXTGENRE:${this.escapeM3U(track.genre || '')}\n`;
                content += `#EXTBPM:${track.bpm}\n`;
                content += `#EXTKEY:${track.key}\n`;
                if (track.energy) {
                    content += `#EXTENERGY:${track.energy}\n`;
                }
            }

            // Add file path
            const filePath = this.getFilePath(track, options.relativePaths || false, options.outputPath);
            content += `${filePath}\n\n`;
        }

        // Write to file
        const outputPath = this.ensureExtension(options.outputPath, '.m3u8');
        await fs.promises.writeFile(outputPath, content, 'utf-8');
        
        return outputPath;
    }

    /**
     * Export to CSV format (Serato History format)
     * Compatible with Serato's history export/import
     */
    private async exportCSV(tracks: Track[], options: SeratoExportOptions): Promise<string> {
        let content = '';

        // Add headers if requested
        if (options.includeHeaders !== false) {
            content += 'name,artist,album,genre,bpm,key,duration,energy,location\n';
        }

        // Add track rows
        for (const track of tracks) {
            const row = [
                this.escapeCSV(track.title),
                this.escapeCSV(track.artist),
                this.escapeCSV(track.album || ''),
                this.escapeCSV(track.genre || ''),
                track.bpm.toString(),
                track.key,
                this.formatDuration(track.duration_sec),
                track.energy?.toString() || '',
                this.escapeCSV(this.getFilePath(track, options.relativePaths || false, options.outputPath))
            ];
            content += row.join(',') + '\n';
        }

        // Write to file
        const outputPath = this.ensureExtension(options.outputPath, '.csv');
        await fs.promises.writeFile(outputPath, content, 'utf-8');
        
        return outputPath;
    }

    /**
     * Export to TXT format (Simple text list)
     * Basic format showing track order
     */
    private async exportTXT(tracks: Track[], options: SeratoExportOptions): Promise<string> {
        const crateName = options.crateName || 'CratePilot Crate';
        let content = `${crateName}\n`;
        content += '='.repeat(crateName.length) + '\n\n';

        tracks.forEach((track, index) => {
            const num = (index + 1).toString().padStart(3, '0');
            content += `${num}. ${track.artist} - ${track.title}\n`;
            
            if (options.includeMetadata) {
                content += `     Album: ${track.album || 'N/A'}\n`;
                content += `     Genre: ${track.genre || 'N/A'}\n`;
                content += `     BPM: ${track.bpm} | Key: ${track.key} | Duration: ${this.formatDuration(track.duration_sec)}\n`;
                if (track.energy) {
                    content += `     Energy: ${track.energy}/5\n`;
                }
                content += `     File: ${this.getFilePath(track, options.relativePaths || false, options.outputPath)}\n`;
            }
            content += '\n';
        });

        // Add summary
        const totalDuration = tracks.reduce((sum, t) => sum + t.duration_sec, 0);
        content += `\nTotal Tracks: ${tracks.length}\n`;
        content += `Total Duration: ${this.formatDuration(totalDuration)}\n`;

        // Write to file
        const outputPath = this.ensureExtension(options.outputPath, '.txt');
        await fs.promises.writeFile(outputPath, content, 'utf-8');
        
        return outputPath;
    }

    /**
     * Get file path for a track (absolute or relative)
     */
    private getFilePath(track: Track, relative: boolean, basePath: string): string {
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
     * Format duration as MM:SS
     * Uses centralized time formatter
     */
    private formatDuration(seconds: number): string {
        return formatMMSS(seconds);
    }

    /**
     * Escape special characters for M3U format
     */
    private escapeM3U(text: string): string {
        return text.replace(/[\r\n]/g, ' ');
    }

    /**
     * Escape special characters for CSV
     */
    private escapeCSV(text: string): string {
        // If text contains comma, quote, or newline, wrap in quotes and escape quotes
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    /**
     * Ensure file has correct extension
     */
    private ensureExtension(filePath: string, extension: string): string {
        if (!filePath.toLowerCase().endsWith(extension)) {
            return filePath + extension;
        }
        return filePath;
    }

    /**
     * Export multiple plans as a collection
     * Creates separate files for each plan
     */
    async exportMultiple(
        plans: CratePlan[],
        baseOptions: Omit<SeratoExportOptions, 'outputPath' | 'crateName'>
    ): Promise<ExportResult[]> {
        const results: ExportResult[] = [];

        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            const crateName = `CratePilot Crate ${i + 1}`;
            const outputPath = `./exports/serato_crate_${i + 1}.${baseOptions.format}`;

            const result = await this.export(plan, {
                ...baseOptions,
                outputPath,
                crateName
            });

            results.push(result);
        }

        return results;
    }

    /**
     * Validate that all tracks have file paths before export
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
     * Export with Serato-specific cue points and loops (advanced feature)
     * Note: This requires binary .crate file format which is more complex
     * For now, this is a placeholder for future implementation
     */
    async exportWithCuePoints(
        plan: CratePlan,
        cuePoints: Map<string, number[]>,
        options: SeratoExportOptions
    ): Promise<ExportResult> {
        // TODO: Implement binary .crate format with cue points
        // For now, fall back to standard export
        console.warn('Cue point export not yet implemented. Exporting without cue points.');
        return this.export(plan, options);
    }
}

/**
 * Quick export function for convenience
 * 
 * @param plan - Crate plan to export
 * @param catalog - Music catalog
 * @param outputPath - Where to save the file
 * @param format - Export format (default: m3u8)
 * @returns Export result
 */
export async function exportToSerato(
    plan: CratePlan,
    catalog: MusicAssetCatalog,
    outputPath: string,
    format: 'm3u8' | 'csv' | 'txt' = 'm3u8'
): Promise<ExportResult> {
    const exporter = new SeratoExporter(catalog);
    return exporter.export(plan, {
        format,
        outputPath,
        includeMetadata: true,
        relativePaths: false
    });
}
