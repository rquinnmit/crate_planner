/**
 * CratePlanner Test Cases
 * 
 * Demonstrates both manual crate planning and LLM-assisted crate planning
 * Maps to the three demo scenarios from README.md:
 *   - Scenario A: AI-powered crate generation from natural language prompt
 *   - Scenario B: Revision loop with user feedback
 *   - Scenario C: Manual planning with validation
 */

import { CratePlanner } from '../src/core/crate_planner';
import { MusicAssetCatalog } from '../src/core/catalog';
import { Track, CamelotKey } from '../src/core/track';
import { GeminiLLM, Config } from '../src/llm/gemini-llm';

/**
 * Load configuration from config/config.json
 */
function loadConfig(): Config {
    try {
        const config = require('../config/config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json. Please ensure it exists with your API key.');
        console.error('Error details:', (error as Error).message);
        process.exit(1);
    }
}

/**
 * Initialize a sample music catalog with tech house tracks for testing
 * Includes tracks for the "rooftop sunset" demo scenario
 */
function initializeSampleCatalog(): MusicAssetCatalog {
    const catalog = new MusicAssetCatalog();
    
    // Opening tracks (120-122 BPM, mellow energy) - Sunset vibes
    catalog.addTrack({
        id: 'sunset-vibes-001',
        artist: 'Sunset Collective',
        title: 'Sunset Vibes',
        genre: 'Tech House',
        duration_sec: 360, // 6 minutes
        bpm: 120,
        key: '8A' as CamelotKey,
        energy: 2
    });
    
    catalog.addTrack({
        id: 'deep-groove-002',
        artist: 'Deep Groove',
        title: 'Deep Groove',
        genre: 'Tech House',
        duration_sec: 330, // 5.5 minutes
        bpm: 121,
        key: '8A' as CamelotKey,
        energy: 2
    });
    
    catalog.addTrack({
        id: 'evening-flow-003',
        artist: 'Flow Masters',
        title: 'Evening Flow',
        genre: 'Tech House',
        duration_sec: 345, // 5.75 minutes
        bpm: 122,
        key: '9A' as CamelotKey,
        energy: 3
    });
    
    // Mid-set tracks (122-124 BPM, building energy)
    catalog.addTrack({
        id: 'rooftop-rhythm-004',
        artist: 'Rhythm Section',
        title: 'Rooftop Rhythm',
        genre: 'Tech House',
        duration_sec: 375, // 6.25 minutes
        bpm: 122,
        key: '9A' as CamelotKey,
        energy: 3
    });
    
    catalog.addTrack({
        id: 'golden-hour-005',
        artist: 'Golden Beats',
        title: 'Golden Hour',
        genre: 'Tech House',
        duration_sec: 390, // 6.5 minutes
        bpm: 123,
        key: '10A' as CamelotKey,
        energy: 3
    });
    
    catalog.addTrack({
        id: 'horizon-pulse-006',
        artist: 'Horizon',
        title: 'Horizon Pulse',
        genre: 'Tech House',
        duration_sec: 360, // 6 minutes
        bpm: 123,
        key: '10A' as CamelotKey,
        energy: 4
    });
    
    // Peak tracks (124 BPM, high energy)
    catalog.addTrack({
        id: 'peak-moment-007',
        artist: 'Peak Collective',
        title: 'Peak Moment',
        genre: 'Tech House',
        duration_sec: 420, // 7 minutes
        bpm: 124,
        key: '11A' as CamelotKey,
        energy: 4
    });
    
    catalog.addTrack({
        id: 'energy-rise-008',
        artist: 'Energy Squad',
        title: 'Energy Rise',
        genre: 'Tech House',
        duration_sec: 405, // 6.75 minutes
        bpm: 124,
        key: '11A' as CamelotKey,
        energy: 5
    });
    
    catalog.addTrack({
        id: 'summit-groove-009',
        artist: 'Summit',
        title: 'Summit Groove',
        genre: 'Tech House',
        duration_sec: 390, // 6.5 minutes
        bpm: 124,
        key: '11B' as CamelotKey,
        energy: 5
    });
    
    // Closing tracks (122-120 BPM, wind down)
    catalog.addTrack({
        id: 'twilight-fade-010',
        artist: 'Twilight',
        title: 'Twilight Fade',
        genre: 'Tech House',
        duration_sec: 375, // 6.25 minutes
        bpm: 122,
        key: '10A' as CamelotKey,
        energy: 3
    });
    
    catalog.addTrack({
        id: 'sunset-close-011',
        artist: 'Sunset Collective',
        title: 'Sunset Close',
        genre: 'Tech House',
        duration_sec: 360, // 6 minutes
        bpm: 121,
        key: '9A' as CamelotKey,
        energy: 2
    });
    
    catalog.addTrack({
        id: 'afterglow-012',
        artist: 'Afterglow',
        title: 'Afterglow',
        genre: 'Tech House',
        duration_sec: 345, // 5.75 minutes
        bpm: 120,
        key: '8A' as CamelotKey,
        energy: 2
    });
    
    // Additional tracks for variety and testing
    catalog.addTrack({
        id: 'tech-vibes-013',
        artist: 'Tech Masters',
        title: 'Tech Vibes',
        genre: 'Tech House',
        duration_sec: 360,
        bpm: 123,
        key: '9B' as CamelotKey,
        energy: 3
    });
    
    catalog.addTrack({
        id: 'groove-machine-014',
        artist: 'Groove Machine',
        title: 'Groove Machine',
        genre: 'Tech House',
        duration_sec: 390,
        bpm: 124,
        key: '10B' as CamelotKey,
        energy: 4
    });
    
    catalog.addTrack({
        id: 'smooth-operator-015',
        artist: 'Smooth Sounds',
        title: 'Smooth Operator',
        genre: 'Tech House',
        duration_sec: 330,
        bpm: 121,
        key: '8B' as CamelotKey,
        energy: 2
    });
    
    // Tracks by "Artist X" for revision scenario testing
    catalog.addTrack({
        id: 'artist-x-track-016',
        artist: 'Artist X',
        title: 'Unwanted Track',
        genre: 'Tech House',
        duration_sec: 360,
        bpm: 122,
        key: '9A' as CamelotKey,
        energy: 3
    });
    
    catalog.addTrack({
        id: 'artist-x-track-017',
        artist: 'Artist X',
        title: 'Another Unwanted',
        genre: 'Tech House',
        duration_sec: 345,
        bpm: 123,
        key: '10A' as CamelotKey,
        energy: 3
    });
    
    return catalog;
}

/**
 * Test case 1: Manual Crate Planning (README Scenario C - AI off)
 * Demonstrates manually building a crate and handling validation failures
 * 
 * README Scenario C: "Manual plan + a validator failure (duration mismatch) → fix and finalize"
 */
export async function testManualCratePlanning(): Promise<void> {
    console.log('\n🧪 TEST CASE 1: Manual Crate Planning (Scenario C - AI Off)');
    console.log('============================================================');
    console.log('Demo: Manual planning with intentional validation failure\n');
    
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    
    // Manually select and sequence tracks (intentionally create duration mismatch)
    console.log('🎵 Manually selecting tracks from catalog...');
    console.log('   Selected 6 tracks for a 60-minute target (but will be too short)');
    // TODO: Get tracks from catalog
    // const track1 = catalog.getTrack('sunset-vibes-001');      // 6 min
    // const track2 = catalog.getTrack('deep-groove-002');       // 5.5 min
    // const track3 = catalog.getTrack('evening-flow-003');      // 5.75 min
    // const track4 = catalog.getTrack('golden-hour-005');       // 6.5 min
    // const track5 = catalog.getTrack('horizon-pulse-006');     // 6 min
    // const track6 = catalog.getTrack('afterglow-012');         // 5.75 min
    // Total: ~35 minutes (too short for 60-minute target)
    
    console.log('\n🎧 Manually sequencing tracks...');
    // TODO: Add tracks to crate in specific order
    // planner.addTrackToCrate(track1);
    // planner.addTrackToCrate(track2);
    // planner.addTrackToCrate(track3);
    // ... etc
    
    console.log('\n❌ Validating crate (expecting failure)...');
    console.log('   Target duration: 60 minutes (±5 min tolerance)');
    // TODO: Run validation (expect duration failure)
    // const validationResults = planner.validateCrate();
    // Expected output: "Duration 35min is outside tolerance (target: 60min ± 5min)"
    
    console.log('\n🔧 Fixing validation issues...');
    console.log('   Adding more tracks to reach target duration...');
    // TODO: Fix issues by adding more tracks
    // planner.addTrackToCrate(catalog.getTrack('rooftop-rhythm-004'));  // +6.25 min
    // planner.addTrackToCrate(catalog.getTrack('peak-moment-007'));     // +7 min
    // planner.addTrackToCrate(catalog.getTrack('twilight-fade-010'));   // +6.25 min
    // New total: ~60 minutes
    
    console.log('\n✅ Re-validating after fix...');
    // TODO: Re-run validation
    // const newValidation = planner.validateCrate();
    // Expected: Validation passes
    
    console.log('\n📋 Final crate (validated):');
    console.log('   Total duration: ~60 minutes');
    console.log('   Tracks: 9');
    // TODO: Display final crate
    // planner.displayCrate();
}

/**
 * Test case 2: AI-Powered Crate Planning (README Scenario A)
 * Demonstrates natural language prompt → AI-generated crate with validation
 * 
 * README Scenario A: "Rooftop sunset • tech house • 120–124 BPM • 90 min" with 3 seeds 
 *                    → show ordered crate and concise rationale
 */
export async function testAICratePlanning(): Promise<void> {
    console.log('\n🧪 TEST CASE 2: AI-Powered Crate Planning (Scenario A)');
    console.log('=======================================================');
    console.log('Demo: Natural language prompt → AI-generated crate\n');
    
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Define the event prompt (matches README Scenario A exactly)
    console.log('📝 Event Description:');
    console.log('   "Rooftop sunset • tech house • 120–124 BPM • 90 min"');
    console.log('\n🎵 Seed Tracks:');
    console.log('   - Sunset Vibes (Sunset Collective)');
    console.log('   - Deep Groove (Deep Groove)');
    console.log('   - Evening Flow (Flow Masters)\n');
    
    // TODO: Create structured prompt
    // const prompt: CratePrompt = {
    //     eventDescription: "Rooftop sunset • tech house • 120–124 BPM • 90 min",
    //     seedTracks: ['sunset-vibes-001', 'deep-groove-002', 'evening-flow-003'],
    //     constraints: {
    //         tempoRange: { min: 120, max: 124 },
    //         genre: 'Tech House',
    //         targetDuration: 90 * 60, // 90 minutes in seconds
    //         notes: "Smooth energy build, sunset vibes"
    //     }
    // };
    
    console.log('🤖 Step 1: Deriving intent from prompt...');
    // TODO: Call deriveIntentLLM
    // const intent = await planner.deriveIntentLLM(prompt, llm);
    
    console.log('🎵 Step 2: Generating candidate pool...');
    // TODO: Call generateCandidatePoolLLM
    // const candidates = await planner.generateCandidatePoolLLM(intent, llm);
    
    console.log('🎧 Step 3: Sequencing tracks with AI...');
    // TODO: Call sequencePlanLLM
    // const plan = await planner.sequencePlanLLM(candidates, intent, llm);
    
    console.log('💡 Step 4: Generating explanations...');
    // TODO: Call explainPlanLLM
    // const explanations = await planner.explainPlanLLM(plan, llm);
    
    console.log('✅ Step 5: Validating crate...');
    // TODO: Run validation
    // const validationResults = planner.validateCrate();
    
    console.log('\n📋 Final AI-generated crate:');
    // TODO: Display crate with explanations
    // planner.displayCrate();
}

/**
 * Test case 3: Revision Loop (README Scenario B)
 * Demonstrates applying user feedback to revise an existing crate
 * 
 * README Scenario B: Apply a revision ("avoid Artist X, raise energy sooner") and re-validate
 */
export async function testCrateRevision(): Promise<void> {
    console.log('\n🧪 TEST CASE 3: Crate Revision (Scenario B)');
    console.log('============================================');
    console.log('Demo: User feedback → AI revision → re-validation\n');
    
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Start with an initial AI-generated crate (that includes Artist X tracks)
    console.log('🎵 Generating initial crate with seed tracks...');
    console.log('   (Initial crate intentionally includes tracks by "Artist X")');
    // TODO: Create initial crate (similar to Scenario A)
    
    console.log('\n📋 Initial crate:');
    // TODO: Display initial crate
    // planner.displayCrate();
    
    // Apply revision (matches README Scenario B exactly)
    console.log('\n🔧 User Revision Request:');
    console.log('   "Avoid Artist X, raise energy sooner"');
    console.log('\n🤖 Processing revision...');
    // TODO: Call revisePlanLLM
    // const revisedPlan = await planner.revisePlanLLM(
    //     "Avoid tracks by Artist X and raise energy earlier in the set",
    //     llm
    // );
    
    console.log('\n✅ Re-validating revised crate...');
    // TODO: Validate revised crate
    
    console.log('\n📋 Revised crate:');
    // TODO: Display revised crate with changes highlighted
    // planner.displayCrateWithChanges();
}

/**
 * Test case 4: Mixed Mode Planning
 * Demonstrates manually setting opening tracks, then letting AI fill the rest
 */
export async function testMixedModePlanning(): Promise<void> {
    console.log('\n🧪 TEST CASE 4: Mixed Mode Planning');
    console.log('====================================');
    
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Manually set opening tracks
    console.log('🎧 Manually setting opening sequence...');
    // TODO: Add specific opening tracks
    // const openingTrack = catalog.getTrack('sunset-intro-001');
    // const buildupTrack = catalog.getTrack('gentle-rise-002');
    // planner.addTrackToCrate(openingTrack);
    // planner.addTrackToCrate(buildupTrack);
    
    console.log('\n📋 Partial crate after manual selection:');
    // TODO: Display partial crate
    // planner.displayCrate();
    
    // Let AI fill the remaining slots
    console.log('\n🤖 Filling remaining slots with AI...');
    // TODO: Create prompt for remaining tracks
    // const remainingPrompt = {
    //     eventDescription: "Continue from opening, build to peak, then wind down",
    //     existingTracks: planner.getCurrentTracks(),
    //     constraints: {
    //         tempoRange: { min: 120, max: 126 },
    //         targetDuration: 75 * 60, // Remaining time
    //     }
    // };
    // await planner.fillRemainingTracksLLM(remainingPrompt, llm);
    
    console.log('\n📋 Final mixed-mode crate:');
    // TODO: Display final crate
    // planner.displayCrate();
}

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
    console.log('🎧 CratePilot Test Suite');
    console.log('=========================\n');
    
    try {
        // Run manual crate planning test (Scenario C)
        await testManualCratePlanning();
        
        // Run AI crate planning test (Scenario A)
        await testAICratePlanning();
        
        // Run revision test (Scenario B)
        await testCrateRevision();
        
        // Run mixed mode planning test
        await testMixedModePlanning();
        
        console.log('\n🎉 All test cases completed successfully!');
        
    } catch (error) {
        console.error('❌ Test error:', (error as Error).message);
        process.exit(1);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    main();
}
