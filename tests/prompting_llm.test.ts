/**
 * Prompting Workflow with Actual LLM Tests
 * 
 * Tests the complete user prompting workflow with real Gemini API calls.
 * Requires valid API key in config/config.json
 */

import { GeminiLLM, Config } from '../src/llm/gemini-llm';
import { CratePlanner, CratePrompt } from '../src/core/crate_planner';
import { MusicAssetCatalog } from '../src/core/catalog';
import { Track, CamelotKey } from '../src/core/track';
import { createDeriveIntentPrompt } from '../src/prompts/crate_prompting';
import { formatSeedTracks } from '../src/prompts/formatters';

// ========== CONFIGURATION ==========

function loadConfig(): Config {
    try {
        const config = require('../config/config.json');
        if (!config.apiKey) {
            throw new Error('API key not found in config.json');
        }
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json');
        console.error('   Make sure the file exists with a valid Gemini API key');
        throw error;
    }
}

// ========== SAMPLE CATALOG ==========

function createSampleCatalog(): MusicAssetCatalog {
    const catalog = new MusicAssetCatalog();
    
    const sampleTracks: Track[] = [
        {
            id: 'track-001',
            artist: 'Sunset Collective',
            title: 'Golden Hour',
            genre: 'Tech House',
            duration_sec: 360,
            bpm: 120,
            key: '8A' as CamelotKey,
            energy: 2
        },
        {
            id: 'track-002',
            artist: 'Deep Groove',
            title: 'Midnight Vibes',
            genre: 'Deep House',
            duration_sec: 330,
            bpm: 122,
            key: '8A' as CamelotKey,
            energy: 3
        },
        {
            id: 'track-003',
            artist: 'Peak Masters',
            title: 'Energy Rise',
            genre: 'Tech House',
            duration_sec: 390,
            bpm: 124,
            key: '9A' as CamelotKey,
            energy: 4
        }
    ];
    
    sampleTracks.forEach(track => catalog.addTrack(track));
    return catalog;
}

// ========== TEST UTILITIES ==========

interface TestResult {
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
}

const results: TestResult[] = [];

async function testScenario(
    name: string,
    testFn: () => Promise<void>
): Promise<void> {
    console.log(`\n🧪 Testing: ${name}`);
    console.log('─'.repeat(60));
    
    const startTime = Date.now();
    
    try {
        await testFn();
        const duration = Date.now() - startTime;
        results.push({
            testName: name,
            passed: true,
            duration
        });
        console.log(`✅ PASSED (${(duration / 1000).toFixed(2)}s)`);
    } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
            testName: name,
            passed: false,
            duration,
            error: (error as Error).message
        });
        console.log(`❌ FAILED (${(duration / 1000).toFixed(2)}s)`);
        console.log(`   Error: ${(error as Error).message}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

// ========== TEST SCENARIOS ==========

async function main(): Promise<void> {
    console.log('\n🎯 CratePilot - Prompting Workflow with LLM');
    console.log('='.repeat(60));
    console.log('Testing end-to-end user prompting with actual Gemini API calls\n');
    
    // Load configuration and initialize
    let config: Config;
    let llm: GeminiLLM;
    let catalog: MusicAssetCatalog;
    let planner: CratePlanner;
    
    try {
        config = loadConfig();
        console.log('✅ Configuration loaded');
        
        llm = new GeminiLLM(config);
        console.log('✅ LLM initialized');
        
        catalog = createSampleCatalog();
        console.log(`✅ Catalog initialized with ${catalog.getTrackCount()} sample tracks`);
        
        planner = new CratePlanner(catalog);
        console.log('✅ Planner initialized\n');
    } catch (error) {
        console.error('❌ Initialization failed:', (error as Error).message);
        process.exit(1);
    }
    
    // Test 1: Test LLM Connection
    await testScenario('LLM Connection Test', async () => {
        console.log('   Testing connection to Gemini API...');
        const connected = await llm.testConnection();
        assert(connected, 'Failed to connect to Gemini API');
        console.log('   ✓ Connection successful');
    });
    
    // Test 2: Complete Prompt - Rooftop Sunset
    await testScenario('Complete Prompt: Rooftop Sunset', async () => {
        const prompt: CratePrompt = {
            tempoRange: { min: 120, max: 124 },
            targetGenre: 'Tech House',
            targetDuration: 3600,
            notes: 'Rooftop sunset party with smooth progressive energy build, starting mellow and building gradually'
        };
        
        const seedTracks = ['track-001', 'track-002'];
        
        console.log('   Prompt:', prompt.notes);
        console.log('   BPM Range:', `${prompt.tempoRange?.min}-${prompt.tempoRange?.max}`);
        console.log('   Duration:', `${prompt.targetDuration! / 60} minutes`);
        console.log('   Calling LLM...');
        
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        
        console.log('\n   📊 Derived Intent:');
        console.log(`      Mix Style: ${intent.mixStyle}`);
        console.log(`      Energy Curve: ${intent.energyCurve}`);
        console.log(`      BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
        console.log(`      Target Genres: ${intent.targetGenres.join(', ')}`);
        console.log(`      Duration: ${Math.floor(intent.duration / 60)} minutes`);
        
        if (intent.targetEnergy !== undefined) {
            console.log(`      Target Energy: ${intent.targetEnergy}`);
        }
        if (intent.minPopularity !== undefined) {
            console.log(`      Min Popularity: ${intent.minPopularity}`);
        }
        
        // Validate the intent
        assert(intent.tempoRange.min >= 100 && intent.tempoRange.min <= 140, 'BPM min should be reasonable');
        assert(intent.tempoRange.max >= intent.tempoRange.min, 'BPM max should be >= min');
        assert(intent.duration > 0, 'Duration should be positive');
        assert(['smooth', 'energetic', 'eclectic'].includes(intent.mixStyle), 'Mix style should be valid');
        if (intent.energyCurve) {
            assert(['linear', 'wave', 'peak'].includes(intent.energyCurve), 'Energy curve should be valid');
        }
        assert(Array.isArray(intent.targetGenres), 'Target genres should be an array');
        
        console.log('\n   ✓ All validations passed');
    });
    
    // Test 3: Partial Prompt - Missing BPM and Duration
    await testScenario('Partial Prompt: LLM Infers Missing Fields', async () => {
        const prompt: CratePrompt = {
            targetGenre: 'Deep House',
            notes: 'Chill lounge vibes for a Sunday afternoon, relaxed and smooth'
        };
        
        const seedTracks = ['track-002'];
        
        console.log('   Prompt:', prompt.notes);
        console.log('   Genre:', prompt.targetGenre);
        console.log('   BPM: Not specified (LLM should infer)');
        console.log('   Duration: Not specified (LLM should default)');
        console.log('   Calling LLM...');
        
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        
        console.log('\n   📊 Derived Intent:');
        console.log(`      Mix Style: ${intent.mixStyle}`);
        console.log(`      Energy Curve: ${intent.energyCurve}`);
        console.log(`      BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max} (inferred)`);
        console.log(`      Target Genres: ${intent.targetGenres.join(', ')}`);
        console.log(`      Duration: ${Math.floor(intent.duration / 60)} minutes (inferred)`);
        
        // Validate that LLM filled in reasonable defaults
        assert(intent.tempoRange.min > 0, 'LLM should infer a positive BPM min');
        assert(intent.tempoRange.max > intent.tempoRange.min, 'LLM should infer valid BPM range');
        assert(intent.duration > 0, 'LLM should infer/default a positive duration');
        assert(intent.mixStyle === 'smooth', 'Chill/lounge should be smooth mix style');
        assert(intent.targetGenres.length > 0, 'LLM should infer target genres');
        
        console.log('\n   ✓ LLM successfully inferred missing fields');
    });
    
    // Test 4: High Energy Prompt
    await testScenario('High Energy Prompt: Peak Hour Club Set', async () => {
        const prompt: CratePrompt = {
            tempoRange: { min: 126, max: 130 },
            targetGenre: 'Techno',
            targetDuration: 7200,
            notes: 'Peak hour club set, maximum energy, intense and driving beats for 2AM crowd'
        };
        
        const seedTracks = ['track-003'];
        
        console.log('   Prompt:', prompt.notes);
        console.log('   BPM Range:', `${prompt.tempoRange?.min}-${prompt.tempoRange?.max}`);
        console.log('   Duration:', `${(prompt.targetDuration || 0) / 60} minutes`);
        console.log('   Calling LLM...');
        
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        
        console.log('\n   📊 Derived Intent:');
        console.log(`      Mix Style: ${intent.mixStyle}`);
        console.log(`      Energy Curve: ${intent.energyCurve}`);
        console.log(`      BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max}`);
        console.log(`      Duration: ${Math.floor(intent.duration / 60)} minutes`);
        
        if (intent.targetEnergy !== undefined) {
            console.log(`      Target Energy: ${intent.targetEnergy} (high energy expected)`);
            assert(intent.targetEnergy >= 0.7, 'Peak hour should have high target energy');
        }
        
        // Validate high energy characteristics
        assert(intent.mixStyle === 'energetic', 'Peak hour should be energetic mix style');
        assert(intent.energyCurve === 'peak' || intent.energyCurve === 'linear', 'Should have peak or sustained energy curve');
        
        console.log('\n   ✓ High energy intent correctly derived');
    });
    
    // Test 5: Prompt with Specific Key
    await testScenario('Prompt with Specific Key Constraint', async () => {
        const prompt: CratePrompt = {
            tempoRange: { min: 120, max: 124 },
            targetKey: '8A' as CamelotKey,
            targetGenre: 'Tech House',
            targetDuration: 3600,
            notes: 'Tech house set in 8A key with harmonic mixing throughout'
        };
        
        const seedTracks = ['track-001'];
        
        console.log('   Prompt:', prompt.notes);
        console.log('   Key:', prompt.targetKey);
        console.log('   Calling LLM...');
        
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        
        console.log('\n   📊 Derived Intent:');
        console.log(`      Allowed Keys: ${intent.allowedKeys.join(', ')}`);
        
        if (intent.targetKeyCamelot) {
            console.log(`      Target Key: ${intent.targetKeyCamelot}`);
            assert(intent.targetKeyCamelot === '8A', 'Target key should match prompt');
        }
        
        // Should include harmonically compatible keys
        assert(intent.allowedKeys.length > 0, 'Should suggest compatible keys');
        console.log(`      (Includes ${intent.allowedKeys.length} harmonically compatible keys)`);
        
        console.log('\n   ✓ Key constraints properly handled');
    });
    
    // Test 6: Minimal Prompt
    await testScenario('Minimal Prompt: Just Genre and Mood', async () => {
        const prompt: CratePrompt = {
            notes: 'ambient chill music for yoga class'
        };
        
        const seedTracks: string[] = [];
        
        console.log('   Prompt:', prompt.notes);
        console.log('   No other constraints specified');
        console.log('   Calling LLM...');
        
        const intent = await planner.deriveIntentLLM(prompt, seedTracks, llm);
        
        console.log('\n   📊 Derived Intent:');
        console.log(`      Mix Style: ${intent.mixStyle}`);
        console.log(`      Energy Curve: ${intent.energyCurve}`);
        console.log(`      BPM Range: ${intent.tempoRange.min}-${intent.tempoRange.max} (fully inferred)`);
        console.log(`      Target Genres: ${intent.targetGenres.join(', ')} (inferred from context)`);
        console.log(`      Duration: ${Math.floor(intent.duration / 60)} minutes (default)`);
        
        // Validate minimal prompt handling
        assert(intent.tempoRange.min < 120, 'Ambient/yoga should have slower BPM');
        assert(intent.mixStyle === 'smooth', 'Chill/yoga should be smooth');
        assert(intent.targetGenres.some(g => g.toLowerCase().includes('ambient') || g.toLowerCase().includes('chill')), 
               'Should infer ambient-related genres');
        
        console.log('\n   ✓ LLM successfully handled minimal prompt');
    });
    
    // Test 7: Validate Prompt Generation Quality
    await testScenario('Prompt Generation Quality Check', async () => {
        const prompt: CratePrompt = {
            tempoRange: { min: 120, max: 124 },
            targetGenre: 'Tech House',
            targetDuration: 3600,
            notes: 'Test event'
        };
        
        const seedTrackObjects = [
            catalog.getTrack('track-001')!,
            catalog.getTrack('track-002')!
        ];
        
        const seedInfo = formatSeedTracks(seedTrackObjects);
        const llmPrompt = createDeriveIntentPrompt(prompt, seedInfo);
        
        console.log('   Checking generated prompt structure...');
        
        // Check essential components
        assert(llmPrompt.includes('You are'), 'Should have role definition');
        assert(llmPrompt.includes('Return ONLY a JSON'), 'Should request JSON output');
        assert(llmPrompt.includes('Guidelines'), 'Should include guidelines');
        assert(llmPrompt.includes('tempoRange'), 'Should specify expected fields');
        assert(llmPrompt.includes('targetEnergy'), 'Should include Spotify fields');
        assert(llmPrompt.includes('minPopularity'), 'Should include Spotify fields');
        assert(llmPrompt.includes('sunset = 120-124'), 'Should have inference examples');
        
        // Check prompt length is reasonable
        const tokenEstimate = llmPrompt.length / 4;
        console.log(`   Prompt length: ${llmPrompt.length} chars (~${Math.round(tokenEstimate)} tokens)`);
        assert(tokenEstimate < 2000, 'Prompt should not be excessively long');
        
        console.log('\n   ✓ Prompt structure is well-formed');
    });
    
    // ========== SUMMARY ==========
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    results.forEach(result => {
        const status = result.passed ? '✅ PASSED' : '❌ FAILED';
        const duration = `(${(result.duration / 1000).toFixed(2)}s)`;
        console.log(`${status} ${result.testName} ${duration}`);
        if (result.error) {
            console.log(`         ${result.error}`);
        }
    });
    
    console.log('\n' + '-'.repeat(60));
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('-'.repeat(60));
    
    if (failed > 0) {
        console.log('\n❌ Some tests failed. Review the errors above.\n');
        process.exit(1);
    } else {
        console.log('\n🎉 All prompting workflow tests passed with actual LLM calls!');
        console.log('   The user prompting functionality is working correctly.\n');
        process.exit(0);
    }
}

// Run the test suite
main().catch(error => {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
});

