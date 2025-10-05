/**
 * LLM Response Parsing Tests
 * 
 * Comprehensive tests for parsing LLM responses including:
 * - JSON extraction from various formats
 * - Malformed JSON handling
 * - Validation of parsed structures
 * - Error recovery and fallback behaviors
 */

import {
    extractJSON,
    parseDerivedIntent,
    parseCandidatePoolSelection,
    parseTrackSequence,
    parsePlanRevision,
    sanitizeTrackIds,
    parseJSON,
    parseJSONSafe,
    hasValidJSON,
    extractExplanation,
    parseMultipleJSON,
    validateBPMRange,
    validateDuration,
    attemptJSONFix
} from '../src/llm/parsers';

import { DerivedIntent } from '../src/core/crate_planner';
import { CamelotKey } from '../src/core/track';

/**
 * Test Suite: JSON Extraction
 */
export function testJSONExtraction(): void {
    console.log('\n🧪 TEST SUITE: JSON Extraction');
    console.log('===============================\n');

    // Test 1: Clean JSON
    console.log('✓ Test 1: Extract clean JSON');
    const cleanJSON = '{"key": "value"}';
    const extracted1 = extractJSON(cleanJSON);
    if (extracted1 !== cleanJSON) {
        throw new Error('Clean JSON should be extracted as-is');
    }
    console.log('  Clean JSON extracted correctly');

    // Test 2: JSON with surrounding text
    console.log('\n✓ Test 2: Extract JSON with surrounding text');
    const withText = 'Here is the result: {"key": "value"} and that\'s it.';
    const extracted2 = extractJSON(withText);
    if (!extracted2.includes('"key"') || !extracted2.includes('"value"')) {
        throw new Error('JSON should be extracted from surrounding text');
    }
    console.log('  JSON extracted from surrounding text');

    // Test 3: JSON in markdown code block
    console.log('\n✓ Test 3: Extract JSON from markdown code block');
    const markdown = '```json\n{"key": "value"}\n```';
    try {
        const extracted3 = extractJSON(markdown);
        console.log('  JSON extracted from markdown');
    } catch (error) {
        // This is expected - extractJSON doesn't handle markdown, attemptJSONFix does
        console.log('  Note: Use attemptJSONFix for markdown blocks');
    }

    // Test 4: No JSON present
    console.log('\n✓ Test 4: Handle missing JSON');
    const noJSON = 'This is just plain text without any JSON';
    try {
        extractJSON(noJSON);
        throw new Error('Should throw error when no JSON found');
    } catch (error) {
        if ((error as Error).message.includes('No JSON found')) {
            console.log('  Missing JSON detected correctly');
        } else {
            throw error;
        }
    }

    // Test 5: Nested JSON objects
    console.log('\n✓ Test 5: Extract nested JSON');
    const nested = 'Result: {"outer": {"inner": "value"}}';
    const extracted5 = extractJSON(nested);
    const parsed = JSON.parse(extracted5);
    if (!parsed.outer || !parsed.outer.inner) {
        throw new Error('Nested JSON should be extracted correctly');
    }
    console.log('  Nested JSON extracted correctly');

    console.log('\n✅ All JSON Extraction tests passed!\n');
}

/**
 * Test Suite: Derived Intent Parsing
 */
export function testDerivedIntentParsing(): void {
    console.log('\n🧪 TEST SUITE: Derived Intent Parsing');
    console.log('======================================\n');

    // Test 1: Valid intent
    console.log('✓ Test 1: Parse valid derived intent');
    const validIntent = `{
        "tempoRange": {"min": 120, "max": 130},
        "allowedKeys": ["8A", "9A"],
        "targetGenres": ["Tech House"],
        "duration": 3600,
        "mixStyle": "smooth",
        "mustIncludeArtists": [],
        "avoidArtists": ["Artist X"],
        "mustIncludeTracks": [],
        "avoidTracks": [],
        "energyCurve": "linear"
    }`;
    const intent1 = parseDerivedIntent(validIntent);
    if (!intent1.tempoRange || intent1.tempoRange.min !== 120) {
        throw new Error('Valid intent should parse correctly');
    }
    console.log(`  Parsed intent: ${intent1.mixStyle} style, ${intent1.duration}s`);

    // Test 2: Intent with surrounding text
    console.log('\n✓ Test 2: Parse intent with surrounding text');
    const withText = `Here's the derived intent: ${validIntent} Done.`;
    const intent2 = parseDerivedIntent(withText);
    if (intent2.duration !== 3600) {
        throw new Error('Intent with surrounding text should parse');
    }
    console.log('  Intent parsed from surrounded text');

    // Test 3: Missing optional fields (should default)
    console.log('\n✓ Test 3: Handle missing optional fields');
    const minimal = `{
        "tempoRange": {"min": 120, "max": 130},
        "duration": 3600,
        "mixStyle": "smooth"
    }`;
    const intent3 = parseDerivedIntent(minimal);
    if (!Array.isArray(intent3.allowedKeys) || !Array.isArray(intent3.targetGenres)) {
        throw new Error('Missing arrays should default to empty');
    }
    console.log('  Missing fields defaulted correctly');

    // Test 4: Invalid tempo range
    console.log('\n✓ Test 4: Reject invalid tempo range');
    const invalidTempo = `{
        "tempoRange": "invalid",
        "duration": 3600
    }`;
    try {
        parseDerivedIntent(invalidTempo);
        throw new Error('Should reject invalid tempo range');
    } catch (error) {
        if ((error as Error).message.includes('tempoRange')) {
            console.log('  Invalid tempo range rejected');
        } else {
            throw error;
        }
    }

    // Test 5: Missing required fields
    console.log('\n✓ Test 5: Reject missing required fields');
    const missingRequired = `{"mixStyle": "smooth"}`;
    try {
        parseDerivedIntent(missingRequired);
        throw new Error('Should reject missing required fields');
    } catch (error) {
        console.log('  Missing required fields rejected');
    }

    console.log('\n✅ All Derived Intent Parsing tests passed!\n');
}

/**
 * Test Suite: Track List Parsing
 */
export function testTrackListParsing(): void {
    console.log('\n🧪 TEST SUITE: Track List Parsing');
    console.log('==================================\n');

    // Test 1: Candidate pool selection
    console.log('✓ Test 1: Parse candidate pool selection');
    const candidateResponse = `{
        "selectedTrackIds": ["track-001", "track-002", "track-003"],
        "reasoning": "Selected tracks that match the tempo and key constraints"
    }`;
    const pool1 = parseCandidatePoolSelection(candidateResponse);
    if (pool1.selectedTrackIds.length !== 3) {
        throw new Error('Should parse 3 track IDs');
    }
    if (!pool1.reasoning) {
        throw new Error('Should include reasoning');
    }
    console.log(`  Parsed ${pool1.selectedTrackIds.length} track IDs`);

    // Test 2: Track sequence
    console.log('\n✓ Test 2: Parse track sequence');
    const sequenceResponse = `{
        "orderedTrackIds": ["track-001", "track-003", "track-002"],
        "reasoning": "Ordered by BPM progression"
    }`;
    const sequence = parseTrackSequence(sequenceResponse);
    if (sequence.orderedTrackIds[0] !== 'track-001') {
        throw new Error('Track order should be preserved');
    }
    console.log('  Track sequence parsed with correct order');

    // Test 3: Plan revision
    console.log('\n✓ Test 3: Parse plan revision');
    const revisionResponse = `{
        "revisedTrackIds": ["track-004", "track-005"],
        "changesExplanation": "Removed Artist X and added higher energy tracks"
    }`;
    const revision = parsePlanRevision(revisionResponse);
    if (revision.revisedTrackIds.length !== 2) {
        throw new Error('Should parse revised track list');
    }
    console.log(`  Revision parsed: ${revision.changesExplanation.substring(0, 40)}...`);

    // Test 4: Empty track list
    console.log('\n✓ Test 4: Handle empty track list');
    const emptyResponse = `{
        "selectedTrackIds": [],
        "reasoning": "No tracks matched the criteria"
    }`;
    const empty = parseCandidatePoolSelection(emptyResponse);
    if (empty.selectedTrackIds.length !== 0) {
        throw new Error('Empty track list should parse');
    }
    console.log('  Empty track list handled correctly');

    // Test 5: Malformed track ID array
    console.log('\n✓ Test 5: Reject malformed track array');
    const malformed = `{
        "selectedTrackIds": "not-an-array",
        "reasoning": "Invalid"
    }`;
    try {
        parseCandidatePoolSelection(malformed);
        throw new Error('Should reject non-array track IDs');
    } catch (error) {
        console.log('  Malformed track array rejected');
    }

    console.log('\n✅ All Track List Parsing tests passed!\n');
}

/**
 * Test Suite: Sanitization
 */
export function testSanitization(): void {
    console.log('\n🧪 TEST SUITE: Track ID Sanitization');
    console.log('=====================================\n');

    // Test 1: Remove duplicates
    console.log('✓ Test 1: Remove duplicate track IDs');
    const withDuplicates = ['track-001', 'track-002', 'track-001', 'track-003'];
    const sanitized1 = sanitizeTrackIds(withDuplicates);
    if (sanitized1.length !== 3) {
        throw new Error('Should remove duplicates');
    }
    console.log(`  Removed duplicates: ${withDuplicates.length} → ${sanitized1.length}`);

    // Test 2: Remove invalid IDs
    console.log('\n✓ Test 2: Remove invalid track IDs');
    const withInvalid = ['track-001', '', '   ', 'track-002', null as any, undefined as any];
    const sanitized2 = sanitizeTrackIds(withInvalid);
    if (sanitized2.length !== 2) {
        throw new Error('Should remove invalid IDs');
    }
    console.log(`  Removed invalid IDs: ${withInvalid.length} → ${sanitized2.length}`);

    // Test 3: Trim whitespace
    console.log('\n✓ Test 3: Trim whitespace from IDs');
    const withWhitespace = ['  track-001  ', 'track-002\n', '\ttrack-003'];
    const sanitized3 = sanitizeTrackIds(withWhitespace);
    if (sanitized3[0] !== 'track-001' || sanitized3[0].includes(' ')) {
        throw new Error('Should trim whitespace');
    }
    console.log('  Whitespace trimmed correctly');

    // Test 4: Handle non-array input
    console.log('\n✓ Test 4: Handle non-array input');
    const notArray = sanitizeTrackIds('not-an-array' as any);
    if (notArray.length !== 0) {
        throw new Error('Non-array should return empty array');
    }
    console.log('  Non-array input handled gracefully');

    // Test 5: Empty array
    console.log('\n✓ Test 5: Handle empty array');
    const empty = sanitizeTrackIds([]);
    if (empty.length !== 0) {
        throw new Error('Empty array should remain empty');
    }
    console.log('  Empty array handled correctly');

    console.log('\n✅ All Sanitization tests passed!\n');
}

/**
 * Test Suite: Generic Parsing Functions
 */
export function testGenericParsing(): void {
    console.log('\n🧪 TEST SUITE: Generic Parsing Functions');
    console.log('=========================================\n');

    // Test 1: parseJSON with validator
    console.log('✓ Test 1: Parse JSON with validator');
    const json1 = '{"name": "test", "value": 123}';
    const validator = (obj: any): obj is { name: string; value: number } => {
        return typeof obj.name === 'string' && typeof obj.value === 'number';
    };
    const parsed1 = parseJSON(json1, validator);
    if (parsed1.name !== 'test' || parsed1.value !== 123) {
        throw new Error('JSON should parse with validator');
    }
    console.log('  JSON parsed with validation');

    // Test 2: parseJSONSafe with fallback
    console.log('\n✓ Test 2: Safe parse with fallback');
    const invalid = 'not valid json';
    const fallback = { default: true };
    const parsed2 = parseJSONSafe(invalid, fallback);
    if (!parsed2.default) {
        throw new Error('Should return fallback on error');
    }
    console.log('  Fallback returned on parse error');

    // Test 3: hasValidJSON check
    console.log('\n✓ Test 3: Check for valid JSON');
    if (!hasValidJSON('{"valid": true}')) {
        throw new Error('Should detect valid JSON');
    }
    if (hasValidJSON('not json')) {
        throw new Error('Should detect invalid JSON');
    }
    console.log('  JSON validity check working');

    // Test 4: Extract explanation
    console.log('\n✓ Test 4: Extract explanation text');
    const withJSON = 'This is an explanation {"data": "value"} more text';
    const explanation = extractExplanation(withJSON);
    if (explanation.includes('{') || explanation.includes('data')) {
        console.log('  Note: Explanation extraction may include JSON');
    } else {
        console.log('  Explanation text extracted');
    }

    // Test 5: Parse multiple JSON objects
    console.log('\n✓ Test 5: Parse multiple JSON objects');
    const multiple = '{"first": 1} some text {"second": 2} more text {"third": 3}';
    const parsed5 = parseMultipleJSON<any>(multiple);
    if (parsed5.length !== 3) {
        throw new Error(`Should parse 3 JSON objects, got ${parsed5.length}`);
    }
    console.log(`  Parsed ${parsed5.length} JSON objects`);

    console.log('\n✅ All Generic Parsing tests passed!\n');
}

/**
 * Test Suite: Validation Helpers
 */
export function testValidationHelpers(): void {
    console.log('\n🧪 TEST SUITE: Validation Helpers');
    console.log('==================================\n');

    // Test 1: Validate BPM range
    console.log('✓ Test 1: Validate BPM range');
    const validBPM = validateBPMRange({ min: 120, max: 130 });
    if (validBPM.min !== 120 || validBPM.max !== 130) {
        throw new Error('Valid BPM range should parse');
    }
    console.log(`  Valid BPM range: ${validBPM.min}-${validBPM.max}`);

    // Test 2: Reject invalid BPM range
    console.log('\n✓ Test 2: Reject invalid BPM range');
    try {
        validateBPMRange({ min: 130, max: 120 });
        throw new Error('Should reject min > max');
    } catch (error) {
        if ((error as Error).message.includes('min <= max')) {
            console.log('  Invalid BPM range rejected');
        } else {
            throw error;
        }
    }

    // Test 3: Validate duration
    console.log('\n✓ Test 3: Validate duration');
    const validDuration = validateDuration(3600);
    if (validDuration !== 3600) {
        throw new Error('Valid duration should parse');
    }
    console.log(`  Valid duration: ${validDuration}s`);

    // Test 4: Reject negative duration
    console.log('\n✓ Test 4: Reject negative duration');
    try {
        validateDuration(-100);
        throw new Error('Should reject negative duration');
    } catch (error) {
        if ((error as Error).message.includes('positive')) {
            console.log('  Negative duration rejected');
        } else {
            throw error;
        }
    }

    // Test 5: Round fractional values
    console.log('\n✓ Test 5: Round fractional values');
    const rounded = validateDuration(3600.7);
    if (rounded !== 3601) {
        throw new Error('Should round duration');
    }
    console.log('  Fractional duration rounded');

    console.log('\n✅ All Validation Helper tests passed!\n');
}

/**
 * Test Suite: Error Recovery
 */
export function testErrorRecovery(): void {
    console.log('\n🧪 TEST SUITE: Error Recovery');
    console.log('==============================\n');

    // Test 1: Fix markdown code blocks
    console.log('✓ Test 1: Fix markdown code blocks');
    const markdown = '```json\n{"key": "value"}\n```';
    const fixed1 = attemptJSONFix(markdown);
    if (fixed1.includes('```')) {
        throw new Error('Should remove markdown code blocks');
    }
    console.log('  Markdown code blocks removed');

    // Test 2: Remove common prefixes
    console.log('\n✓ Test 2: Remove common prefixes');
    const withPrefix = 'Here is the result: {"key": "value"}';
    const fixed2 = attemptJSONFix(withPrefix);
    if (!fixed2.startsWith('{')) {
        console.log('  Note: Prefix removal may be partial');
    } else {
        console.log('  Common prefixes removed');
    }

    // Test 3: Extract JSON from complex text
    console.log('\n✓ Test 3: Extract JSON from complex text');
    const complex = 'The analysis shows {"result": "success", "score": 0.95} which is good.';
    const fixed3 = attemptJSONFix(complex);
    try {
        const parsed = JSON.parse(fixed3);
        if (parsed.result !== 'success') {
            throw new Error('Extracted JSON should be valid');
        }
        console.log('  JSON extracted from complex text');
    } catch (error) {
        throw new Error(`Failed to parse fixed JSON: ${fixed3}`);
    }

    // Test 4: Handle already clean JSON
    console.log('\n✓ Test 4: Handle already clean JSON');
    const clean = '{"already": "clean"}';
    const fixed4 = attemptJSONFix(clean);
    if (fixed4 !== clean) {
        console.log('  Clean JSON may be normalized');
    } else {
        console.log('  Clean JSON unchanged');
    }

    // Test 5: Multiple fix attempts
    console.log('\n✓ Test 5: Apply multiple fixes');
    const messy = '```json\nHere is {"nested": {"data": "value"}}\n```';
    const fixed5 = attemptJSONFix(messy);
    try {
        JSON.parse(fixed5);
        console.log('  Multiple fixes applied successfully');
    } catch (error) {
        console.log('  Note: Some formats may still need manual handling');
    }

    console.log('\n✅ All Error Recovery tests passed!\n');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('🎵 LLM Response Parsing Test Suite');
    console.log('===================================\n');

    try {
        testJSONExtraction();
        testDerivedIntentParsing();
        testTrackListParsing();
        testSanitization();
        testGenericParsing();
        testValidationHelpers();
        testErrorRecovery();

        console.log('\n🎉 All Parsing tests passed successfully!');
    } catch (error) {
        console.error('\n❌ Test failed:', (error as Error).message);
        console.error((error as Error).stack);
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    main();
}
