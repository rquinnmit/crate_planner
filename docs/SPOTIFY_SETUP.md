# Spotify Import Setup - Quick Start

Get your CratePilot catalog populated with Spotify track data in 5 minutes.

## Step 1: Get Spotify API Credentials (2 minutes)

1. Go to **[Spotify Developer Dashboard](https://developer.spotify.com/dashboard)**
2. Log in with your Spotify account (free account works)
3. Click **"Create app"**
4. Fill in the form:
   ```
   App name: CratePilot
   App description: DJ crate planning tool
   Redirect URI: http://localhost:3000
   Which API/SDKs are you planning to use? ✓ Web API
   ```
5. Click **"Save"**
6. Click **"Settings"** on your new app
7. Copy your **Client ID** and **Client Secret**

## Step 2: Set Environment Variables (1 minute)

### Windows PowerShell
```powershell
$env:SPOTIFY_CLIENT_ID="paste_your_client_id_here"
$env:SPOTIFY_CLIENT_SECRET="paste_your_client_secret_here"
```

### Windows Command Prompt
```cmd
set SPOTIFY_CLIENT_ID=paste_your_client_id_here
set SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
```

### Linux/Mac
```bash
export SPOTIFY_CLIENT_ID="paste_your_client_id_here"
export SPOTIFY_CLIENT_SECRET="paste_your_client_secret_here"
```

### Permanent Setup (Optional)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or PowerShell profile):

```bash
# Linux/Mac
echo 'export SPOTIFY_CLIENT_ID="your_id"' >> ~/.bashrc
echo 'export SPOTIFY_CLIENT_SECRET="your_secret"' >> ~/.bashrc
source ~/.bashrc
```

```powershell
# Windows PowerShell - Add to $PROFILE
notepad $PROFILE
# Add the $env:SPOTIFY_CLIENT_ID and $env:SPOTIFY_CLIENT_SECRET lines
```

## Step 3: Test the Integration (1 minute)

Run the test suite:

```bash
npm run test:spotify
```

You should see:
```
✓ All tests passed! Spotify importer is ready to use.
```

## Step 4: Import Your First Tracks (1 minute)

### Option A: Run the Examples

```bash
npm run example:spotify
```

This will show you various import methods with sample data.

### Option B: Quick Code Example

Create a file `my_import.ts`:

```typescript
import { MusicAssetCatalog } from './src/core/catalog';
import { SpotifyImporter } from './src/import/spotify_importer';

async function importTracks() {
    const catalog = new MusicAssetCatalog();
    const importer = new SpotifyImporter(catalog, {
        clientId: process.env.SPOTIFY_CLIENT_ID!,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
        baseURL: 'https://api.spotify.com/v1'
    });

    // Import 20 techno tracks
    const result = await importer.searchAndImport('genre:techno', 20);
    console.log(`✓ Imported ${result.tracksImported} tracks`);

    // Show what you got
    catalog.getAllTracks().forEach(track => {
        console.log(`${track.artist} - ${track.title} [${track.bpm} BPM, ${track.key}]`);
    });
}

importTracks().catch(console.error);
```

Run it:
```bash
npx ts-node my_import.ts
```

## What You Can Import

### Search by Genre
```typescript
await importer.searchAndImport('genre:techno', 50);
await importer.searchAndImport('genre:"deep house"', 30);
```

### Search by Artist
```typescript
await importer.searchAndImport('artist:Daft Punk', 20);
await importer.searchAndImport('artist:"Charlotte de Witte"', 25);
```

### Import from Playlist
```typescript
// Your own playlists or public ones
await importer.importFromPlaylist('37i9dQZEVXbMDoHDwVN2tF', 50);
```

### Import Specific Tracks
```typescript
const trackIds = [
    '3n3Ppam7vgaVa1iaRUc9Lp',  // Mr. Brightside
    '0VjIjW4GlUZAMYd2vXMi3b'   // Blinding Lights
];
await importer.importByIds(trackIds);
```

## What Data You Get

Every track includes:
- ✓ **Artist** and **Title**
- ✓ **BPM** (tempo)
- ✓ **Key** (converted to Camelot notation for harmonic mixing)
- ✓ **Energy** (1-5 scale)
- ✓ **Album**, **Year**, **Duration**
- ✓ **Compatible keys** for mixing

Example output:
```
Daft Punk - One More Time [123 BPM, 9A]
  Energy: 4/5
  Album: Discovery (2001)
  Duration: 5:20
  Compatible keys: 9A, 10A, 8A, 9B
```

## Troubleshooting

### "Failed to get Spotify access token: 401"
- Double-check your Client ID and Client Secret
- Make sure there are no extra spaces
- Verify credentials are set in current terminal session

### "No tracks found for query"
- Try a different search term
- Use quotes for multi-word genres: `genre:"deep house"`
- Check Spotify's catalog for that content

### "Rate limit exceeded: 429"
- You're making too many requests too fast
- Add delays between large imports
- The importer has built-in rate limiting (10 req/sec default)

### Tests fail
```bash
# Rebuild the project
npm run build

# Try again
npm run test:spotify
```

## Next Steps

1. **Build your catalog**: Import tracks from your favorite genres/artists
2. **Use the planner**: Feed your catalog to the AI crate planner
3. **Export to DJ software**: Export plans to Rekordbox/Serato

See the full documentation:
- [Spotify Import Guide](./SPOTIFY_IMPORT_GUIDE.md) - Complete API reference
- [Import README](../src/import/README.md) - Technical details
- [Examples](../examples/spotify_import_example.ts) - Code samples

## Quick Reference

```typescript
// Initialize
const importer = new SpotifyImporter(catalog, {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    baseURL: 'https://api.spotify.com/v1'
});

// Search
await importer.searchAndImport('query', limit);

// By ID
await importer.importById('spotify_track_id');
await importer.importByIds(['id1', 'id2', 'id3']);

// From playlist
await importer.importFromPlaylist('playlist_id', limit);

// Audio analysis (advanced)
const analysis = await importer.getAudioAnalysis('track_id');
```

## Support

- [Spotify Web API Docs](https://developer.spotify.com/documentation/web-api)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- [API Status](https://status.spotify.com/)

---

**Ready to start?** Run `npm run example:spotify` and start building your catalog! 🎵
