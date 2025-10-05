/**
 * Interactive Spotify Crate Planner
 * 
 * Full end-to-end testing with real Spotify data:
 * User prompt → LLM → Spotify track selection → Crate generation
 */

import { GeminiLLM, Config } from './src/llm/gemini-llm';
import { MusicAssetCatalog } from './src/core/catalog';
import { CratePlanner, CratePrompt } from './src/core/crate_planner';
import { SpotifyImporter } from './src/import/spotify_importer';
import { Track, CamelotKey } from './src/core/track';
import * as readline from 'readline';

/**
 * Load configuration from config/config.json
 */
function loadConfig(): Config {
    try {
        const config = require('./config/config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json');
        process.exit(1);
    }
}

/**
 * Check if Spotify credentials are available
 */
function checkSpotifyCredentials(): { clientId?: string; clientSecret?: string } {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    return { clientId, clientSecret };
}

/**
 * Initialize catalog with Spotify tracks
 */
async function initializeSpotifyCatalog(): Promise<MusicAssetCatalog> {
    const catalog = new MusicAssetCatalog();
    const credentials = checkSpotifyCredentials();
    
    if (!credentials.clientId || !credentials.clientSecret) {
        console.log('⚠️ Spotify credentials not found. Using sample catalog instead.');
        console.log('   Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables to use real Spotify data.');
        return initializeSampleCatalog();
    }
    
    console.log('🎵 Loading tracks from Spotify...');
    const importer = new SpotifyImporter(catalog, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        baseURL: 'https://api.spotify.com/v1'
    });
    
    try {
        // Import a variety of tracks for testing
        const genres = ['tech house', 'deep house', 'progressive house', 'techno'];
        let totalImported = 0;
        
        for (const genre of genres) {
            console.log(`   Importing ${genre} tracks...`);
            const result = await importer.searchAndImport(`genre:${genre}`, 5);
            totalImported += result.tracksImported;
            console.log(`   ✓ Imported ${result.tracksImported} ${genre} tracks`);
        }
        
        console.log(`✅ Total: ${totalImported} tracks imported from Spotify\n`);
        
    } catch (error) {
        console.log(`❌ Spotify import failed: ${(error as Error).message}`);
        console.log('   Falling back to sample catalog...\n');
        return initializeSampleCatalog();
    }
    
    return catalog;
}

/**
 * Initialize a sample catalog with some tracks for testing (fallback)
 */
function initializeSampleCatalog(): MusicAssetCatalog {
    const catalog = new MusicAssetCatalog();
    
    // Add sample tracks for testing
    const sampleTracks: Track[] = [
        {
            id: 'sunset-vibes-001',
            artist: 'Sunset Collective',
            title: 'Sunset Vibes',
            genre: 'Tech House',
            duration_sec: 360,
            bpm: 120,
            key: '8A' as CamelotKey,
            energy: 2,
            album: 'Sunset Sessions',
            year: 2023
        },
        {
            id: 'deep-groove-002',
            artist: 'Deep Groove',
            title: 'Deep Groove',
            genre: 'Tech House',
            duration_sec: 330,
            bpm: 121,
            key: '8A' as CamelotKey,
            energy: 2,
            album: 'Underground Sounds',
            year: 2023
        },
        {
            id: 'evening-flow-003',
            artist: 'Flow Masters',
            title: 'Evening Flow',
            genre: 'Tech House',
            duration_sec: 345,
            bpm: 122,
            key: '9A' as CamelotKey,
            energy: 3,
            album: 'Flow State',
            year: 2023
        }
    ];
    
    sampleTracks.forEach(track => catalog.addTrack(track));
    return catalog;
}

/**
 * Display available tracks in the catalog
 */
function displayCatalog(catalog: MusicAssetCatalog): void {
    const tracks = catalog.getAllTracks();
    console.log('\n📚 Available Tracks in Catalog:');
    console.log('================================');
    
    if (tracks.length === 0) {
        console.log('No tracks available. Try importing from Spotify first.');
        return;
    }
    
    tracks.forEach((track, index) => {
        console.log(`${index + 1}. ${track.artist} - ${track.title}`);
        console.log(`   ${track.bpm} BPM | ${track.key} | ${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')} | Energy: ${track.energy || 'N/A'}`);
    });
    console.log('');
}

/**
 * Parse user input to extract crate planning parameters
 */
function parseUserInput(input: string): CratePrompt | null {
    const lowerInput = input.toLowerCase();
    
    // Extract BPM range
    const bpmMatch = input.match(/(\d+)-(\d+)\s*bpm/i);
    const tempoRange = bpmMatch ? { min: parseInt(bpmMatch[1]), max: parseInt(bpmMatch[2]) } : undefined;
    
    // Extract duration
    const durationMatch = input.match(/(\d+)\s*min/i);
    const targetDuration = durationMatch ? parseInt(durationMatch[1]) * 60 : undefined;
    
    // Extract genre
    const genreMatch = input.match(/(tech house|deep house|progressive house|house|techno|trap|rap|hip hop)/i);
    const targetGenre = genreMatch ? genreMatch[1] : undefined;
    
    return {
        tempoRange,
        targetGenre,
        targetDuration,
        notes: input
    };
}

/**
 * Main interactive crate planning function
 */
async function startInteractiveSpotifyCratePlanner(): Promise<void> {
    console.log('🎧 Interactive Spotify Crate Planner');
    console.log('====================================\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Test LLM connection
    console.log('🔌 Testing LLM connection...');
    try {
        const connected = await llm.testConnection();
        if (!connected) {
            console.log('❌ LLM connection failed');
            return;
        }
        console.log('✅ LLM connected!\n');
    } catch (error) {
        console.log('❌ LLM connection error:', (error as Error).message);
        return;
    }
    
    // Initialize catalog with Spotify data
    const catalog = await initializeSpotifyCatalog();
    const planner = new CratePlanner(catalog);
    
    // Display available tracks
    displayCatalog(catalog);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('💬 Enter your crate planning prompt below.');
    console.log('Examples:');
    console.log('- "Rooftop sunset party, tech house, 120-124 BPM, 60 minutes"');
    console.log('- "Late night club set, high energy, 2 hours"');
    console.log('- "Chill lounge music, deep house, 90 minutes"');
    console.log('\nType "exit" to quit, "catalog" to see tracks, "help" for examples.\n');
    
    const planCrate = () => {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                return;
            }
            
            if (input.toLowerCase() === 'catalog') {
                displayCatalog(catalog);
                planCrate();
                return;
            }
            
            if (input.toLowerCase() === 'help') {
                console.log('\n📖 Help - Example Prompts:');
                console.log('- "Rooftop sunset party, tech house, 120-124 BPM, 60 minutes"');
                console.log('- "Late night club set, high energy, 2 hours"');
                console.log('- "Chill lounge music, deep house, 90 minutes"');
                console.log('- "Sunset vibes, smooth energy build, 90 minutes"');
                console.log('- "Peak hour club set, energetic, 2 hours"');
                console.log('');
                planCrate();
                return;
            }
            
            if (input.trim() === '') {
                planCrate();
                return;
            }
            
            try {
                console.log('\n🤖 Analyzing your prompt...');
                
                // Parse user input
                const prompt = parseUserInput(input);
                if (!prompt) {
                    console.log('❌ Could not parse your prompt. Try being more specific.');
                    planCrate();
                    return;
                }
                
                console.log('📋 Parsed prompt:');
                console.log(`   Genre: ${prompt.targetGenre || 'Any'}`);
                console.log(`   BPM: ${prompt.tempoRange ? `${prompt.tempoRange.min}-${prompt.tempoRange.max}` : 'Any'}`);
                console.log(`   Duration: ${prompt.targetDuration ? `${Math.floor(prompt.targetDuration / 60)} minutes` : 'Not specified'}`);
                
                // Use LLM to derive intent and generate crate
                console.log('\n🧠 Deriving intent with LLM...');
                const seedTracks = ['sunset-vibes-001', 'deep-groove-002']; // Default seeds
                const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
                
                console.log('✅ Intent derived:');
                console.log(`   Mix Style: ${intent.mixStyle}`);
                console.log(`   Energy Curve: ${intent.energyCurve}`);
                console.log(`   BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
                console.log(`   Target Genres: ${intent.targetGenres.join(', ')}`);
                
                console.log('\n🎵 Generating candidate pool...');
                const pool = await planner.generateCandidatePoolLLM(intent, llm);
                console.log(`✅ Generated pool with ${pool.tracks.size} candidate tracks`);
                console.log(`   Reasoning: ${pool.filtersApplied}`);
                
                console.log('\n🎧 Sequencing tracks with AI...');
                const plan = await planner.sequencePlanLLM(intent, pool, seedTracks, llm);
                console.log(`✅ Sequenced ${plan.trackList.length} tracks`);
                console.log(`   Total Duration: ${Math.floor(plan.totalDuration / 60)} minutes`);
                
                console.log('\n💡 Generating explanations...');
                const explainedPlan = await planner.explainPlanLLM(plan, llm);
                console.log('✅ Explanations generated');
                
                console.log('\n📋 Your AI-Generated Crate:');
                console.log('===========================');
                planner.displayCrate();
                
                // Validate the plan
                console.log('\n✅ Validating crate...');
                const validation = planner.validate(explainedPlan, 300);
                if (validation.isValid) {
                    console.log('✅ Validation passed!');
                } else {
                    console.log('⚠️ Validation issues:');
                    validation.errors.forEach(err => console.log(`   - ${err}`));
                }
                
            } catch (error) {
                console.log(`\n❌ Error: ${(error as Error).message}`);
                console.log('Try a different prompt or check your input format.');
            }
            
            console.log('\n' + '='.repeat(50) + '\n');
            planCrate();
        });
    };
    
    planCrate();
}

startInteractiveSpotifyCratePlanner().catch(console.error);
