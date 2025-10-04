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
import { BaseExporter, ExportResult } from './base_exporter';

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

// Re-export ExportResult for convenience
export { ExportResult };

/**
 * SeratoExporter class - handles crate export to Serato formats
 */
export class SeratoExporter extends BaseExporter {
    constructor(catalog: MusicAssetCatalog) {
        super(catalog);
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
            // Validate plan using base class
            const validationError = this.validatePlanForExport(plan);
            if (validationError) return validationError;

            // Get track objects
            const tracks = this.getTracksFromPlan(plan);

            // Export based on format
            let filePath: string;
            switch (options.format) {
                case 'm3u8':
                    filePath = await this._exportM3U8(tracks, {
                        outputPath: options.outputPath,
                        playlistName: options.crateName || 'CratePilot Crate',
                        includeMetadata: options.includeMetadata,
                        relativePaths: options.relativePaths
                    });
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
            return this.handleExportError(error);
        }
    }

    /**
     * Get platform-specific M3U metadata for Serato
     */
    protected getM3UExtraMetadata(track: Track): string {
        const metadata = super.getM3UExtraMetadata(track);
        if (track.energy) {
            return metadata + `#EXTENERGY:${track.energy}\n`;
        }
        return metadata;
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
        return this.writeFile(outputPath, content);
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
        return this.writeFile(outputPath, content);
    }

    /**
     * Format duration as MM:SS
     * Uses centralized time formatter
     */
    private formatDuration(seconds: number): string {
        return formatMMSS(seconds);
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
