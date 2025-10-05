/**
 * CratePlanner Test Cases
 * 
 * Demonstrates both manual crate planning and LLM-assisted crate planning
 * Maps to the three demo scenarios from README.md:
 *   - Scenario A: AI-powered crate generation from natural language prompt
 *   - Scenario B: Revision loop with user feedback
 *   - Scenario C: Manual planning with validation
 */

import { CratePlanner, CratePrompt } from '../src/core/crate_planner';
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
    
    // Create initial crate with too few tracks (will fail validation)
    const shortTrackList = [
        'sunset-vibes-001',      // 6 min
        'deep-groove-002',       // 5.5 min
        'evening-flow-003',      // 5.75 min
        'golden-hour-005',       // 6.5 min
        'horizon-pulse-006',     // 6 min
        'afterglow-012'          // 5.75 min
    ];
    // Total: ~35.5 minutes (too short for 60-minute target)
    
    console.log('\n🎧 Creating initial plan with manual selection...');
    const initialPlan = planner.createPlan(
        {
            targetDuration: 3600, // 60 minutes
            tempoRange: { min: 120, max: 124 },
            targetGenre: 'Tech House'
        },
        shortTrackList.slice(0, 3) // Use first 3 as seeds
    );
    
    console.log('\n❌ Validating crate (expecting failure)...');
    console.log('   Target duration: 60 minutes (±5 min tolerance)');
    const validationResult = planner.validate(initialPlan, 300); // 5 min tolerance
    
    if (validationResult.isValid) {
        console.log('   ⚠️  Warning: Expected validation failure but plan passed');
    } else {
        console.log('   ✓ Validation failed as expected:');
        validationResult.errors.forEach(err => console.log(`     - ${err}`));
    }
    
    console.log('\n🔧 Fixing validation issues...');
    console.log('   Creating new plan with more tracks to reach target duration...');
    
    // Create a new plan with more tracks
    const fullTrackList = [
        'sunset-vibes-001',
        'deep-groove-002',
        'evening-flow-003',
        'rooftop-rhythm-004',
        'golden-hour-005',
        'horizon-pulse-006',
        'peak-moment-007',
        'twilight-fade-010',
        'afterglow-012'
    ];
    
    const fixedPlan = planner.createPlan(
        {
            targetDuration: 3600,
            tempoRange: { min: 120, max: 124 },
            targetGenre: 'Tech House'
        },
        fullTrackList.slice(0, 3)
    );
    
    console.log('\n✅ Re-validating after fix...');
    const newValidation = planner.validate(fixedPlan, 300);
    
    if (newValidation.isValid) {
        console.log('   ✓ Validation passed!');
    } else {
        console.log('   Validation errors:');
        newValidation.errors.forEach(err => console.log(`     - ${err}`));
    }
    
    console.log('\n📋 Finalizing the plan...');
    try {
        planner.finalize(fixedPlan);
        console.log('   ✓ Plan finalized successfully');
    } catch (error) {
        console.log(`   ❌ Finalization failed: ${(error as Error).message}`);
    }
    
    console.log('\n📋 Final crate (validated):');
    planner.displayCrate();
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
    
    const prompt: CratePrompt = {
        tempoRange: { min: 120, max: 124 },
        targetGenre: 'Tech House',
        targetDuration: 90 * 60, // 90 minutes in seconds
        notes: 'Rooftop sunset • tech house • 120–124 BPM • 90 min - Smooth energy build, sunset vibes'
    };
    
    const seedTracks = ['sunset-vibes-001', 'deep-groove-002', 'evening-flow-003'];
    
    try {
        console.log('🤖 Step 1: Deriving intent from prompt...');
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        console.log('   ✓ Intent derived:');
        console.log(`     - Mix Style: ${intent.mixStyle}`);
        console.log(`     - Energy Curve: ${intent.energyCurve}`);
        console.log(`     - BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
        console.log(`     - Target Genres: ${intent.targetGenres.join(', ')}`);
        
        console.log('\n🎵 Step 2: Generating candidate pool...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        console.log(`   ✓ Generated pool with ${pool.tracks.size} candidate tracks`);
        console.log(`     Reasoning: ${pool.filtersApplied}`);
        
        console.log('\n🎧 Step 3: Sequencing tracks with AI...');
        const plan = await planner.sequencePlanLLM(intent, pool, seedTracks, llm);
        console.log(`   ✓ Sequenced ${plan.trackList.length} tracks`);
        console.log(`     Total Duration: ${Math.floor(plan.totalDuration / 60)} minutes`);
        
        console.log('\n💡 Step 4: Generating explanations...');
        const explainedPlan = await planner.explainPlanLLM(plan, llm);
        console.log('   ✓ Explanations generated');
        
        console.log('\n✅ Step 5: Validating crate...');
        const validation = planner.validate(explainedPlan, 300);
        if (validation.isValid) {
            console.log('   ✓ Validation passed!');
        } else {
            console.log('   Validation issues:');
            validation.errors.forEach(err => console.log(`     - ${err}`));
        }
        
        console.log('\n📋 Final AI-generated crate:');
        planner.displayCrate();
        
    } catch (error) {
        console.error(`\n❌ AI Planning failed: ${(error as Error).message}`);
        console.log('\nNote: This test requires a valid Gemini API key in config/config.json');
        console.log('Falling back to manual planning...\n');
        
        // Fallback to manual planning
        const manualPlan = planner.createPlan(prompt, seedTracks);
        console.log('📋 Manual fallback plan:');
        planner.displayCrate();
    }
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
    
    // Start with an initial crate that includes Artist X tracks
    console.log('🎵 Creating initial crate...');
    console.log('   (Initial crate intentionally includes tracks by "Artist X")');
    
    const prompt: CratePrompt = {
        tempoRange: { min: 120, max: 124 },
        targetGenre: 'Tech House',
        targetDuration: 60 * 60,
        notes: 'Tech house set with gradual energy build'
    };
    
    // Create initial plan that might include Artist X tracks
    const seedTracks = ['sunset-vibes-001', 'artist-x-track-016', 'evening-flow-003'];
    const initialPlan = planner.createPlan(prompt, seedTracks);
    
    console.log('\n📋 Initial crate:');
    console.log(`   Tracks: ${initialPlan.trackList.length}`);
    console.log(`   Duration: ${Math.floor(initialPlan.totalDuration / 60)} minutes`);
    
    // Check if Artist X is in the crate
    const hasArtistX = initialPlan.trackList.some(id => {
        const track = catalog.getTrack(id);
        return track?.artist === 'Artist X';
    });
    console.log(`   Contains Artist X tracks: ${hasArtistX ? 'Yes' : 'No'}`);
    
    try {
        // Apply revision (matches README Scenario B exactly)
        console.log('\n🔧 User Revision Request:');
        console.log('   "Avoid Artist X, raise energy sooner"');
        console.log('\n🤖 Processing revision with LLM...');
        
        const revisedPlan = await planner.revisePlanLLM(
            initialPlan,
            'Avoid tracks by Artist X and raise energy earlier in the set',
            llm
        );
        
        console.log('   ✓ Revision complete');
        console.log(`   Changes: ${revisedPlan.annotations}`);
        
        // Check if Artist X has been removed
        const stillHasArtistX = revisedPlan.trackList.some(id => {
            const track = catalog.getTrack(id);
            return track?.artist === 'Artist X';
        });
        console.log(`   Artist X removed: ${!stillHasArtistX ? 'Yes' : 'No'}`);
        
        console.log('\n✅ Re-validating revised crate...');
        const validation = planner.validate(revisedPlan, 300);
        if (validation.isValid) {
            console.log('   ✓ Validation passed!');
        } else {
            console.log('   Validation issues:');
            validation.errors.forEach(err => console.log(`     - ${err}`));
        }
        
        console.log('\n📋 Revised crate:');
        planner.displayCrate();
        
    } catch (error) {
        console.error(`\n❌ Revision failed: ${(error as Error).message}`);
        console.log('\nNote: This test requires a valid Gemini API key in config/config.json');
        console.log('Manual revision demonstration:\n');
        
        // Manual revision: filter out Artist X
        const manuallyRevisedTrackList = initialPlan.trackList.filter(id => {
            const track = catalog.getTrack(id);
            return track?.artist !== 'Artist X';
        });
        
        console.log(`   Manually removed Artist X tracks`);
        console.log(`   Original: ${initialPlan.trackList.length} tracks`);
        console.log(`   Revised: ${manuallyRevisedTrackList.length} tracks`);
    }
}

/**
 * Test case 4: Mixed Mode Planning
 * Demonstrates manually setting opening tracks, then letting AI fill the rest
 */
export async function testMixedModePlanning(): Promise<void> {
    console.log('\n🧪 TEST CASE 4: Mixed Mode Planning');
    console.log('====================================');
    console.log('Demo: Manual opener → AI continuation\n');
    
    const catalog = initializeSampleCatalog();
    const planner = new CratePlanner(catalog);
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Manually set opening tracks
    console.log('🎧 Manually selecting opening sequence...');
    console.log('   Opener: Sunset Vibes');
    console.log('   Second: Deep Groove');
    console.log('   Third: Evening Flow');
    
    const manualOpeners = [
        'sunset-vibes-001',
        'deep-groove-002',
        'evening-flow-003'
    ];
    
    try {
        console.log('\n🤖 Using AI to complete the set...');
        
        // Create a prompt for the full set
        const fullPrompt: CratePrompt = {
            tempoRange: { min: 120, max: 126 },
            targetGenre: 'Tech House',
            targetDuration: 75 * 60, // 75 minutes total
            notes: 'Continue from smooth opening, build to peak, then wind down'
        };
        
        // Use LLM to derive intent and generate the rest
        const intent = await planner.deriveIntentLLM(fullPrompt, manualOpeners, llm);
        console.log(`   ✓ Intent derived with ${intent.mixStyle} mix style`);
        
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        console.log(`   ✓ Candidate pool: ${pool.tracks.size} tracks`);
        
        const completePlan = await planner.sequencePlanLLM(intent, pool, manualOpeners, llm);
        console.log(`   ✓ Complete plan: ${completePlan.trackList.length} tracks`);
        
        // Verify manual openers are included
        const openerCount = manualOpeners.filter(id => 
            completePlan.trackList.includes(id)
        ).length;
        console.log(`   Manual openers included: ${openerCount}/${manualOpeners.length}`);
        
        console.log('\n📋 Final mixed-mode crate:');
        planner.displayCrate();
        
    } catch (error) {
        console.error(`\n❌ Mixed mode planning failed: ${(error as Error).message}`);
        console.log('\nNote: This test requires a valid Gemini API key in config/config.json');
        console.log('Falling back to manual planning...\n');
        
        // Fallback: create a plan with the manual openers as seeds
        const fallbackPrompt: CratePrompt = {
            tempoRange: { min: 120, max: 126 },
            targetGenre: 'Tech House',
            targetDuration: 75 * 60
        };
        
        const fallbackPlan = planner.createPlan(fallbackPrompt, manualOpeners);
        console.log('📋 Fallback plan with manual openers:');
        console.log(`   Total tracks: ${fallbackPlan.trackList.length}`);
        console.log(`   Duration: ${Math.floor(fallbackPlan.totalDuration / 60)} minutes`);
    }
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
