/**
 * Spotify Search Format Test
 * 
 * Tests different search query formats to find what works
 */

import { MusicAssetCatalog } from '../src/core/catalog';
import { SpotifyImporter } from '../src/import/spotify_importer';

function checkSpotifyCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        throw new Error('Missing Spotify credentials');
    }
    
    return { clientId, clientSecret };
}

async function testSearchFormats() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Spotify Search Format Test          ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const credentials = checkSpotifyCredentials();
    const catalog = new MusicAssetCatalog();
    const importer = new SpotifyImporter(catalog, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseURL: 'https://api.spotify.com/v1'
    });
    
    const queries = [
        'house',  // Simple query
        'tech house',  // Two words
        'tech-house',  // Hyphenated
        'genre:house',  // Genre filter (if supported)
        'house year:2020-2024',  // With year filter
        'artist:Fisher',  // Artist search
        'track:losing it artist:fisher',  // Track + artist
    ];
    
    console.log('Testing different search query formats:\n');
    
    for (const query of queries) {
        console.log(`📡 Query: "${query}"`);
        try {
            const result = await importer.searchAndImport(query, 3);
            
            if (result.success && result.tracksImported > 0) {
                console.log(`   ✅ Success! Found ${result.tracksImported} tracks`);
                const tracks = catalog.getAllTracks().slice(-result.tracksImported);
                tracks.forEach(t => {
                    console.log(`      - ${t.artist} - ${t.title} (${t.bpm} BPM)`);
                });
            } else if (result.errors.length > 0) {
                console.log(`   ❌ Error: ${result.errors[0]}`);
            } else {
                console.log(`   ⚠️  No tracks found`);
            }
        } catch (error) {
            console.log(`   ❌ Exception: ${(error as Error).message}`);
        }
        console.log();
    }
    
    const totalTracks = catalog.getAllTracks().length;
    console.log(`\n📊 Total tracks imported: ${totalTracks}`);
    
    return totalTracks > 0;
}

// Run test
if (require.main === module) {
    testSearchFormats()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

