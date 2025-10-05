# Import Module

Import track data from external music APIs into your CratePilot catalog.

## Available Importers

### Spotify Importer

Import comprehensive track metadata from Spotify Web API, including:
- **Basic metadata**: Artist, title, album, year, duration
- **Audio features**: BPM, key (converted to Camelot), energy (1-5 scale)
- **Audio analysis**: Track sections for phrase-aware mixing

#### Setup

1. **Get Spotify API Credentials**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Copy your Client ID and Client Secret

2. **Store Credentials Securely**
   ```bash
   # Environment variables (recommended)
   export SPOTIFY_CLIENT_ID="your_client_id"
   export SPOTIFY_CLIENT_SECRET="your_client_secret"
   ```

#### Basic Usage

```typescript
import { MusicAssetCatalog } from '../core/catalog';
import { SpotifyImporter } from '../import/spotify_importer';

// Initialize catalog
const catalog = new MusicAssetCatalog();

// Create importer
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// Search and import tracks
const result = await importer.searchAndImport('genre:techno BPM:128', 20);
console.log(`Imported ${result.tracksImported} tracks`);
```

#### Import Methods

##### 1. Search and Import
Search Spotify's catalog and import matching tracks:

```typescript
const result = await importer.searchAndImport('artist:Daft Punk', 20);
```

Search query examples:
- `"artist:Daft Punk"` - Tracks by specific artist
- `"genre:techno"` - Tracks in a genre
- `"year:2023"` - Tracks from a specific year
- `"track:One More Time artist:Daft Punk"` - Specific track

##### 2. Import by Spotify IDs
Import specific tracks when you know their Spotify IDs:

```typescript
const trackIds = [
    '3n3Ppam7vgaVa1iaRUc9Lp',
    '0VjIjW4GlUZAMYd2vXMi3b'
];
const result = await importer.importByIds(trackIds);
```

Supports batch imports (up to 50 tracks per request).

##### 3. Import from Playlist
Import all tracks from a Spotify playlist:

```typescript
const playlistId = '37i9dQZEVXbMDoHDwVN2tF'; // Spotify Top 50
const result = await importer.importFromPlaylist(playlistId, 50);
```

##### 4. Get Audio Analysis (Advanced)
Fetch detailed section analysis for phrase-aware mixing:

```typescript
const analysis = await importer.getAudioAnalysis(trackId);
if (analysis) {
    console.log(`Track has ${analysis.sections.length} sections`);
}
```

#### Data Mapping

| Spotify Field | CratePilot Field | Notes |
|--------------|------------------|-------|
| `name` | `title` | Track title |
| `artists[0].name` | `artist` | Primary artist (or comma-separated list) |
| `album.name` | `album` | Album name |
| `album.release_date` | `year` | Extracted from YYYY-MM-DD |
| `duration_ms` | `duration_sec` | Converted to seconds |
| `tempo` | `bpm` | Rounded to integer |
| `key` + `mode` | `key` | Converted to Camelot notation |
| `energy` | `energy` | Scaled from 0-1 to 1-5 |
| `sections` | `sections` | Optional, from audio analysis |

#### Key Conversion

Spotify uses numeric keys (0-11) and modes (0=minor, 1=major). These are automatically converted to Camelot notation:

```typescript
import { spotifyKeyToCamelot } from '../import/spotify_key_converter';

// Spotify: key=0, mode=1 (C major)
const camelot = spotifyKeyToCamelot(0, 1); // Returns '8B'

// Spotify: key=9, mode=0 (A minor)
const camelot = spotifyKeyToCamelot(9, 0); // Returns '8A'
```

#### Rate Limiting

The importer includes built-in rate limiting:

```typescript
const importer = new SpotifyImporter(catalog, {
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    baseURL: 'https://api.spotify.com/v1',
    rateLimit: {
        requestsPerSecond: 10,
        requestsPerMinute: 180,
        retryAttempts: 3,
        retryDelayMs: 1000
    }
});
```

Default limits:
- 10 requests per second
- 180 requests per minute
- 3 retry attempts with 1s delay

#### Authentication

The importer uses **Client Credentials Flow** (server-to-server):
- Automatically requests and refreshes access tokens
- No user interaction required
- Suitable for batch imports and background jobs

Token management is handled automatically:

```typescript
// Token is automatically refreshed when expired
await importer.searchAndImport('query', 20);

// Get current token (for debugging)
const token = importer.getAccessToken();
```

#### Error Handling

All import methods return an `ImportResult` object:

```typescript
interface ImportResult {
    success: boolean;
    tracksImported: number;
    tracksFailed: number;
    errors: string[];
    warnings: string[];
}
```

Example error handling:

```typescript
const result = await importer.searchAndImport('artist:Unknown', 10);

if (!result.success) {
    console.error('Import failed:', result.errors);
}

if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
}

console.log(`Successfully imported ${result.tracksImported} tracks`);
```

#### Examples

See `examples/spotify_import_example.ts` for comprehensive examples:
- Basic search and import
- Import by specific IDs
- Import from playlists
- Audio analysis with sections
- Building genre-specific catalogs
- Error handling

Run examples:
```bash
npm run example:spotify
```

## Base Importer

All importers extend `BaseImporter`, which provides:
- Rate limiting
- Request throttling
- Error handling
- Track normalization
- Batch import utilities

### Creating Custom Importers

To create an importer for another API:

```typescript
import { BaseImporter, APIConfig, ImportResult, ExternalTrackData } from './base_importer';

export class MyAPIImporter extends BaseImporter {
    async searchAndImport(query: string, limit?: number): Promise<ImportResult> {
        // Implement search logic
    }

    async importById(externalId: string): Promise<ImportResult> {
        // Implement single track import
    }

    protected normalizeTrack(externalData: ExternalTrackData): Track | null {
        // Convert API data to Track format
    }
}
```

## Utilities

### Spotify Key Converter

Spotify-specific key conversion:

```typescript
import { 
    spotifyKeyToCamelot,
    camelotToSpotifyKey,
    spotifyKeyToStandard,
    getCompatibleKeys
} from './spotify_key_converter';

// Convert to Camelot
const camelot = spotifyKeyToCamelot(0, 1); // '8B' (C major)

// Get compatible keys for mixing
const compatible = getCompatibleKeys(0, 1); // ['8B', '9B', '7B', '8A']

// Convert to standard notation
const standard = spotifyKeyToStandard(0, 1); // 'C major'
```

## Best Practices

1. **Store credentials securely** - Use environment variables, never commit secrets
2. **Respect rate limits** - Configure appropriate throttling for your use case
3. **Handle errors gracefully** - Check `ImportResult` and handle failures
4. **Batch operations** - Use batch methods (`importByIds`, `importFromPlaylist`) for efficiency
5. **Cache results** - Avoid re-importing the same tracks (use `catalog.hasTrack()`)
6. **Monitor usage** - Track request counts with `importer.getRequestCount()`

## Troubleshooting

### Authentication Errors

```
Error: Failed to get Spotify access token: 401 Unauthorized
```

**Solution**: Verify your Client ID and Client Secret are correct.

### Rate Limit Errors

```
Error: API request failed: 429 Too Many Requests
```

**Solution**: Reduce `requestsPerSecond` or `requestsPerMinute` in rate limit config.

### No Tracks Found

```
Warning: No tracks found for query
```

**Solution**: Refine your search query or check Spotify's search syntax.

### Missing Audio Features

Some tracks may not have audio features (BPM, key, energy). These tracks will be skipped during import with a warning.

## API Documentation

- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api)
- [Spotify Search Guide](https://developer.spotify.com/documentation/web-api/reference/search)
- [Audio Features](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- [Audio Analysis](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis)
