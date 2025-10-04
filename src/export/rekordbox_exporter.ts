/**
 * Rekordbox Exporter
 * 
 * Exports CratePilot plans to Rekordbox-compatible formats:
 * - M3U8 (Extended M3U with UTF-8 encoding) - widely supported
 * - XML (Rekordbox playlist format) - provides rich metadata
 * 
 * These formats can be imported into Rekordbox via:
 * File > Import > Playlist > [Select M3U8/XML file]
 */

import { CratePlan } from '../core/crate_planner';
import { Track } from '../core/track';
import { MusicAssetCatalog } from '../core/catalog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export options for Rekordbox
 */
export interface RekordboxExportOptions {
    format: 'm3u8' | 'xml';
    outputPath: string;
    playlistName?: string;
    includeMetadata?: boolean;
    relativePaths?: boolean; // Use relative paths instead of absolute
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
 * RekordboxExporter class - handles playlist export to Rekordbox formats
 */
export class RekordboxExporter {
    private catalog: MusicAssetCatalog;

    constructor(catalog: MusicAssetCatalog) {
        this.catalog = catalog;
    }

    /**
     * Export a crate plan to Rekordbox format
     * 
     * @param plan - The finalized crate plan to export
     * @param options - Export configuration options
     * @returns Export result with success status and file path
     */
    async export(plan: CratePlan, options: RekordboxExportOptions): Promise<ExportResult> {
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
            if (options.format === 'm3u8') {
                filePath = await this.exportM3U8(tracks, options);
            } else {
                filePath = await this.exportXML(tracks, options);
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
     * Format: https://en.wikipedia.org/wiki/M3U
     */
    private async exportM3U8(tracks: Track[], options: RekordboxExportOptions): Promise<string> {
        const playlistName = options.playlistName || 'CratePilot Playlist';
        let content = '#EXTM3U\n';
        content += `#PLAYLIST:${playlistName}\n\n`;

        for (const track of tracks) {
            // Add extended info line
            const duration = Math.floor(track.duration_sec);
            const artist = this.escapeM3U(track.artist);
            const title = this.escapeM3U(track.title);
            
            content += `#EXTINF:${duration},${artist} - ${title}\n`;

            // Add metadata if requested
            if (options.includeMetadata) {
                content += `#EXTALB:${this.escapeM3U(track.album || 'Unknown Album')}\n`;
                content += `#EXTGENRE:${this.escapeM3U(track.genre || 'Unknown')}\n`;
                content += `#EXTBPM:${track.bpm}\n`;
                content += `#EXTKEY:${track.key}\n`;
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
     * Export to Rekordbox XML format
     * Based on Rekordbox playlist XML structure
     */
    private async exportXML(tracks: Track[], options: RekordboxExportOptions): Promise<string> {
        const playlistName = this.escapeXML(options.playlistName || 'CratePilot Playlist');
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<DJ_PLAYLISTS Version="1.0.0">\n';
        xml += '  <PRODUCT Name="CratePilot" Version="1.0.0" Company="CratePilot"/>\n';
        xml += '  <COLLECTION Entries="' + tracks.length + '">\n';

        // Add track entries
        tracks.forEach((track, index) => {
            const trackId = index + 1;
            const filePath = this.escapeXML(this.getFilePath(track, options.relativePaths || false, options.outputPath));
            
            xml += `    <TRACK TrackID="${trackId}" Name="${this.escapeXML(track.title)}" `;
            xml += `Artist="${this.escapeXML(track.artist)}" `;
            xml += `Album="${this.escapeXML(track.album || '')}" `;
            xml += `Genre="${this.escapeXML(track.genre || '')}" `;
            xml += `Kind="MP3 File" `;
            xml += `TotalTime="${track.duration_sec}" `;
            xml += `Year="${track.year || ''}" `;
            xml += `AverageBpm="${track.bpm}" `;
            xml += `Tonality="${track.key}" `;
            xml += `Label="${this.escapeXML(track.label || '')}" `;
            xml += `Location="${filePath}"/>\n`;
        });

        xml += '  </COLLECTION>\n';
        xml += '  <PLAYLISTS>\n';
        xml += `    <NODE Type="0" Name="ROOT">\n`;
        xml += `      <NODE Name="${playlistName}" Type="1" KeyType="0" Entries="${tracks.length}">\n`;

        // Add track references
        tracks.forEach((track, index) => {
            const trackId = index + 1;
            xml += `        <TRACK Key="${trackId}"/>\n`;
        });

        xml += '      </NODE>\n';
        xml += '    </NODE>\n';
        xml += '  </PLAYLISTS>\n';
        xml += '</DJ_PLAYLISTS>\n';

        // Write to file
        const outputPath = this.ensureExtension(options.outputPath, '.xml');
        await fs.promises.writeFile(outputPath, xml, 'utf-8');
        
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
     * Escape special characters for M3U format
     */
    private escapeM3U(text: string): string {
        return text.replace(/[\r\n]/g, ' ');
    }

    /**
     * Escape special characters for XML
     */
    private escapeXML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
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
        baseOptions: Omit<RekordboxExportOptions, 'outputPath' | 'playlistName'>
    ): Promise<ExportResult[]> {
        const results: ExportResult[] = [];

        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            const playlistName = `CratePilot Plan ${i + 1}`;
            const outputPath = `./exports/rekordbox_plan_${i + 1}.${baseOptions.format}`;

            const result = await this.export(plan, {
                ...baseOptions,
                outputPath,
                playlistName
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
export async function exportToRekordbox(
    plan: CratePlan,
    catalog: MusicAssetCatalog,
    outputPath: string,
    format: 'm3u8' | 'xml' = 'm3u8'
): Promise<ExportResult> {
    const exporter = new RekordboxExporter(catalog);
    return exporter.export(plan, {
        format,
        outputPath,
        includeMetadata: true,
        relativePaths: false
    });
}
