/**
 * Spotify Token Diagnostic Test
 * 
 * Tests the OAuth token refresh flow specifically
 */

import { MusicAssetCatalog } from '../src/core/catalog';
import { SpotifyImporter } from '../src/import/spotify_importer';

function checkSpotifyCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        throw new Error('Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
    }
    
    return { clientId, clientSecret };
}

async function testTokenRefresh() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Spotify Token Diagnostic Test       ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const credentials = checkSpotifyCredentials();
    
    console.log('🔑 Credentials:');
    console.log(`   Client ID: ${credentials.clientId.substring(0, 10)}...${credentials.clientId.substring(credentials.clientId.length - 4)}`);
    console.log(`   Client Secret: ${credentials.clientSecret.substring(0, 10)}...${credentials.clientSecret.substring(credentials.clientSecret.length - 4)}`);
    
    console.log('\n📡 Testing token refresh manually...');
    
    try {
        // Manual token refresh test
        const credentials_str = Buffer.from(
            `${credentials.clientId}:${credentials.clientSecret}`
        ).toString('base64');
        
        console.log('   Encoded credentials length:', credentials_str.length);
        console.log('   Requesting token from Spotify...');
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials_str}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        
        console.log(`   Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`\n❌ Token refresh failed!`);
            console.error(`   Status: ${response.status}`);
            console.error(`   Error: ${errorText}`);
            return false;
        }
        
        const data = await response.json() as {
            access_token: string;
            token_type: string;
            expires_in: number;
        };
        
        console.log(`\n✅ Token obtained successfully!`);
        console.log(`   Token type: ${data.token_type}`);
        console.log(`   Expires in: ${data.expires_in} seconds`);
        console.log(`   Token (first 20 chars): ${data.access_token.substring(0, 20)}...`);
        
        // Test using the token with a simple search first
        console.log('\n📡 Testing API call with token (search endpoint)...');
        const searchResponse = await fetch('https://api.spotify.com/v1/search?q=house&type=track&limit=1', {
            headers: {
                'Authorization': `Bearer ${data.access_token}`
            }
        });
        
        console.log(`   Search API Response status: ${searchResponse.status} ${searchResponse.statusText}`);
        
        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.error(`\n❌ Search API call failed!`);
            console.error(`   Error: ${errorText}`);
            return false;
        }
        
        const searchData = await searchResponse.json() as any;
        console.log(`\n✅ Search API call successful!`);
        console.log(`   Tracks found: ${searchData.tracks.items.length}`);
        if (searchData.tracks.items.length > 0) {
            console.log(`   Sample track: ${searchData.tracks.items[0].artists[0].name} - ${searchData.tracks.items[0].name}`);
        }
        
        // Now test genre seeds endpoint
        console.log('\n📡 Testing genre seeds endpoint...');
        const apiResponse = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            headers: {
                'Authorization': `Bearer ${data.access_token}`
            }
        });
        
        console.log(`   Genre seeds API Response status: ${apiResponse.status} ${apiResponse.statusText}`);
        
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`\n❌ Genre seeds API call failed!`);
            console.error(`   Error: ${errorText}`);
            console.log(`\n⚠️  Note: The token works (search succeeded) but genre seeds endpoint is unavailable.`);
            console.log(`   This might be a Spotify API access issue with your app.`);
            // Don't return false here - search works so API is functional
        } else {
            const genreData = await apiResponse.json() as { genres: string[] };
            console.log(`\n✅ Genre seeds API call successful!`);
            console.log(`   Genre seeds available: ${genreData.genres.length}`);
            console.log(`   Sample genres: ${genreData.genres.slice(0, 10).join(', ')}`);
        }
        
        // Now test with SpotifyImporter
        console.log('\n\n📚 Testing with SpotifyImporter class...');
        const catalog = new MusicAssetCatalog();
        const importer = new SpotifyImporter(catalog, {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            baseURL: 'https://api.spotify.com/v1'
        });
        
        console.log('   Getting access token...');
        const importerToken = importer.getAccessToken();
        console.log(`   Token before first call: ${importerToken ? 'EXISTS' : 'NULL'}`);
        
        console.log('   Calling getAvailableGenreSeeds()...');
        const genres = await importer.getAvailableGenreSeeds();
        
        console.log(`   Genres retrieved: ${genres.length}`);
        console.log(`   Token after call: ${importer.getAccessToken() ? 'EXISTS' : 'NULL'}`);
        
        if (genres.length > 0) {
            console.log(`\n✅ SpotifyImporter working correctly!`);
            return true;
        } else {
            console.log(`\n⚠️ SpotifyImporter returned no genres`);
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
        console.error((error as Error).stack);
        return false;
    }
}

// Run test
if (require.main === module) {
    testTokenRefresh()
        .then(success => {
            console.log('\n' + '='.repeat(50));
            if (success) {
                console.log('✅ All token tests passed!');
                console.log('The Spotify API integration is working correctly.');
            } else {
                console.log('❌ Token tests failed!');
                console.log('Check your Spotify credentials and API access.');
            }
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

