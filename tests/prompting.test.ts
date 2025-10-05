/**
 * Prompting Workflow Tests
 * 
 * Tests the user prompting functionality including:
 * - Prompt generation
 * - Intent parsing  
 * - Field extraction
 * - Validation
 */

import { createDeriveIntentPrompt } from '../src/prompts/crate_prompting';
import { parseDerivedIntent, validateBPMRange, validateDuration } from '../src/llm/parsers';
import { CratePrompt, DerivedIntent } from '../src/core/crate_planner';
import { CamelotKey } from '../src/core/track';

// ========== TEST UTILITIES ==========

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void): void {
    testCount++;
    try {
        fn();
        passCount++;
        console.log(`✅ ${name}`);
    } catch (error) {
        failCount++;
        console.log(`❌ ${name}`);
        console.log(`   Error: ${(error as Error).message}`);
    }
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

function assertContains(text: string, substring: string, message?: string): void {
    if (!text.includes(substring)) {
        throw new Error(message || `Expected text to contain "${substring}"`);
    }
}

// ========== TEST CASES ==========

console.log('\n🧪 Testing User Prompting Workflow');
console.log('===================================\n');

// Test 1: Prompt Generation
test('createDeriveIntentPrompt generates valid prompt', () => {
    const cratePrompt: CratePrompt = {
        tempoRange: { min: 120, max: 124 },
        targetGenre: 'Tech House',
        targetDuration: 3600,
        notes: 'Rooftop sunset party, smooth vibes, building energy'
    };
    
    const seedInfo = '- Artist - Track (120 BPM, 8A, Energy: 3)';
    const prompt = createDeriveIntentPrompt(cratePrompt, seedInfo);
    
    assertContains(prompt, 'You are an expert DJ assistant', 'Should have role definition');
    assertContains(prompt, 'Rooftop sunset party', 'Should include event description');
    assertContains(prompt, '120-124 BPM', 'Should include BPM range');
    assertContains(prompt, 'Tech House', 'Should include genre');
    assertContains(prompt, 'Return ONLY a JSON object', 'Should request JSON output');
    assertContains(prompt, 'tempoRange', 'Should specify expected fields');
});

// Test 2: Parse Complete Intent
test('parseDerivedIntent parses complete valid response', () => {
    const llmResponse = `
    {
        "tempoRange": { "min": 120, "max": 124 },
        "allowedKeys": ["8A", "7A", "9A", "8B"],
        "targetGenres": ["Tech House", "Deep House"],
        "duration": 3600,
        "mixStyle": "smooth",
        "mustIncludeArtists": [],
        "avoidArtists": [],
        "mustIncludeTracks": [],
        "avoidTracks": [],
        "energyCurve": "linear",
        "targetEnergy": 0.6,
        "minPopularity": 40,
        "targetKeyCamelot": "8A"
    }
    `;
    
    const intent = parseDerivedIntent(llmResponse);
    
    assertEquals(intent.tempoRange, { min: 120, max: 124 }, 'Tempo range should match');
    assertEquals(intent.duration, 3600, 'Duration should match');
    assertEquals(intent.mixStyle, 'smooth', 'Mix style should match');
    assertEquals(intent.energyCurve, 'linear', 'Energy curve should match');
    assert(intent.allowedKeys.length === 4, 'Should have 4 allowed keys');
    assert(intent.targetGenres.length === 2, 'Should have 2 target genres');
});

// Test 3: Parse Intent with Optional Spotify Fields
test('parseDerivedIntent captures optional Spotify fields', () => {
    const llmResponse = `
    {
        "tempoRange": { "min": 120, "max": 130 },
        "allowedKeys": [],
        "targetGenres": ["Techno"],
        "duration": 7200,
        "mixStyle": "energetic",
        "mustIncludeArtists": [],
        "avoidArtists": [],
        "mustIncludeTracks": [],
        "avoidTracks": [],
        "energyCurve": "peak",
        "targetEnergy": 0.8,
        "minPopularity": 30,
        "targetKeyCamelot": "10A"
    }
    `;
    
    const intent = parseDerivedIntent(llmResponse);
    
    assertEquals(intent.targetEnergy, 0.8, 'Should capture targetEnergy');
    assertEquals(intent.minPopularity, 30, 'Should capture minPopularity');
    assertEquals(intent.targetKeyCamelot, '10A', 'Should capture targetKeyCamelot');
});

// Test 4: Parse Intent with Missing Optional Fields
test('parseDerivedIntent handles missing optional fields', () => {
    const llmResponse = `
    {
        "tempoRange": { "min": 100, "max": 140 },
        "allowedKeys": [],
        "targetGenres": ["House"],
        "duration": 3600,
        "mixStyle": "smooth",
        "mustIncludeArtists": [],
        "avoidArtists": [],
        "mustIncludeTracks": [],
        "avoidTracks": [],
        "energyCurve": "linear"
    }
    `;
    
    const intent = parseDerivedIntent(llmResponse);
    
    assertEquals(intent.targetEnergy, undefined, 'targetEnergy should be undefined');
    assertEquals(intent.minPopularity, undefined, 'minPopularity should be undefined');
    assertEquals(intent.targetKeyCamelot, undefined, 'targetKeyCamelot should be undefined');
});

// Test 5: Parse Intent with Defaults
test('parseDerivedIntent applies defaults for missing fields', () => {
    const llmResponse = `
    {
        "tempoRange": { "min": 120, "max": 124 },
        "duration": 3600,
        "targetGenres": ["Tech House"]
    }
    `;
    
    const intent = parseDerivedIntent(llmResponse);
    
    assertEquals(intent.mixStyle, 'smooth', 'Should default to smooth');
    assertEquals(intent.energyCurve, 'linear', 'Should default to linear');
    assert(Array.isArray(intent.allowedKeys), 'allowedKeys should be array');
    assert(Array.isArray(intent.mustIncludeArtists), 'mustIncludeArtists should be array');
});

// Test 6: Parse Intent with Extra Text
test('parseDerivedIntent handles LLM response with extra text', () => {
    const llmResponse = `
    Here's the derived intent based on your prompt:
    
    {
        "tempoRange": { "min": 120, "max": 124 },
        "allowedKeys": ["8A"],
        "targetGenres": ["Tech House"],
        "duration": 3600,
        "mixStyle": "smooth",
        "mustIncludeArtists": [],
        "avoidArtists": [],
        "mustIncludeTracks": [],
        "avoidTracks": [],
        "energyCurve": "linear"
    }
    
    This should work well for your event!
    `;
    
    const intent = parseDerivedIntent(llmResponse);
    
    assertEquals(intent.tempoRange, { min: 120, max: 124 }, 'Should extract JSON despite extra text');
});

// Test 7: Validate BPM Range
test('validateBPMRange validates correct range', () => {
    const range = validateBPMRange({ min: 120, max: 124 });
    assertEquals(range, { min: 120, max: 124 }, 'Should validate correct range');
});

test('validateBPMRange rejects invalid range', () => {
    try {
        validateBPMRange({ min: 130, max: 120 });
        throw new Error('Should have thrown error');
    } catch (error) {
        assert((error as Error).message.includes('min <= max'), 'Should reject min > max');
    }
});

test('validateBPMRange rejects negative values', () => {
    try {
        validateBPMRange({ min: -10, max: 120 });
        throw new Error('Should have thrown error');
    } catch (error) {
        assert((error as Error).message.includes('positive'), 'Should reject negative values');
    }
});

// Test 8: Validate Duration
test('validateDuration validates correct duration', () => {
    const duration = validateDuration(3600);
    assertEquals(duration, 3600, 'Should validate correct duration');
});

test('validateDuration rejects negative duration', () => {
    try {
        validateDuration(-100);
        throw new Error('Should have thrown error');
    } catch (error) {
        assert((error as Error).message.includes('positive'), 'Should reject negative duration');
    }
});

// Test 9: Error Handling for Invalid JSON
test('parseDerivedIntent throws on invalid JSON', () => {
    const invalidResponse = 'This is not JSON at all';
    
    try {
        parseDerivedIntent(invalidResponse);
        throw new Error('Should have thrown error');
    } catch (error) {
        assert((error as Error).message.includes('Failed to parse'), 'Should throw parse error');
    }
});

test('parseDerivedIntent throws on missing required fields', () => {
    const incompleteResponse = `
    {
        "tempoRange": { "min": 120, "max": 124 }
    }
    `;
    
    try {
        parseDerivedIntent(incompleteResponse);
        throw new Error('Should have thrown error');
    } catch (error) {
        assert((error as Error).message.includes('duration'), 'Should require duration field');
    }
});

// Test 10: Prompt Includes All Guidelines
test('createDeriveIntentPrompt includes all guidelines', () => {
    const cratePrompt: CratePrompt = {
        notes: 'Test event'
    };
    
    const prompt = createDeriveIntentPrompt(cratePrompt, 'No seeds');
    
    assertContains(prompt, 'tempoRange', 'Should mention tempoRange');
    assertContains(prompt, 'allowedKeys', 'Should mention allowedKeys');
    assertContains(prompt, 'targetGenres', 'Should mention targetGenres');
    assertContains(prompt, 'mixStyle', 'Should mention mixStyle');
    assertContains(prompt, 'energyCurve', 'Should mention energyCurve');
    assertContains(prompt, 'targetEnergy', 'Should mention targetEnergy');
    assertContains(prompt, 'minPopularity', 'Should mention minPopularity');
    assertContains(prompt, 'Guidelines', 'Should include guidelines section');
});

// ========== TEST SUMMARY ==========

console.log('\n' + '='.repeat(50));
console.log('📊 Test Summary');
console.log('='.repeat(50));
console.log(`Total Tests: ${testCount}`);
console.log(`Passed: ${passCount} ✅`);
console.log(`Failed: ${failCount} ❌`);
console.log('='.repeat(50) + '\n');

if (failCount > 0) {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
} else {
    console.log('🎉 All prompting tests passed!\n');
    process.exit(0);
}

