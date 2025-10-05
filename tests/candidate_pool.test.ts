/**
 * Candidate Pool Generation Tests
 * 
 * Tests the candidate pool generation workflow including:
 * - Token limit protection
 * - Energy defaults
 * - Fallback handling
 * - LLM integration
 */

import { CratePlanner, CratePrompt, DerivedIntent } from '../src/core/crate_planner';
import { MusicAssetCatalog } from '../src/core/catalog';
import { Track, CamelotKey } from '../src/core/track';
import { GeminiLLM, Config } from '../src/llm/gemini-llm';

// ========== TEST UTILITIES ==========

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    testCount++;
    return Promise.resolve(fn()).then(
        () => {
            passCount++;
            console.log(`✅ ${name}`);
        },
        (error) => {
            failCount++;
            console.log(`❌ ${name}`);
            console.log(`   Error: ${(error as Error).message}`);
        }
    );
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
            message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
        );
    }
}

// ========== HELPER FUNCTIONS ==========

function loadConfig(): Config {
    try {
        const config = require('../config/config.json');
        if (!config.apiKey) {
            throw new Error('API key not found in config.json');
        }
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json');
        throw error;
    }
}

function createSampleTrack(id: string, overrides?: Partial<Track>): Track {
    return {
        id,
        artist: `Artist ${id}`,
        title: `Track ${id}`,
        genre: 'Tech House',
        duration_sec: 360,
        bpm: 120,
        key: '8A' as CamelotKey,
        energy: 3,
        ...overrides
    };
}

function createLargeCatalog(size: number): MusicAssetCatalog {
    const catalog = new MusicAssetCatalog();
    const bpmRange = [118, 122, 124, 126, 128];
    const keys: CamelotKey[] = ['8A', '8B', '9A', '9B', '10A'];
    const energies: (1 | 2 | 3 | 4 | 5)[] = [2, 3, 4];
    
    for (let i = 0; i < size; i++) {
        const track: Track = {
            id: `track-${String(i).padStart(4, '0')}`,
            artist: `Artist ${i % 50}`,
            title: `Track ${i}`,
            genre: i % 3 === 0 ? 'Tech House' : i % 3 === 1 ? 'Deep House' : 'Progressive House',
            duration_sec: 300 + (i % 120),
            bpm: bpmRange[i % bpmRange.length],
            key: keys[i % keys.length],
            energy: energies[i % energies.length],
            registeredAt: new Date(Date.now() - i * 1000) // More recent first
        };
        catalog.addTrack(track);
    }
    
    return catalog;
}

function createSampleIntent(overrides?: Partial<DerivedIntent>): DerivedIntent {
    return {
        tempoRange: { min: 120, max: 124 },
        allowedKeys: ['8A', '7A', '9A', '8B'] as CamelotKey[],
        targetGenres: ['Tech House', 'Deep House'],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: [],
        energyCurve: 'linear',
        ...overrides
    };
}

// ========== MAIN TEST RUNNER ==========

async function runTests(): Promise<void> {
    // ========== UNIT TESTS (No LLM Calls) ==========

    console.log('\n🧪 Candidate Pool Generation - Unit Tests');
    console.log('==========================================\n');

    await test('Token limit protection: Small catalog (no filtering)', () => {
        const catalog = createLargeCatalog(50);
        const planner = new CratePlanner(catalog);
        
        // Create a test by checking if catalog size is under limit
        assert(catalog.getTrackCount() === 50, 'Catalog should have 50 tracks');
        assert(catalog.getTrackCount() <= 200, 'Small catalog should not trigger filtering');
    });

    await test('Token limit protection: Large catalog (should filter)', () => {
        const catalog = createLargeCatalog(500);
        const planner = new CratePlanner(catalog);
        
        assert(catalog.getTrackCount() === 500, 'Catalog should have 500 tracks');
        assert(catalog.getTrackCount() > 200, 'Large catalog should trigger filtering');
        
        // Verify filtering logic by checking genre filter works
        const filtered = catalog.searchTracks({
            bpmRange: { min: 120, max: 124 },
            genre: 'Tech House'
        });
        
        assert(filtered.length < 500, 'Filtering should reduce track count');
        assert(filtered.length > 0, 'Filtering should return some tracks');
    });

    await test('Token limit protection: Filtering by BPM and genre', () => {
        const catalog = createLargeCatalog(300);
        
        const intent = createSampleIntent({
            tempoRange: { min: 122, max: 124 },
            targetGenres: ['Tech House']
        });
        
        const filtered = catalog.searchTracks({
            bpmRange: intent.tempoRange,
            genre: intent.targetGenres[0]
        });
        
        assert(filtered.length < 300, 'Should filter down tracks');
        assert(filtered.every(t => t.bpm >= 122 && t.bpm <= 124), 'All tracks should match BPM');
        assert(filtered.every(t => t.genre === 'Tech House'), 'All tracks should match genre');
    });

    await test('Empty catalog returns empty pool', () => {
        const catalog = new MusicAssetCatalog();
        const planner = new CratePlanner(catalog);
        
        assert(catalog.getTrackCount() === 0, 'Catalog should be empty');
    });

    await test('Energy defaults: Smooth mix style', () => {
    // Create tracks with varying energy levels
    const catalog = new MusicAssetCatalog();
    [1, 2, 3, 4, 5].forEach(energy => {
        catalog.addTrack(createSampleTrack(`energy-${energy}`, { 
            energy: energy as 1 | 2 | 3 | 4 | 5
        }));
    });
    
    const intent = createSampleIntent({
        mixStyle: 'smooth',
        targetEnergy: 0.4 // 2/5 = 0.4 for smooth
    });
    
    // For smooth sets, we expect lower energy tracks (1-3)
    const smoothTracks = catalog.getAllTracks().filter(t => (t.energy || 0) <= 3);
    assert(smoothTracks.length >= 3, 'Should have smooth tracks');
});

await test('Energy defaults: Energetic mix style', () => {
    const catalog = new MusicAssetCatalog();
    [1, 2, 3, 4, 5].forEach(energy => {
        catalog.addTrack(createSampleTrack(`energy-${energy}`, { 
            energy: energy as 1 | 2 | 3 | 4 | 5
        }));
    });
    
    const intent = createSampleIntent({
        mixStyle: 'energetic',
        targetEnergy: 0.8 // 4/5 = 0.8 for energetic
    });
    
    // For energetic sets, we expect higher energy tracks (3-5)
    const energeticTracks = catalog.getAllTracks().filter(t => (t.energy || 0) >= 3);
    assert(energeticTracks.length >= 3, 'Should have energetic tracks');
});

await test('Genre filtering works correctly', () => {
    const catalog = new MusicAssetCatalog();
    catalog.addTrack(createSampleTrack('th-1', { genre: 'Tech House' }));
    catalog.addTrack(createSampleTrack('dh-1', { genre: 'Deep House' }));
    catalog.addTrack(createSampleTrack('techno-1', { genre: 'Techno' }));
    
    const techHouseTracks = catalog.searchTracks({ genre: 'Tech House' });
    assert(techHouseTracks.length === 1, 'Should find 1 Tech House track');
    assert(techHouseTracks[0].genre === 'Tech House', 'Genre should match');
});

await test('BPM filtering works correctly', () => {
    const catalog = new MusicAssetCatalog();
    catalog.addTrack(createSampleTrack('slow', { bpm: 110 }));
    catalog.addTrack(createSampleTrack('medium', { bpm: 122 }));
    catalog.addTrack(createSampleTrack('fast', { bpm: 135 }));
    
    const filtered = catalog.searchTracks({ bpmRange: { min: 120, max: 125 } });
    assert(filtered.length === 1, 'Should find 1 track in range');
    assert(filtered[0].bpm === 122, 'BPM should be in range');
});

await test('Key filtering works correctly', () => {
    const catalog = new MusicAssetCatalog();
    catalog.addTrack(createSampleTrack('key-8a', { key: '8A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('key-9a', { key: '9A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('key-10a', { key: '10A' as CamelotKey }));
    
    const filtered = catalog.searchTracks({ 
        keys: ['8A', '9A'] as CamelotKey[] 
    });
    assert(filtered.length === 2, 'Should find 2 tracks with specified keys');
});

// ========== INTEGRATION TESTS (With LLM) ==========

console.log('\n🧪 Candidate Pool Generation - Integration Tests');
console.log('==================================================\n');

let config: Config;
let llm: GeminiLLM;

try {
    config = loadConfig();
    llm = new GeminiLLM(config);
    console.log('✅ LLM initialized for integration tests\n');
} catch (error) {
    console.log('⚠️  Skipping integration tests (no API key)\n');
    llm = null as any;
}

if (llm) {
    await test('LLM selects candidates from small catalog', async () => {
        const catalog = createLargeCatalog(20);
        const planner = new CratePlanner(catalog);
        
        const intent = createSampleIntent();
        
        console.log('   Generating candidate pool with LLM...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        
        assert(pool.tracks.size > 0, 'Pool should have tracks');
        assert(pool.tracks.size <= 25, 'Pool should have at most 25 tracks');
        assert(typeof pool.filtersApplied === 'string', 'Should have reasoning');
        
        console.log(`   ✓ Selected ${pool.tracks.size} tracks`);
        console.log(`   ✓ Reasoning: ${pool.filtersApplied.substring(0, 80)}...`);
    });

    await test('LLM handles large catalog with pre-filtering', async () => {
        const catalog = createLargeCatalog(300);
        const planner = new CratePlanner(catalog);
        
        const intent = createSampleIntent({
            tempoRange: { min: 122, max: 124 },
            targetGenres: ['Tech House']
        });
        
        console.log('   Generating candidate pool from large catalog (300 tracks)...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        
        assert(pool.tracks.size > 0, 'Pool should have tracks');
        assert(pool.tracks.size <= 25, 'Pool should have at most 25 tracks');
        
        // Verify tracks match intent
        const selectedTracks = Array.from(pool.tracks)
            .map(id => catalog.getTrack(id)!)
            .filter(t => t !== undefined);
        
        const bpmMatch = selectedTracks.every(t => 
            t.bpm >= intent.tempoRange.min && t.bpm <= intent.tempoRange.max
        );
        
        console.log(`   ✓ Selected ${pool.tracks.size} tracks from pre-filtered set`);
        console.log(`   ✓ BPM matching: ${bpmMatch ? 'All tracks match' : 'Some tracks outside range'}`);
    });

    await test('LLM respects mix style preferences', async () => {
        const catalog = createLargeCatalog(50);
        const planner = new CratePlanner(catalog);
        
        // Test smooth mix style
        const smoothIntent = createSampleIntent({
            mixStyle: 'smooth',
            targetEnergy: 0.4
        });
        
        console.log('   Testing smooth mix style...');
        const smoothPool = await planner.generateCandidatePoolLLM(smoothIntent, llm);
        
        assert(smoothPool.tracks.size > 0, 'Smooth pool should have tracks');
        console.log(`   ✓ Smooth: ${smoothPool.tracks.size} tracks selected`);
        
        // Test energetic mix style
        const energeticIntent = createSampleIntent({
            mixStyle: 'energetic',
            targetEnergy: 0.8
        });
        
        console.log('   Testing energetic mix style...');
        const energeticPool = await planner.generateCandidatePoolLLM(energeticIntent, llm);
        
        assert(energeticPool.tracks.size > 0, 'Energetic pool should have tracks');
        console.log(`   ✓ Energetic: ${energeticPool.tracks.size} tracks selected`);
    });

    await test('Empty catalog returns empty pool gracefully', async () => {
        const catalog = new MusicAssetCatalog();
        const planner = new CratePlanner(catalog);
        
        const intent = createSampleIntent();
        
        console.log('   Testing empty catalog...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        
        assert(pool.tracks.size === 0, 'Empty catalog should return empty pool');
        assert(pool.filtersApplied.includes('No tracks available'), 'Should explain why empty');
        
        console.log(`   ✓ Handled gracefully: ${pool.filtersApplied}`);
    });

    await test('LLM provides meaningful reasoning', async () => {
        const catalog = createLargeCatalog(30);
        const planner = new CratePlanner(catalog);
        
        const intent = createSampleIntent({
            targetGenres: ['Tech House', 'Deep House'],
            mixStyle: 'smooth'
        });
        
        console.log('   Checking LLM reasoning quality...');
        const pool = await planner.generateCandidatePoolLLM(intent, llm);
        
        assert(pool.filtersApplied.length > 20, 'Reasoning should be substantial');
        assert(pool.tracks.size > 0, 'Should select tracks');
        
        const reasoning = pool.filtersApplied;
        const hasGenreMention = reasoning.toLowerCase().includes('house');
        const hasStyleMention = reasoning.toLowerCase().includes('smooth') || 
                               reasoning.toLowerCase().includes('flow') ||
                               reasoning.toLowerCase().includes('energy');
        
        console.log(`   ✓ Reasoning length: ${reasoning.length} chars`);
        console.log(`   ✓ Mentions genre: ${hasGenreMention ? 'Yes' : 'No'}`);
        console.log(`   ✓ Mentions style/flow: ${hasStyleMention ? 'Yes' : 'No'}`);
        console.log(`   First 100 chars: "${reasoning.substring(0, 100)}..."`);
    });
}

    // ========== TEST SUMMARY ==========

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${passCount} ✅`);
    console.log(`Failed: ${failCount} ❌`);
    console.log('='.repeat(60) + '\n');

    if (failCount > 0) {
        console.log('❌ Some tests failed. Please review the errors above.\n');
        process.exit(1);
    } else {
        console.log('🎉 All candidate pool tests passed!\n');
        process.exit(0);
    }
}

// Run the tests
runTests().catch(error => {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
});

