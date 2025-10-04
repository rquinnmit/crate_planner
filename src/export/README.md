# CratePilot Export Module

Export your finalized crate plans to Rekordbox and Serato DJ software.

## Supported Formats

### Rekordbox
- **M3U8** (Extended M3U with UTF-8) - Most compatible, widely supported
- **XML** - Rekordbox native format with rich metadata

### Serato
- **M3U8** (Extended M3U with UTF-8) - Most compatible, widely supported
- **CSV** - Serato History format with detailed metadata
- **TXT** - Simple text list for reference

## Quick Start

### Export to Rekordbox

```typescript
import { exportToRekordbox } from './export';
import { CratePlanner } from './core/crate_planner';
import { MusicAssetCatalog } from './core/catalog';

// After creating and finalizing a plan
const catalog = new MusicAssetCatalog();
const planner = new CratePlanner(catalog);
const plan = await planner.createPlan(prompt, seedTracks);
planner.finalize(plan);

// Export to M3U8 (recommended)
const result = await exportToRekordbox(
    plan,
    catalog,
    './exports/my_set.m3u8'
);

console.log(`Exported ${result.tracksExported} tracks to ${result.filePath}`);
```

### Export to Serato

```typescript
import { exportToSerato } from './export';

// Export to M3U8 (recommended)
const result = await exportToSerato(
    plan,
    catalog,
    './exports/my_crate.m3u8'
);

// Or export to CSV for history
const csvResult = await exportToSerato(
    plan,
    catalog,
    './exports/my_crate.csv',
    'csv'
);
```

## Advanced Usage

### Using the Exporter Classes

```typescript
import { RekordboxExporter, SeratoExporter } from './export';

// Rekordbox with custom options
const rekordboxExporter = new RekordboxExporter(catalog);
const result = await rekordboxExporter.export(plan, {
    format: 'xml',
    outputPath: './exports/rekordbox_set.xml',
    playlistName: 'Sunset Vibes',
    includeMetadata: true,
    relativePaths: false
});

// Serato with custom options
const seratoExporter = new SeratoExporter(catalog);
const result = await seratoExporter.export(plan, {
    format: 'csv',
    outputPath: './exports/serato_crate.csv',
    crateName: 'Peak Hour Set',
    includeHeaders: true,
    includeMetadata: true
});
```

### Export to Both Platforms

```typescript
import { UniversalExporter } from './export';

const exporter = new UniversalExporter(catalog);

// Export to both platforms at once
const results = await exporter.exportToBoth(
    plan,
    './exports/my_set',
    {
        playlistName: 'My DJ Set',
        includeMetadata: true
    }
);

console.log('Rekordbox:', results.rekordbox);
console.log('Serato:', results.serato);
```

### Validate Before Export

```typescript
const rekordboxExporter = new RekordboxExporter(catalog);

// Check if all tracks have valid file paths
const validation = rekordboxExporter.validateTracksForExport(plan);

if (!validation.valid) {
    console.error('Export validation failed:');
    validation.errors.forEach(err => console.error(`  - ${err}`));
} else {
    const result = await rekordboxExporter.export(plan, options);
}
```

### Export Multiple Plans

```typescript
const rekordboxExporter = new RekordboxExporter(catalog);

const results = await rekordboxExporter.exportMultiple(
    [plan1, plan2, plan3],
    {
        format: 'm3u8',
        includeMetadata: true
    }
);

results.forEach((result, i) => {
    console.log(`Plan ${i + 1}: ${result.success ? 'Success' : 'Failed'}`);
});
```

## Import into DJ Software

### Rekordbox
1. Open Rekordbox
2. Go to **File > Import > Playlist**
3. Select your exported `.m3u8` or `.xml` file
4. The playlist will appear in your collection

### Serato DJ
1. Open Serato DJ
2. Drag and drop the `.m3u8` file into Serato
3. Or use **File > Import** and select the file
4. The crate will appear in your crates panel

## File Path Requirements

**Important:** All tracks must have valid `filePath` properties pointing to actual audio files on your system. The exporters will:

1. Validate that all tracks have file paths
2. Check that files exist (optional)
3. Use absolute or relative paths based on your configuration

### Setting File Paths

```typescript
import { Track } from './core/track';

const track: Track = {
    id: 'track-001',
    artist: 'Artist Name',
    title: 'Track Title',
    bpm: 128,
    key: '8A',
    duration_sec: 360,
    filePath: '/Users/dj/Music/Artist Name/Track Title.mp3' // Required!
};

catalog.addTrack(track);
```

## Export Options Reference

### RekordboxExportOptions
```typescript
{
    format: 'm3u8' | 'xml',           // Export format
    outputPath: string,                // Where to save the file
    playlistName?: string,             // Name of the playlist
    includeMetadata?: boolean,         // Include BPM, key, etc.
    relativePaths?: boolean            // Use relative vs absolute paths
}
```

### SeratoExportOptions
```typescript
{
    format: 'm3u8' | 'csv' | 'txt',   // Export format
    outputPath: string,                // Where to save the file
    crateName?: string,                // Name of the crate
    includeHeaders?: boolean,          // For CSV: include column headers
    includeMetadata?: boolean,         // Include BPM, key, etc.
    relativePaths?: boolean            // Use relative vs absolute paths
}
```

## Troubleshooting

### "Track has no file path" Error
Make sure all tracks in your catalog have the `filePath` property set:
```typescript
track.filePath = '/path/to/audio/file.mp3';
```

### "Cannot export non-finalized plan" Error
Finalize your plan before exporting:
```typescript
planner.finalize(plan);
```

### Tracks Not Loading in DJ Software
- Verify file paths are correct and files exist
- Use absolute paths if relative paths aren't working
- Check that audio file formats are supported by your DJ software
- Ensure file permissions allow reading the audio files

## Best Practices

1. **Always finalize plans** before exporting
2. **Validate tracks** before export using `validateTracksForExport()`
3. **Use M3U8 format** for maximum compatibility
4. **Include metadata** for better organization in DJ software
5. **Use absolute paths** unless you're sure relative paths will work
6. **Test imports** in your DJ software to verify compatibility

## Future Enhancements

- Binary `.crate` format support for Serato (with cue points and loops)
- Rekordbox `.pdb` database export for USB drives
- Traktor `.nml` format support
- Virtual DJ XML format support
- Auto-detection of DJ software library locations
