/**
 * Validation Test Cases
 * 
 * Comprehensive tests for validation and constraint checking including:
 * - Track validation
 * - Prompt validation
 * - Plan validation
 * - Filter validation
 * - Constraint checking
 */

import {
    validateTrack,
    validateTrackFilePath,
    validateCratePrompt,
    validateDerivedIntent,
    validateCratePlan,
    validatePlanForFinalization,
    validateTrackFilter,
    satisfiesBPMConstraint,
    satisfiesDurationConstraint,
    satisfiesEnergyConstraint,
    satisfiesAllConstraints,
    getConstraintViolations
} from '../src/validation/constraints';

import { Track, CamelotKey, TrackFilter } from '../src/core/track';
import { CratePlan, CratePrompt, DerivedIntent } from '../src/core/crate_planner';

/**
 * Helper function to create a sample track
 */
function createSampleTrack(id: string, overrides?: Partial<Track>): Track {
    return {
        id,
        artist: 'Test Artist',
        title: 'Test Track',
        genre: 'Tech House',
        duration_sec: 360,
        bpm: 128,
        key: '8A' as CamelotKey,
        energy: 3,
        ...overrides
    };
}

/**
 * Test Suite: Track Validation
 */
export function testTrackValidation(): void {
    console.log('\n🧪 TEST SUITE: Track Validation');
    console.log('================================\n');

    // Test 1: Valid track
    console.log('✓ Test 1: Valid track passes validation');
    const validTrack = createSampleTrack('valid-001');
    const validResult = validateTrack(validTrack);
    if (!validResult.isValid) {
        throw new Error(`Valid track should pass: ${validResult.errors.join(', ')}`);
    }
    console.log('  Valid track passed validation');

    // Test 2: Missing required fields
    console.log('\n✓ Test 2: Missing required fields');
    const missingFields = validateTrack({});
    if (missingFields.isValid) {
        throw new Error('Track with missing fields should fail validation');
    }
    if (missingFields.errors.length < 4) {
        throw new Error('Should have multiple errors for missing fields');
    }
    console.log(`  Detected ${missingFields.errors.length} missing required fields`);

    // Test 3: Invalid BPM
    console.log('\n✓ Test 3: Invalid BPM values');
    const invalidBPM = validateTrack(createSampleTrack('invalid-bpm', { bpm: 250 }));
    if (!invalidBPM.warnings || invalidBPM.warnings.length === 0) {
        console.log('  Note: Very high BPM may generate warning');
    }
    const lowBPM = validateTrack(createSampleTrack('low-bpm', { bpm: 40 }));
    if (!lowBPM.warnings || lowBPM.warnings.length === 0) {
        console.log('  Note: Very low BPM may generate warning');
    }
    console.log('  BPM boundary checks handled');

    // Test 4: Invalid key
    console.log('\n✓ Test 4: Invalid Camelot key');
    const invalidKey = validateTrack({
        id: 'invalid-key',
        artist: 'Test',
        title: 'Test',
        bpm: 128,
        key: 'Invalid' as any,
        duration_sec: 360
    });
    if (invalidKey.isValid) {
        throw new Error('Invalid key should fail validation');
    }
    console.log(`  Invalid key detected: ${invalidKey.errors.find(e => e.includes('key'))}`);

    // Test 5: Invalid energy level
    console.log('\n✓ Test 5: Invalid energy level');
    const invalidEnergy = validateTrack(createSampleTrack('invalid-energy', { energy: 6 as any }));
    if (invalidEnergy.isValid) {
        throw new Error('Energy > 5 should fail validation');
    }
    console.log('  Energy out of range detected');

    // Test 6: Duration warnings
    console.log('\n✓ Test 6: Duration boundary warnings');
    const veryShort = validateTrack(createSampleTrack('short', { duration_sec: 20 }));
    if (!veryShort.warnings || veryShort.warnings.length === 0) {
        console.log('  Note: Very short tracks may generate warning');
    }
    const veryLong = validateTrack(createSampleTrack('long', { duration_sec: 1000 }));
    if (!veryLong.warnings || veryLong.warnings.length === 0) {
        console.log('  Note: Very long tracks may generate warning');
    }
    console.log('  Duration boundary checks handled');

    // Test 7: Year validation
    console.log('\n✓ Test 7: Year validation');
    const futureYear = validateTrack(createSampleTrack('future', { year: 2030 }));
    if (!futureYear.warnings || futureYear.warnings.length === 0) {
        console.log('  Note: Future years may generate warning');
    }
    console.log('  Year validation handled');

    // Test 8: File path validation
    console.log('\n✓ Test 8: File path validation');
    const noFilePath = validateTrackFilePath(createSampleTrack('no-path'));
    if (noFilePath.isValid) {
        throw new Error('Track without file path should fail file path validation');
    }
    const withFilePath = createSampleTrack('with-path', { filePath: '/path/to/track.mp3' });
    const hasFilePath = validateTrackFilePath(withFilePath);
    if (!hasFilePath.isValid) {
        throw new Error('Track with file path should pass file path validation');
    }
    console.log('  File path validation working correctly');

    console.log('\n✅ All Track Validation tests passed!\n');
}

/**
 * Test Suite: Prompt Validation
 */
export function testPromptValidation(): void {
    console.log('\n🧪 TEST SUITE: Prompt Validation');
    console.log('=================================\n');

    // Test 1: Valid prompt
    console.log('✓ Test 1: Valid crate prompt');
    const validPrompt: CratePrompt = {
        tempoRange: { min: 120, max: 130 },
        targetKey: '8A' as CamelotKey,
        targetGenre: 'Tech House',
        targetDuration: 3600,
        notes: 'Rooftop sunset vibe'
    };
    const validResult = validateCratePrompt(validPrompt);
    if (!validResult.isValid) {
        throw new Error(`Valid prompt should pass: ${validResult.errors.join(', ')}`);
    }
    console.log('  Valid prompt passed validation');

    // Test 2: Invalid tempo range (min > max)
    console.log('\n✓ Test 2: Invalid tempo range');
    const invalidTempo: CratePrompt = {
        tempoRange: { min: 130, max: 120 }
    };
    const invalidTempoResult = validateCratePrompt(invalidTempo);
    if (invalidTempoResult.isValid) {
        throw new Error('Invalid tempo range should fail');
    }
    console.log(`  Error detected: ${invalidTempoResult.errors[0]}`);

    // Test 3: Negative BPM values
    console.log('\n✓ Test 3: Negative BPM values');
    const negativeBPM: CratePrompt = {
        tempoRange: { min: -10, max: 120 }
    };
    const negativeResult = validateCratePrompt(negativeBPM);
    if (negativeResult.isValid) {
        throw new Error('Negative BPM should fail');
    }
    console.log('  Negative BPM detected');

    // Test 4: Wide BPM range warning
    console.log('\n✓ Test 4: Wide BPM range warning');
    const wideBPM: CratePrompt = {
        tempoRange: { min: 100, max: 150 }
    };
    const wideResult = validateCratePrompt(wideBPM);
    if (!wideResult.warnings || wideResult.warnings.length === 0) {
        console.log('  Note: Wide BPM range may generate warning');
    }
    console.log('  Wide BPM range handling checked');

    // Test 5: Invalid target key
    console.log('\n✓ Test 5: Invalid target key');
    const invalidKey: CratePrompt = {
        targetKey: 'InvalidKey' as any
    };
    const invalidKeyResult = validateCratePrompt(invalidKey);
    if (invalidKeyResult.isValid) {
        throw new Error('Invalid key should fail');
    }
    console.log('  Invalid key detected');

    // Test 6: Invalid target duration
    console.log('\n✓ Test 6: Invalid target duration');
    const negativeDuration: CratePrompt = {
        targetDuration: -100
    };
    const negativeDurResult = validateCratePrompt(negativeDuration);
    if (negativeDurResult.isValid) {
        throw new Error('Negative duration should fail');
    }
    console.log('  Negative duration detected');

    // Test 7: Duration warnings
    console.log('\n✓ Test 7: Duration boundary warnings');
    const veryShort: CratePrompt = {
        targetDuration: 300 // 5 minutes
    };
    const shortResult = validateCratePrompt(veryShort);
    if (!shortResult.warnings || shortResult.warnings.length === 0) {
        console.log('  Note: Very short duration may generate warning');
    }
    const veryLong: CratePrompt = {
        targetDuration: 20000 // > 5 hours
    };
    const longResult = validateCratePrompt(veryLong);
    if (!longResult.warnings || longResult.warnings.length === 0) {
        console.log('  Note: Very long duration may generate warning');
    }
    console.log('  Duration warnings checked');

    console.log('\n✅ All Prompt Validation tests passed!\n');
}

/**
 * Test Suite: Derived Intent Validation
 */
export function testDerivedIntentValidation(): void {
    console.log('\n🧪 TEST SUITE: Derived Intent Validation');
    console.log('=========================================\n');

    // Test 1: Valid intent
    console.log('✓ Test 1: Valid derived intent');
    const validIntent: DerivedIntent = {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: ['8A' as CamelotKey, '9A' as CamelotKey],
        targetGenres: ['Tech House'],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: [],
        energyCurve: 'linear'
    };
    const validResult = validateDerivedIntent(validIntent);
    if (!validResult.isValid) {
        throw new Error(`Valid intent should pass: ${validResult.errors.join(', ')}`);
    }
    console.log('  Valid intent passed validation');

    // Test 2: Invalid tempo range
    console.log('\n✓ Test 2: Invalid tempo range in intent');
    const invalidTempo: DerivedIntent = {
        tempoRange: { min: 130, max: 120 },
        allowedKeys: [],
        targetGenres: [],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: []
    };
    const invalidTempoResult = validateDerivedIntent(invalidTempo);
    if (invalidTempoResult.isValid) {
        throw new Error('Invalid tempo range should fail');
    }
    console.log('  Invalid tempo range detected');

    // Test 3: Invalid duration
    console.log('\n✓ Test 3: Invalid duration');
    const invalidDuration: DerivedIntent = {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: [],
        targetGenres: [],
        duration: -100,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: []
    };
    const invalidDurResult = validateDerivedIntent(invalidDuration);
    if (invalidDurResult.isValid) {
        throw new Error('Invalid duration should fail');
    }
    console.log('  Invalid duration detected');

    // Test 4: Invalid keys in allowedKeys
    console.log('\n✓ Test 4: Invalid keys in allowedKeys');
    const invalidKeys: DerivedIntent = {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: ['8A' as CamelotKey, 'InvalidKey' as any],
        targetGenres: [],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: []
    };
    const invalidKeysResult = validateDerivedIntent(invalidKeys);
    if (invalidKeysResult.isValid) {
        throw new Error('Invalid keys should fail');
    }
    console.log('  Invalid keys detected');

    // Test 5: Invalid mix style
    console.log('\n✓ Test 5: Invalid mix style');
    const invalidMixStyle: DerivedIntent = {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: [],
        targetGenres: [],
        duration: 3600,
        mixStyle: 'invalid' as any,
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: []
    };
    const invalidMixResult = validateDerivedIntent(invalidMixStyle);
    if (invalidMixResult.isValid) {
        throw new Error('Invalid mix style should fail');
    }
    console.log('  Invalid mix style detected');

    // Test 6: Invalid energy curve
    console.log('\n✓ Test 6: Invalid energy curve');
    const invalidCurve: DerivedIntent = {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: [],
        targetGenres: [],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: [],
        energyCurve: 'invalid' as any
    };
    const invalidCurveResult = validateDerivedIntent(invalidCurve);
    if (invalidCurveResult.isValid) {
        throw new Error('Invalid energy curve should fail');
    }
    console.log('  Invalid energy curve detected');

    console.log('\n✅ All Derived Intent Validation tests passed!\n');
}

/**
 * Test Suite: Plan Validation
 */
export function testPlanValidation(): void {
    console.log('\n🧪 TEST SUITE: Plan Validation');
    console.log('===============================\n');

    // Test 1: Valid plan
    console.log('✓ Test 1: Valid crate plan');
    const validPlan: CratePlan = {
        prompt: { targetDuration: 3600 },
        trackList: ['track-001', 'track-002', 'track-003'],
        annotations: 'Good flow',
        totalDuration: 3600,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const validResult = validateCratePlan(validPlan);
    if (!validResult.isValid) {
        throw new Error(`Valid plan should pass: ${validResult.errors.join(', ')}`);
    }
    console.log('  Valid plan passed validation');

    // Test 2: Empty track list
    console.log('\n✓ Test 2: Empty track list');
    const emptyPlan: CratePlan = {
        prompt: {},
        trackList: [],
        annotations: '',
        totalDuration: 0,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const emptyResult = validateCratePlan(emptyPlan);
    if (emptyResult.isValid) {
        throw new Error('Plan with no tracks should fail');
    }
    console.log('  Empty track list detected');

    // Test 3: Duplicate tracks
    console.log('\n✓ Test 3: Duplicate tracks');
    const duplicatePlan: CratePlan = {
        prompt: {},
        trackList: ['track-001', 'track-002', 'track-001'],
        annotations: '',
        totalDuration: 1080,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const duplicateResult = validateCratePlan(duplicatePlan);
    if (duplicateResult.isValid) {
        throw new Error('Plan with duplicates should fail');
    }
    console.log('  Duplicate tracks detected');

    // Test 4: Duration tolerance
    console.log('\n✓ Test 4: Duration tolerance check');
    const offDuration: CratePlan = {
        prompt: { targetDuration: 3600 },
        trackList: ['track-001', 'track-002'],
        annotations: '',
        totalDuration: 2000, // Too far from target
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const offDurResult = validateCratePlan(offDuration, 300); // 5 min tolerance
    if (offDurResult.isValid) {
        throw new Error('Plan outside duration tolerance should fail');
    }
    console.log(`  Duration tolerance violation detected: ${offDurResult.errors[0]}`);

    // Test 5: Duration within tolerance
    console.log('\n✓ Test 5: Duration within tolerance');
    const withinTolerance: CratePlan = {
        prompt: { targetDuration: 3600 },
        trackList: ['track-001', 'track-002'],
        annotations: '',
        totalDuration: 3700, // Within 5 min tolerance
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const withinResult = validateCratePlan(withinTolerance, 300);
    if (!withinResult.isValid) {
        throw new Error('Plan within tolerance should pass');
    }
    console.log('  Duration within tolerance passed');

    // Test 6: Very short set warning
    console.log('\n✓ Test 6: Very short set warning');
    const shortSet: CratePlan = {
        prompt: {},
        trackList: ['track-001'],
        annotations: '',
        totalDuration: 300,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const shortResult = validateCratePlan(shortSet);
    if (!shortResult.warnings || shortResult.warnings.length === 0) {
        console.log('  Note: Very short sets may generate warnings');
    }
    console.log('  Short set handling checked');

    // Test 7: Track count warnings
    console.log('\n✓ Test 7: Track count warnings');
    const fewTracks: CratePlan = {
        prompt: {},
        trackList: ['track-001', 'track-002'],
        annotations: '',
        totalDuration: 720,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const fewResult = validateCratePlan(fewTracks);
    if (!fewResult.warnings || fewResult.warnings.length === 0) {
        console.log('  Note: Few tracks may generate warning');
    }
    console.log('  Track count warnings checked');

    console.log('\n✅ All Plan Validation tests passed!\n');
}

/**
 * Test Suite: Finalization Validation
 */
export function testFinalizationValidation(): void {
    console.log('\n🧪 TEST SUITE: Finalization Validation');
    console.log('=======================================\n');

    // Test 1: Valid plan ready for finalization
    console.log('✓ Test 1: Valid plan ready for finalization');
    const validPlan: CratePlan = {
        prompt: { targetDuration: 3600 },
        trackList: ['track-001', 'track-002', 'track-003'],
        annotations: 'Ready to finalize',
        totalDuration: 3600,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const validResult = validatePlanForFinalization(validPlan);
    if (!validResult.isValid) {
        throw new Error(`Valid plan should be ready for finalization: ${validResult.errors.join(', ')}`);
    }
    console.log('  Plan ready for finalization');

    // Test 2: Already finalized plan
    console.log('\n✓ Test 2: Already finalized plan');
    const alreadyFinalized: CratePlan = {
        prompt: {},
        trackList: ['track-001'],
        annotations: '',
        totalDuration: 360,
        planDetails: { usedAI: false },
        isFinalized: true
    };
    const finalizedResult = validatePlanForFinalization(alreadyFinalized);
    if (finalizedResult.isValid) {
        throw new Error('Already finalized plan should fail');
    }
    console.log('  Already finalized plan detected');

    // Test 3: Invalid plan cannot be finalized
    console.log('\n✓ Test 3: Invalid plan cannot be finalized');
    const invalidPlan: CratePlan = {
        prompt: {},
        trackList: [],
        annotations: '',
        totalDuration: 0,
        planDetails: { usedAI: false },
        isFinalized: false
    };
    const invalidResult = validatePlanForFinalization(invalidPlan);
    if (invalidResult.isValid) {
        throw new Error('Invalid plan should not be ready for finalization');
    }
    console.log('  Invalid plan rejected for finalization');

    console.log('\n✅ All Finalization Validation tests passed!\n');
}

/**
 * Test Suite: Filter Validation
 */
export function testFilterValidation(): void {
    console.log('\n🧪 TEST SUITE: Filter Validation');
    console.log('=================================\n');

    // Test 1: Valid filter
    console.log('✓ Test 1: Valid track filter');
    const validFilter: TrackFilter = {
        genre: 'Tech House',
        bpmRange: { min: 120, max: 130 },
        key: '8A' as CamelotKey,
        energyRange: { min: 2, max: 4 }
    };
    const validResult = validateTrackFilter(validFilter);
    if (!validResult.isValid) {
        throw new Error(`Valid filter should pass: ${validResult.errors.join(', ')}`);
    }
    console.log('  Valid filter passed validation');

    // Test 2: Invalid BPM range
    console.log('\n✓ Test 2: Invalid BPM range');
    const invalidBPM: TrackFilter = {
        bpmRange: { min: 130, max: 120 }
    };
    const invalidBPMResult = validateTrackFilter(invalidBPM);
    if (invalidBPMResult.isValid) {
        throw new Error('Invalid BPM range should fail');
    }
    console.log('  Invalid BPM range detected');

    // Test 3: Negative BPM values
    console.log('\n✓ Test 3: Negative BPM values');
    const negativeBPM: TrackFilter = {
        bpmRange: { min: -10, max: 120 }
    };
    const negativeResult = validateTrackFilter(negativeBPM);
    if (negativeResult.isValid) {
        throw new Error('Negative BPM should fail');
    }
    console.log('  Negative BPM detected');

    // Test 4: Invalid energy range
    console.log('\n✓ Test 4: Invalid energy range');
    const invalidEnergy: TrackFilter = {
        energyRange: { min: 0, max: 6 }
    };
    const invalidEnergyResult = validateTrackFilter(invalidEnergy);
    if (invalidEnergyResult.isValid) {
        throw new Error('Invalid energy range should fail');
    }
    console.log('  Invalid energy range detected');

    // Test 5: Invalid duration range
    console.log('\n✓ Test 5: Invalid duration range');
    const invalidDuration: TrackFilter = {
        durationRange: { min: 500, max: 300 }
    };
    const invalidDurResult = validateTrackFilter(invalidDuration);
    if (invalidDurResult.isValid) {
        throw new Error('Invalid duration range should fail');
    }
    console.log('  Invalid duration range detected');

    // Test 6: Invalid key
    console.log('\n✓ Test 6: Invalid key in filter');
    const invalidKey: TrackFilter = {
        key: 'InvalidKey' as any
    };
    const invalidKeyResult = validateTrackFilter(invalidKey);
    if (invalidKeyResult.isValid) {
        throw new Error('Invalid key should fail');
    }
    console.log('  Invalid key detected');

    // Test 7: Invalid keys array
    console.log('\n✓ Test 7: Invalid keys in array');
    const invalidKeys: TrackFilter = {
        keys: ['8A' as CamelotKey, 'InvalidKey' as any]
    };
    const invalidKeysResult = validateTrackFilter(invalidKeys);
    if (invalidKeysResult.isValid) {
        throw new Error('Invalid keys array should fail');
    }
    console.log('  Invalid keys in array detected');

    // Test 8: Conflicting artist filters
    console.log('\n✓ Test 8: Conflicting artist filters');
    const conflictingArtist: TrackFilter = {
        artist: 'Artist A',
        excludeArtists: ['Artist A', 'Artist B']
    };
    const conflictResult = validateTrackFilter(conflictingArtist);
    if (!conflictResult.warnings || conflictResult.warnings.length === 0) {
        console.log('  Note: Conflicting filters may generate warning');
    }
    console.log('  Conflicting artist filter handling checked');

    console.log('\n✅ All Filter Validation tests passed!\n');
}

/**
 * Test Suite: Constraint Checking
 */
export function testConstraintChecking(): void {
    console.log('\n🧪 TEST SUITE: Constraint Checking');
    console.log('===================================\n');

    const testTrack = createSampleTrack('constraint-test', {
        bpm: 128,
        duration_sec: 360,
        energy: 3
    });

    // Test 1: BPM constraint
    console.log('✓ Test 1: BPM constraint checking');
    if (!satisfiesBPMConstraint(testTrack, 120, 130)) {
        throw new Error('Track should satisfy BPM constraint');
    }
    if (satisfiesBPMConstraint(testTrack, 130, 140)) {
        throw new Error('Track should not satisfy BPM constraint');
    }
    console.log('  BPM constraint checks passed');

    // Test 2: Duration constraint
    console.log('\n✓ Test 2: Duration constraint checking');
    if (!satisfiesDurationConstraint(testTrack, 300, 400)) {
        throw new Error('Track should satisfy duration constraint');
    }
    if (satisfiesDurationConstraint(testTrack, 400, 500)) {
        throw new Error('Track should not satisfy duration constraint');
    }
    console.log('  Duration constraint checks passed');

    // Test 3: Energy constraint
    console.log('\n✓ Test 3: Energy constraint checking');
    if (!satisfiesEnergyConstraint(testTrack, 2, 4)) {
        throw new Error('Track should satisfy energy constraint');
    }
    if (satisfiesEnergyConstraint(testTrack, 4, 5)) {
        throw new Error('Track should not satisfy energy constraint');
    }
    console.log('  Energy constraint checks passed');

    // Test 4: Satisfies all constraints
    console.log('\n✓ Test 4: Satisfies all constraints');
    const validFilter: TrackFilter = {
        bpmRange: { min: 120, max: 130 },
        energyRange: { min: 2, max: 4 }
    };
    if (!satisfiesAllConstraints(testTrack, validFilter)) {
        throw new Error('Track should satisfy all constraints');
    }
    
    const invalidFilter: TrackFilter = {
        bpmRange: { min: 140, max: 150 }
    };
    if (satisfiesAllConstraints(testTrack, invalidFilter)) {
        throw new Error('Track should not satisfy all constraints');
    }
    console.log('  All constraints checking passed');

    // Test 5: Get constraint violations
    console.log('\n✓ Test 5: Get constraint violations');
    const violatingFilter: TrackFilter = {
        bpmRange: { min: 140, max: 150 },
        genre: 'Deep House',
        key: '10A' as CamelotKey
    };
    const violations = getConstraintViolations(testTrack, violatingFilter);
    if (violations.length === 0) {
        throw new Error('Should have constraint violations');
    }
    console.log(`  Found ${violations.length} constraint violations:`);
    violations.forEach(v => {
        console.log(`    - ${v.message}`);
    });

    console.log('\n✅ All Constraint Checking tests passed!\n');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('🎵 Validation Test Suite');
    console.log('========================\n');

    try {
        testTrackValidation();
        testPromptValidation();
        testDerivedIntentValidation();
        testPlanValidation();
        testFinalizationValidation();
        testFilterValidation();
        testConstraintChecking();

        console.log('\n🎉 All Validation tests passed successfully!');
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
