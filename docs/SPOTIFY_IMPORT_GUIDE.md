# Spotify Import Guide

Complete guide to importing track data from Spotify Web API into CratePilot.

## Quick Start

### 1. Get Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the form:
   - **App name**: "CratePilot" (or your choice)
   - **App description**: "DJ crate planning tool"
   - **Redirect URI**: `http://localhost:3000` (not used for Client Credentials flow)
   - **API**: Check "Web API"
5. Click **"Save"**
6. Copy your **Client ID** and **Client Secret**

### 2. Set Environment Variables

```bash
# Linux/Mac
export SPOTIFY_CLIENT_ID="your_client_id_here"
export SPOTIFY_CLIENT_SECRET="your_client_secret_here"

# Windows PowerShell
$env:SPOTIFY_CLIENT_ID="your_client_id_here"
$env:SPOTIFY_CLIENT_SECRET="your_client_secret_here"

# Windows Command Prompt
set SPOTIFY_CLIENT_ID=your_client_id_here
set SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 3. Basic Import

```typescript
import { MusicAssetCatalog } from './src/core/catalog';
import { SpotifyImporter } from './src/import/spotify_importer';

// Initialize
const catalog = new MusicAssetCatalog();
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// Import tracks
const result = await importer.searchAndImport('genre:techno', 20);
console.log(`Imported ${result.tracksImported} tracks`);
```

## Import Methods

### Search and Import

Search Spotify's catalog by query:

```typescript
// By genre
await importer.searchAndImport('genre:techno', 20);

// By artist
await importer.searchAndImport('artist:Daft Punk', 50);

// By year
await importer.searchAndImport('year:2023', 30);

// Combined search
await importer.searchAndImport('genre:house year:2023', 25);

// Specific track
await importer.searchAndImport('track:One More Time artist:Daft Punk', 1);
```

**Spotify Search Operators:**
- `artist:` - Search by artist name
- `track:` - Search by track name
- `album:` - Search by album name
- `genre:` - Search by genre
- `year:` - Search by year (YYYY)
- `isrc:` - Search by ISRC code

### Import by IDs

Import specific tracks when you know their Spotify IDs:

```typescript
const trackIds = [
    '3n3Ppam7vgaVa1iaRUc9Lp', // Mr. Brightside - The Killers
    '0VjIjW4GlUZAMYd2vXMi3b'  // Blinding Lights - The Weeknd
];

const result = await importer.importByIds(trackIds);
```

**Finding Spotify IDs:**
1. Open track in Spotify app/web
2. Click "Share" → "Copy Song Link"
3. Extract ID from URL: `https://open.spotify.com/track/{ID}`

### Import from Playlist

Import all tracks from a public or private playlist:

```typescript
// Public playlist
const playlistId = '37i9dQZEVXbMDoHDwVN2tF'; // Top 50 Global
await importer.importFromPlaylist(playlistId);

// Limit number of tracks
await importer.importFromPlaylist(playlistId, 50);
```

**Finding Playlist IDs:**
1. Open playlist in Spotify
2. Click "Share" → "Copy Playlist Link"
3. Extract ID from URL: `https://open.spotify.com/playlist/{ID}`

## Data Fields

### What You Get

Every imported track includes:

| Field | Type | Source | Example |
|-------|------|--------|---------|
| `id` | string | Generated | `spotify-3n3Ppam7vgaVa1iaRUc9Lp` |
| `artist` | string | Spotify | `Daft Punk` |
| `title` | string | Spotify | `One More Time` |
| `album` | string | Spotify | `Discovery` |
| `year` | number | Spotify | `2001` |
| `duration_sec` | number | Spotify | `320` |
| `bpm` | number | Audio Features | `123` |
| `key` | CamelotKey | Audio Features | `9A` |
| `energy` | 1-5 | Audio Features | `4` |
| `genre` | string? | Not available | `undefined` |

### Audio Features

Spotify provides rich audio analysis:

```typescript
// Automatically included in import
const track = catalog.getTrack('spotify-3n3Ppam7vgaVa1iaRUc9Lp');
console.log(`BPM: ${track.bpm}`);        // 123
console.log(`Key: ${track.key}`);        // 9A (E minor)
console.log(`Energy: ${track.energy}/5`); // 4/5
```

**Energy Scale Conversion:**
- Spotify: 0.0 - 1.0 (float)
- CratePilot: 1 - 5 (integer)
- Mapping: `Math.ceil(spotify_energy * 5)`

### Audio Analysis (Advanced)

Get detailed section analysis for phrase-aware mixing:

```typescript
// Fetch analysis separately (API intensive)
const analysis = await importer.getAudioAnalysis(trackId);

if (analysis) {
    analysis.sections.forEach(section => {
        console.log(`Section: ${section.start}s - ${section.start + section.duration}s`);
        console.log(`  Loudness: ${section.loudness} dB`);
        console.log(`  Tempo: ${section.tempo} BPM`);
        console.log(`  Key: ${section.key}`);
    });
}
```

**Note:** Audio analysis is not included by default due to API rate limits. Call `getAudioAnalysis()` only when needed.

## Key Conversion

Spotify uses numeric keys (0-11) and modes (0=minor, 1=major). CratePilot automatically converts these to Camelot notation for harmonic mixing.

### Conversion Table

| Spotify Key | Spotify Mode | Standard | Camelot |
|-------------|--------------|----------|---------|
| 0 | 0 | C minor | 5A |
| 0 | 1 | C major | 8B |
| 1 | 0 | C#/Db minor | 12A |
| 1 | 1 | C#/Db major | 3B |
| 2 | 0 | D minor | 7A |
| 2 | 1 | D major | 10B |
| 3 | 0 | D#/Eb minor | 2A |
| 3 | 1 | D#/Eb major | 5B |
| 4 | 0 | E minor | 9A |
| 4 | 1 | E major | 12B |
| 5 | 0 | F minor | 4A |
| 5 | 1 | F major | 7B |
| 6 | 0 | F#/Gb minor | 11A |
| 6 | 1 | F#/Gb major | 2B |
| 7 | 0 | G minor | 6A |
| 7 | 1 | G major | 9B |
| 8 | 0 | G#/Ab minor | 1A |
| 8 | 1 | G#/Ab major | 4B |
| 9 | 0 | A minor | 8A |
| 9 | 1 | A major | 11B |
| 10 | 0 | A#/Bb minor | 3A |
| 10 | 1 | A#/Bb major | 6B |
| 11 | 0 | B minor | 10A |
| 11 | 1 | B major | 1B |

### Manual Conversion

```typescript
import { spotifyKeyToCamelot, getCompatibleKeys } from './src/import/spotify_key_converter';

// Convert key
const camelot = spotifyKeyToCamelot(9, 0); // '8A' (A minor)

// Find compatible keys for mixing
const compatible = getCompatibleKeys(9, 0);
// Returns: ['8A', '9A', '7A', '8B']
```

## Rate Limiting

### Default Limits

```typescript
{
    requestsPerSecond: 10,
    requestsPerMinute: 180,
    retryAttempts: 3,
    retryDelayMs: 1000
}
```

### Custom Rate Limits

```typescript
const importer = new SpotifyImporter(catalog, {
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    baseURL: 'https://api.spotify.com/v1',
    rateLimit: {
        requestsPerSecond: 5,  // Slower rate
        requestsPerMinute: 100,
        retryAttempts: 5,      // More retries
        retryDelayMs: 2000     // Longer delay
    }
});
```

### Monitoring Usage

```typescript
// Get request count
const count = importer.getRequestCount();
console.log(`Made ${count} requests`);

// Reset counter
importer.resetRequestCount();
```

## Error Handling

### Import Result

All methods return an `ImportResult`:

```typescript
interface ImportResult {
    success: boolean;
    tracksImported: number;
    tracksFailed: number;
    errors: string[];
    warnings: string[];
}
```

### Example

```typescript
const result = await importer.searchAndImport('artist:Unknown', 10);

if (!result.success) {
    console.error('Import failed!');
    result.errors.forEach(err => console.error(`  - ${err}`));
}

if (result.warnings.length > 0) {
    console.warn('Warnings:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
}

console.log(`✓ Imported: ${result.tracksImported}`);
console.log(`✗ Failed: ${result.tracksFailed}`);
```

### Common Errors

#### Authentication Failed

```
Error: Failed to get Spotify access token: 401 Unauthorized
```

**Solution:**
- Verify Client ID and Client Secret
- Check credentials are not expired
- Ensure no extra spaces in environment variables

#### Rate Limit Exceeded

```
Error: API request failed: 429 Too Many Requests
```

**Solution:**
- Reduce `requestsPerSecond` in config
- Add delays between large imports
- Use batch methods (`importByIds`, `importFromPlaylist`)

#### Track Not Found

```
Error: API request failed: 404 Not Found
```

**Solution:**
- Verify track/playlist ID is correct
- Check if track is available in your region
- Ensure track hasn't been removed from Spotify

#### No Audio Features

```
Warning: Could not normalize track: Artist - Title
```

**Cause:** Some tracks don't have audio features (BPM, key, energy).

**Solution:** These tracks are automatically skipped. This is normal for:
- Very new releases
- Podcasts
- Audiobooks
- Some classical music

## Best Practices

### 1. Batch Operations

Use batch methods for efficiency:

```typescript
// ✅ Good - Single request for 50 tracks
await importer.importByIds(arrayOf50Ids);

// ❌ Bad - 50 separate requests
for (const id of arrayOf50Ids) {
    await importer.importById(id);
}
```

### 2. Check for Duplicates

Avoid re-importing tracks:

```typescript
const trackId = 'spotify-3n3Ppam7vgaVa1iaRUc9Lp';

if (!catalog.hasTrack(trackId)) {
    await importer.importById(trackId);
} else {
    console.log('Track already in catalog');
}
```

### 3. Handle Partial Failures

```typescript
const result = await importer.importByIds(largeArrayOfIds);

// Some tracks may fail, but others succeed
console.log(`Imported ${result.tracksImported}/${largeArrayOfIds.length} tracks`);

// Continue with what you got
const tracks = catalog.getAllTracks();
```

### 4. Save Credentials Securely

```typescript
// ✅ Good - Environment variables
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// ❌ Bad - Hard-coded credentials
const importer = new SpotifyImporter(catalog, {
    clientId: 'abc123...',  // Never do this!
    clientSecret: 'xyz789...',
    baseURL: 'https://api.spotify.com/v1'
});
```

### 5. Use Audio Analysis Sparingly

```typescript
// ✅ Good - Only when needed
const importantTrackId = 'spotify-3n3Ppam7vgaVa1iaRUc9Lp';
const analysis = await importer.getAudioAnalysis(importantTrackId);

// ❌ Bad - For every track (rate limit issues)
for (const track of catalog.getAllTracks()) {
    await importer.getAudioAnalysis(track.id); // Don't do this!
}
```

## Examples

### Build a Techno Catalog

```typescript
const catalog = new MusicAssetCatalog();
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// Import from multiple sources
await importer.searchAndImport('genre:techno', 50);
await importer.searchAndImport('genre:"peak time techno"', 50);
await importer.searchAndImport('artist:Adam Beyer', 20);
await importer.searchAndImport('artist:Charlotte de Witte', 20);

console.log(`Total tracks: ${catalog.getAllTracks().length}`);

// Filter by BPM range
const technoTracks = catalog.filterTracks({
    bpmRange: { min: 125, max: 135 }
});

console.log(`Techno tracks (125-135 BPM): ${technoTracks.length}`);
```

### Import Your Spotify Playlists

```typescript
const myPlaylists = [
    '37i9dQZF1DX4dyzvuaRJ0n', // Mint
    '37i9dQZF1DX0hvqKOEBWTi', // Housewerk
    '37i9dQZF1DXa2PvUpywmrr'  // Techno Bunker
];

for (const playlistId of myPlaylists) {
    const result = await importer.importFromPlaylist(playlistId, 100);
    console.log(`Imported ${result.tracksImported} tracks from playlist ${playlistId}`);
}
```

### Cross-Reference with Your Library

```typescript
// Import tracks from Spotify
await importer.searchAndImport('artist:Daft Punk', 50);

// Find tracks in a specific key
const tracks = catalog.filterTracks({
    key: '8A' // A minor
});

console.log(`Tracks in A minor (8A):`);
tracks.forEach(track => {
    console.log(`  ${track.artist} - ${track.title} [${track.bpm} BPM]`);
});
```

## Troubleshooting

### "Module not found" errors

Make sure you've built the project:

```bash
npm run build
```

### TypeScript errors

Ensure you have the correct types:

```bash
npm install --save-dev @types/node
```

### Import hangs or times out

Check your network connection and Spotify API status:
- [Spotify Status Page](https://status.spotify.com/)

Increase timeout in rate limit config:

```typescript
rateLimit: {
    requestsPerSecond: 5,
    requestsPerMinute: 100,
    retryAttempts: 5,
    retryDelayMs: 3000  // 3 seconds
}
```

## Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- [Audio Features Reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- [Search API Guide](https://developer.spotify.com/documentation/web-api/reference/search)
- [Camelot Wheel Guide](https://mixedinkey.com/harmonic-mixing-guide/)

## Support

For issues or questions:
1. Check the [examples](../examples/spotify_import_example.ts)
2. Review the [API documentation](../src/import/README.md)
3. Check Spotify's [API status](https://status.spotify.com/)
