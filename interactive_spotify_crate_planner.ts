/**
 * Interactive Spotify Crate Planner
 * 
 * Full end-to-end testing with real Spotify data:
 * User prompt → LLM → Spotify track selection → Crate generation
 */

import { GeminiLLM, Config } from './src/llm/gemini-llm';
import { MusicAssetCatalog } from './src/core/catalog';
import { CratePlanner, CratePrompt, CratePlan } from './src/core/crate_planner';
import { SpotifyImporter } from './src/import/spotify_importer';
import { SpotifySearchService } from './src/llm/spotify_search_service';
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
 * Initialize catalog and Spotify services
 */
async function initializeSpotifyServices(): Promise<{
    catalog: MusicAssetCatalog;
    spotifyImporter?: SpotifyImporter;
    spotifySearchService?: SpotifySearchService;
}> {
    const catalog = new MusicAssetCatalog();
    const credentials = checkSpotifyCredentials();
    
    if (!credentials.clientId || !credentials.clientSecret) {
        console.log('⚠️ Spotify credentials not found. Using sample catalog instead.');
        console.log('   Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables to use real Spotify data.');
        return { catalog };
    }
    
    console.log('🎵 Initializing Spotify services...');
    
    try {
        const spotifyImporter = new SpotifyImporter(catalog, {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            baseURL: 'https://api.spotify.com/v1'
        });
        
        // Test Spotify connection with a more reliable query
        console.log('   Testing Spotify API connection...');
        const genreSeeds = await spotifyImporter.getAvailableGenreSeeds();
        if (genreSeeds.length === 0) {
            throw new Error('Failed to fetch genre seeds - API authentication likely failed');
        }
        console.log(`   ✅ Spotify API connected successfully (${genreSeeds.length} genre seeds available)`);
        
        return {
            catalog,
            spotifyImporter,
            spotifySearchService: undefined // Will be set later with LLM
        };
        
    } catch (error) {
        console.log(`❌ Spotify connection failed: ${(error as Error).message}`);
        console.log('   Falling back to sample catalog...\n');
        return { catalog };
    }
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
 * Offer revision loop to user
 */
async function offerRevision(
    currentPlan: CratePlan,
    planner: CratePlanner,
    llm: GeminiLLM,
    rl: readline.Interface
): Promise<void> {
    return new Promise((resolve) => {
        console.log('\n' + '='.repeat(50));
        console.log('💬 Would you like to revise this crate? (yes/no)');
        
        rl.question('You: ', async (response) => {
            if (response.toLowerCase() !== 'yes') {
                resolve();
                return;
            }
            
            console.log('\n🔧 What would you like to change?');
            console.log('Examples:');
            console.log('  - "Avoid tracks by [Artist Name]"');
            console.log('  - "Raise energy earlier in the set"');
            console.log('  - "Add more tracks from [Genre]"');
            console.log('  - "Replace slow tracks with faster ones"');
            console.log('  - "Lower the BPM range"');
            
            rl.question('Revision: ', async (instructions) => {
                try {
                    if (instructions.trim().length < 5) {
                        console.log('⚠️ Please provide more specific instructions (at least 5 characters).');
                        resolve();
                        return;
                    }
                    
                    console.log('\n🤖 Processing revision...');
                    const revisedPlan = await planner.revisePlanLLM(currentPlan, instructions, llm);
                    
                    console.log(`\n✅ Revision complete!`);
                    console.log(`📝 Changes: ${revisedPlan.annotations}\n`);
                    
                    console.log('📋 Revised Crate:');
                    console.log('=================');
                    planner.displayCrate();
                    
                    // Validate revised plan
                    console.log('\n✅ Validating revised crate...');
                    const validation = planner.validate(revisedPlan, 300);
                    if (validation.isValid) {
                        console.log('✅ Validation passed!');
                    } else {
                        console.log('⚠️ Validation issues:');
                        validation.errors.forEach(err => console.log(`   - ${err}`));
                    }
                    
                    // Recursive revision loop
                    await offerRevision(revisedPlan, planner, llm, rl);
                    resolve();
                    
                } catch (error) {
                    console.log(`\n❌ Revision error: ${(error as Error).message}`);
                    resolve();
                }
            });
        });
    });
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
    // Validate minimum input length
    if (input.trim().length < 10) {
        console.log('⚠️ Prompt is too short. Please provide more details about your event.');
        return null;
    }
    
    const lowerInput = input.toLowerCase();
    
    // Extract BPM range
    const bpmMatch = input.match(/(\d+)-(\d+)\s*bpm/i);
    const tempoRange = bpmMatch ? { min: parseInt(bpmMatch[1]), max: parseInt(bpmMatch[2]) } : undefined;
    
    // Extract duration
    const durationMatch = input.match(/(\d+)\s*min/i);
    const targetDuration = durationMatch ? parseInt(durationMatch[1]) * 60 : undefined;
    
    // Extract genre (expanded list for Spotify)
    const genreMatch = input.match(/(tech house|deep house|progressive house|house|techno|trance|drum and bass|dubstep|ambient|downtempo|trap|rap|hip hop|r&b|pop|indie|rock)/i);
    const targetGenre = genreMatch ? genreMatch[1] : undefined;
    
    // Note: Seed tracks will be determined by Spotify search, not from local catalog
    // The LLM will find matching tracks based on the intent
    
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
    
    // Initialize catalog and Spotify services
    const { catalog, spotifyImporter } = await initializeSpotifyServices();
    const planner = new CratePlanner(catalog);
    
    // Set up Spotify search service if available
    if (spotifyImporter) {
        const spotifySearchService = new SpotifySearchService(spotifyImporter, llm, catalog);
        planner.setSpotifySearchService(spotifySearchService);
        console.log('✅ Spotify search service enabled - LLM will search Spotify directly\n');
    } else {
        console.log('ℹ️ Using local catalog only - no Spotify search available\n');
    }
    
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
    console.log('\nType "exit" to quit, "catalog" to see tracks, "help" for examples.');
    if (planner.isSpotifySearchEnabled()) {
        console.log('🎵 Spotify search enabled - LLM will find tracks from Spotify\'s catalog!\n');
    } else {
        console.log('📚 Using local catalog only - set Spotify credentials for real-time search.\n');
    }
    
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
                // Use empty seed tracks initially - Spotify search will find matching tracks
                // If catalog has tracks, use the first few as seeds
                const catalogTracks = catalog.getAllTracks();
                const seedTracks = catalogTracks.length > 0 
                    ? catalogTracks.slice(0, Math.min(3, catalogTracks.length)).map(t => t.id)
                    : [];
                const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
                
                console.log('✅ Intent derived:');
                console.log(`   Mix Style: ${intent.mixStyle}`);
                console.log(`   Energy Curve: ${intent.energyCurve}`);
                console.log(`   BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
                console.log(`   Target Genres: ${intent.targetGenres.join(', ')}`);
                
                console.log('\n🎵 Generating candidate pool...');
                if (planner.isSpotifySearchEnabled()) {
                    console.log('   🔍 Searching Spotify for tracks matching your intent...');
                } else {
                    console.log('   📚 Selecting from local catalog...');
                }
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
                
                // Offer revision loop
                await offerRevision(explainedPlan, planner, llm, rl);
                
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
