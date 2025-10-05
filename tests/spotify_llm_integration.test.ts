/**
 * Spotify LLM Integration Tests
 * 
 * Tests the full LLM-driven Spotify track discovery workflow:
 * 1. LLM generates Query Plan (search queries + recommendations)
 * 2. Query Plan is executed against Spotify API
 * 3. Tracks are imported and filtered
 */

import { MusicAssetCatalog } from '../src/core/catalog';
import { CratePlanner, CratePrompt, DerivedIntent } from '../src/core/crate_planner';
import { SpotifyImporter } from '../src/import/spotify_importer';
import { SpotifySearchService } from '../src/llm/spotify_search_service';
import { GeminiLLM, Config } from '../src/llm/gemini-llm';

/**
 * Load configuration from config/config.json
 */
function loadConfig(): Config {
    try {
        const config = require('../config/config.json');
        return config;
    } catch (error) {
        throw new Error('Failed to load config/config.json. Please create it with your Gemini API key.');
    }
}

/**
 * Check for Spotify credentials
 */
function checkSpotifyCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        throw new Error('Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
    }
    
    return { clientId, clientSecret };
}

/**
 * Test: Basic Query Plan Generation
 */
async function testQueryPlanGeneration() {
    console.log('\n=== Test 1: Query Plan Generation ===\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    const credentials = checkSpotifyCredentials();
    
    const catalog = new MusicAssetCatalog();
    const spotifyImporter = new SpotifyImporter(catalog, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseURL: 'https://api.spotify.com/v1'
    });
    
    console.log('🎵 Initializing Spotify Search Service...');
    const searchService = new SpotifySearchService(spotifyImporter, llm, catalog);
    
    // Create a sample intent
    const intent: DerivedIntent = {
        tempoRange: { min: 120, max: 124 },
        allowedKeys: ['8A', '7A', '9A', '8B'],
        targetGenres: ['Tech House', 'Deep House'],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: [],
        energyCurve: 'linear',
        targetEnergy: 0.6,
        minPopularity: 30
    };
    
    console.log('📊 Intent Details:');
    console.log(`   BPM: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
    console.log(`   Genres: ${intent.targetGenres.join(', ')}`);
    console.log(`   Mix Style: ${intent.mixStyle}`);
    console.log(`   Target Energy: ${intent.targetEnergy}`);
    
    console.log('\n🔍 Searching for tracks with LLM...');
    try {
        const tracks = await searchService.searchTracksForIntent(intent, 10);
        
        console.log(`\n✅ Successfully retrieved ${tracks.length} tracks`);
        
        if (tracks.length > 0) {
            console.log('\n📀 Sample Tracks:');
            tracks.slice(0, 5).forEach((track, idx) => {
                console.log(`   ${idx + 1}. ${track.artist} - ${track.title}`);
                console.log(`      BPM: ${track.bpm}, Key: ${track.key}, Energy: ${track.energy}/5`);
            });
            return true;
        } else {
            console.log('\n⚠️ No tracks found. This might indicate:');
            console.log('   - LLM generated queries that returned no results');
            console.log('   - Post-filtering removed all tracks');
            console.log('   - API rate limits or errors');
            return false;
        }
    } catch (error) {
        console.error('\n❌ Error during search:', (error as Error).message);
        console.error((error as Error).stack);
        return false;
    }
}

/**
 * Test: Full Crate Planning with Spotify
 */
async function testFullCratePlanning() {
    console.log('\n=== Test 2: Full Crate Planning with Spotify ===\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    const credentials = checkSpotifyCredentials();
    
    const catalog = new MusicAssetCatalog();
    const spotifyImporter = new SpotifyImporter(catalog, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseURL: 'https://api.spotify.com/v1'
    });
    
    const searchService = new SpotifySearchService(spotifyImporter, llm, catalog);
    const planner = new CratePlanner(catalog);
    
    // User prompt
    const prompt: CratePrompt = {
        tempoRange: { min: 120, max: 124 },
        targetDuration: 3600, // 60 minutes
        notes: 'Tech house rooftop sunset set with smooth progressive energy',
        targetGenre: 'Tech House'
    };
    
    console.log('📝 User Prompt:');
    console.log(`   "${prompt.notes}"`);
    console.log(`   BPM: ${prompt.tempoRange!.min}-${prompt.tempoRange!.max}`);
    console.log(`   Duration: ${prompt.targetDuration! / 60} minutes`);
    
    try {
        // Step 1: Derive Intent
        console.log('\n🧠 Step 1: Deriving intent with LLM...');
        const intent = await planner.deriveIntentLLM(prompt, [], llm);
        console.log('   ✓ Intent derived');
        console.log(`      Mix Style: ${intent.mixStyle}`);
        console.log(`      Energy Curve: ${intent.energyCurve}`);
        console.log(`      Target Genres: ${intent.targetGenres.join(', ')}`);
        
        // Step 2: Search Spotify
        console.log('\n🔍 Step 2: Searching Spotify with LLM...');
        const tracks = await searchService.searchTracksForIntent(intent, 15);
        
        if (tracks.length === 0) {
            console.log('\n⚠️ No tracks found from Spotify search');
            return false;
        }
        
        console.log(`   ✓ Found ${tracks.length} tracks`);
        
        // Step 3: Generate Candidate Pool (using catalog tracks)
        console.log('\n🎯 Step 3: Generating candidate pool...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        console.log(`   ✓ Pool contains ${pool.tracks.size} tracks`);
        
        // Step 4: Sequence Plan
        console.log('\n📝 Step 4: Sequencing crate...');
        const plan = await planner.sequencePlanLLM(intent, pool, [], llm);
        
        if (plan.trackList.length === 0) {
            console.log('\n⚠️ Plan is empty');
            return false;
        }
        
        console.log(`   ✓ Plan created with ${plan.trackList.length} tracks`);
        console.log(`   ✓ Total duration: ${Math.floor(plan.totalDuration / 60)} minutes`);
        
        console.log('\n📀 Final Tracklist (first 5):');
        plan.trackList.slice(0, 5).forEach((trackId: string, idx: number) => {
            const track = catalog.getTrack(trackId);
            if (track) {
                console.log(`   ${idx + 1}. ${track.artist} - ${track.title}`);
                console.log(`      ${track.bpm} BPM, ${track.key}, Energy ${track.energy}/5`);
            }
        });
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Error during crate planning:', (error as Error).message);
        console.error((error as Error).stack);
        return false;
    }
}

/**
 * Test: API Connection Only
 */
async function testSpotifyAPIConnection() {
    console.log('\n=== Test 3: Spotify API Connection ===\n');
    
    const credentials = checkSpotifyCredentials();
    const catalog = new MusicAssetCatalog();
    
    console.log('🔑 Using credentials:');
    console.log(`   Client ID: ${credentials.clientId.substring(0, 8)}...`);
    console.log(`   Client Secret: ${credentials.clientSecret.substring(0, 8)}...`);
    
    try {
        const spotifyImporter = new SpotifyImporter(catalog, {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            baseURL: 'https://api.spotify.com/v1'
        });
        
        console.log('\n📡 Testing API connection...');
        const genreSeeds = await spotifyImporter.getAvailableGenreSeeds();
        
        if (genreSeeds.length > 0) {
            console.log(`\n✅ API connection successful!`);
            console.log(`   Available genre seeds: ${genreSeeds.length}`);
            console.log(`   Sample genres: ${genreSeeds.slice(0, 10).join(', ')}`);
            
            // Try a simple search
            console.log('\n🔍 Testing search functionality...');
            const result = await spotifyImporter.searchAndImport('tech house', 5);
            
            if (result.success && result.tracksImported > 0) {
                console.log(`✅ Search successful! Imported ${result.tracksImported} tracks`);
                
                const tracks = catalog.getAllTracks();
                console.log('\n📀 Imported tracks:');
                tracks.forEach((track, idx) => {
                    console.log(`   ${idx + 1}. ${track.artist} - ${track.title} (${track.bpm} BPM)`);
                });
                
                return true;
            } else {
                console.log('⚠️ Search returned no tracks');
                console.log(`   Errors: ${result.errors.join(', ')}`);
                console.log(`   Warnings: ${result.warnings.join(', ')}`);
                return false;
            }
        } else {
            console.log('\n❌ Failed to fetch genre seeds');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ API connection failed:', (error as Error).message);
        console.error((error as Error).stack);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  Spotify LLM Integration Test Suite   ║');
    console.log('╚════════════════════════════════════════╝');
    
    try {
        const results = {
            apiConnection: await testSpotifyAPIConnection(),
            queryPlanGeneration: await testQueryPlanGeneration(),
            fullCratePlanning: await testFullCratePlanning()
        };
        
        console.log('\n' + '='.repeat(50));
        console.log('Test Summary:');
        console.log('='.repeat(50));
        
        const passed = Object.values(results).filter(r => r).length;
        const total = Object.keys(results).length;
        
        Object.entries(results).forEach(([name, passed]) => {
            const status = passed ? '✓' : '✗';
            console.log(`${status} ${name}`);
        });
        
        console.log(`\nTotal: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            console.log('\n✅ All tests passed! Spotify LLM integration is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above for details.');
        }
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', (error as Error).message);
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

