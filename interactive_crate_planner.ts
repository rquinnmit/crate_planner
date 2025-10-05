/**
 * Interactive Crate Planner
 * 
 * Full end-to-end testing of CratePilot functionality:
 * User prompt → LLM → Track selection → Crate generation
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
 * Initialize a sample catalog with some tracks for testing
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
            duration_sec: 360, // 6 minutes
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
            duration_sec: 330, // 5.5 minutes
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
            duration_sec: 345, // 5.75 minutes
            bpm: 122,
            key: '9A' as CamelotKey,
            energy: 3,
            album: 'Flow State',
            year: 2023
        },
        {
            id: 'rooftop-rhythm-004',
            artist: 'Rhythm Section',
            title: 'Rooftop Rhythm',
            genre: 'Tech House',
            duration_sec: 375, // 6.25 minutes
            bpm: 122,
            key: '9A' as CamelotKey,
            energy: 3,
            album: 'City Heights',
            year: 2023
        },
        {
            id: 'golden-hour-005',
            artist: 'Golden Beats',
            title: 'Golden Hour',
            genre: 'Tech House',
            duration_sec: 390, // 6.5 minutes
            bpm: 123,
            key: '10A' as CamelotKey,
            energy: 3,
            album: 'Golden Hour',
            year: 2023
        },
        {
            id: 'horizon-pulse-006',
            artist: 'Horizon',
            title: 'Horizon Pulse',
            genre: 'Tech House',
            duration_sec: 360, // 6 minutes
            bpm: 123,
            key: '10A' as CamelotKey,
            energy: 4,
            album: 'Horizon',
            year: 2023
        },
        {
            id: 'peak-moment-007',
            artist: 'Peak Collective',
            title: 'Peak Moment',
            genre: 'Tech House',
            duration_sec: 420, // 7 minutes
            bpm: 124,
            key: '11A' as CamelotKey,
            energy: 4,
            album: 'Peak Time',
            year: 2023
        },
        {
            id: 'energy-rise-008',
            artist: 'Energy Squad',
            title: 'Energy Rise',
            genre: 'Tech House',
            duration_sec: 405, // 6.75 minutes
            bpm: 124,
            key: '11A' as CamelotKey,
            energy: 5,
            album: 'Energy',
            year: 2023
        },
        {
            id: 'summit-groove-009',
            artist: 'Summit',
            title: 'Summit Groove',
            genre: 'Tech House',
            duration_sec: 390, // 6.5 minutes
            bpm: 124,
            key: '11B' as CamelotKey,
            energy: 5,
            album: 'Summit',
            year: 2023
        },
        {
            id: 'twilight-fade-010',
            artist: 'Twilight',
            title: 'Twilight Fade',
            genre: 'Tech House',
            duration_sec: 375, // 6.25 minutes
            bpm: 122,
            key: '10A' as CamelotKey,
            energy: 3,
            album: 'Twilight',
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
    // Simple parsing - in a real app, this would be more sophisticated
    const lowerInput = input.toLowerCase();
    
    // Extract BPM range
    const bpmMatch = input.match(/(\d+)-(\d+)\s*bpm/i);
    const tempoRange = bpmMatch ? { min: parseInt(bpmMatch[1]), max: parseInt(bpmMatch[2]) } : undefined;
    
    // Extract duration
    const durationMatch = input.match(/(\d+)\s*min/i);
    const targetDuration = durationMatch ? parseInt(durationMatch[1]) * 60 : undefined;
    
    // Extract genre
    const genreMatch = input.match(/(tech house|deep house|progressive house|house|techno)/i);
    const targetGenre = genreMatch ? genreMatch[1] : undefined;
    
    // Extract seed tracks (by ID or name)
    const seedTracks: string[] = [];
    const trackIds = ['sunset-vibes-001', 'deep-groove-002', 'evening-flow-003', 'rooftop-rhythm-004', 'golden-hour-005'];
    trackIds.forEach(id => {
        if (lowerInput.includes(id.split('-')[0]) || lowerInput.includes(id.split('-')[1])) {
            seedTracks.push(id);
        }
    });
    
    return {
        tempoRange,
        targetGenre,
        targetDuration,
        sampleTracks: seedTracks.length > 0 ? seedTracks : undefined,
        notes: input
    };
}

/**
 * Main interactive crate planning function
 */
async function startInteractiveCratePlanner(): Promise<void> {
    console.log('🎧 Interactive Crate Planner');
    console.log('============================\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    
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
                console.log(`   Seed tracks: ${prompt.sampleTracks ? prompt.sampleTracks.length : 0}`);
                
                // Use LLM to derive intent and generate crate
                console.log('\n🧠 Deriving intent with LLM...');
                const seedTracks = prompt.sampleTracks || ['sunset-vibes-001', 'deep-groove-002'];
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

startInteractiveCratePlanner().catch(console.error);
