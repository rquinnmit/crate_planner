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
import { BaseExporter, ExportResult, M3U8ExportOptions } from './base_exporter';

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

// Re-export ExportResult for convenience
export { ExportResult };

/**
 * RekordboxExporter class - handles playlist export to Rekordbox formats
 */
export class RekordboxExporter extends BaseExporter {
    constructor(catalog: MusicAssetCatalog) {
        super(catalog);
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
            // Validate plan using base class
            const validationError = this.validatePlanForExport(plan);
            if (validationError) return validationError;

            // Get track objects
            const tracks = this.getTracksFromPlan(plan);

            // Export based on format
            let filePath: string;
            if (options.format === 'm3u8') {
                filePath = await this._exportM3U8(tracks, {
                    outputPath: options.outputPath,
                    playlistName: options.playlistName || 'CratePilot Playlist',
                    includeMetadata: options.includeMetadata,
                    relativePaths: options.relativePaths
                });
            } else {
                filePath = await this.exportXML(tracks, options);
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
     * Get platform-specific M3U metadata for Rekordbox
     */
    protected getM3UExtraMetadata(track: Track): string {
        let metadata = '';
        metadata += `#EXTALB:${this.escapeM3U(track.album || 'Unknown Album')}\n`;
        metadata += `#EXTGENRE:${this.escapeM3U(track.genre || 'Unknown')}\n`;
        metadata += `#EXTBPM:${track.bpm}\n`;
        metadata += `#EXTKEY:${track.key}\n`;
        return metadata;
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
        return this.writeFile(outputPath, xml);
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
