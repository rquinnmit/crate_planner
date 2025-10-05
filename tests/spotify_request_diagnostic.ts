/**
 * Spotify Request Diagnostic
 * 
 * Compares manual fetch vs SpotifyImporter to identify the issue
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

async function diagnoseRequest() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Spotify Request Diagnostic          ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const credentials = checkSpotifyCredentials();
    
    // Step 1: Get token manually
    console.log('Step 1: Getting token manually...');
    const credentials_str = Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`
    ).toString('base64');
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials_str}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    
    const tokenData = await tokenResponse.json() as { access_token: string };
    console.log(`✅ Token obtained: ${tokenData.access_token.substring(0, 20)}...\n`);
    
    // Step 2: Manual fetch that works
    console.log('Step 2: Manual fetch (known to work)...');
    const manualUrl = 'https://api.spotify.com/v1/search?q=house&type=track&limit=3';
    console.log(`URL: ${manualUrl}`);
    console.log(`Headers:`, {
        'Authorization': `Bearer ${tokenData.access_token.substring(0, 20)}...`,
        'Content-Type': 'application/json'
    });
    
    const manualResponse = await fetch(manualUrl, {
        headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
        }
    });
    
    console.log(`Status: ${manualResponse.status} ${manualResponse.statusText}`);
    if (manualResponse.ok) {
        const data = await manualResponse.json() as any;
        console.log(`✅ Success! Found ${data.tracks.items.length} tracks\n`);
    } else {
        console.log(`❌ Failed!\n`);
        return;
    }
    
    // Step 3: SpotifyImporter with the same token
    console.log('Step 3: Using SpotifyImporter with manually set token...');
    const catalog = new MusicAssetCatalog();
    const importer = new SpotifyImporter(catalog, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseURL: 'https://api.spotify.com/v1',
        accessToken: tokenData.access_token,
        tokenExpiresAt: Date.now() + 3600000
    });
    
    console.log(`Token set in config: ${importer.getAccessToken()?.substring(0, 20)}...`);
    console.log(`Calling searchAndImport('house', 3)...`);
    
    try {
        const result = await importer.searchAndImport('house', 3);
        
        if (result.success && result.tracksImported > 0) {
            console.log(`✅ Success! Imported ${result.tracksImported} tracks`);
            const tracks = catalog.getAllTracks();
            tracks.forEach(t => console.log(`   - ${t.artist} - ${t.title}`));
        } else if (result.errors.length > 0) {
            console.log(`❌ Error: ${result.errors[0]}`);
        } else {
            console.log(`⚠️  No tracks found`);
        }
    } catch (error) {
        console.log(`❌ Exception: ${(error as Error).message}`);
        console.log((error as Error).stack);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Analysis:');
    console.log('- If manual fetch works but SpotifyImporter fails,');
    console.log('  the issue is in how makeRequest() builds the URL or headers');
    console.log('='.repeat(50));
}

// Run diagnostic
if (require.main === module) {
    diagnoseRequest().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

