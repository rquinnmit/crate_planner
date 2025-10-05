/**
 * Spotify-Specific Field Validation Tests
 * 
 * Tests validation of optional Spotify parameters in DerivedIntent
 */

import { validateDerivedIntent } from '../src/validation/constraints';
import { DerivedIntent } from '../src/core/crate_planner';
import { CamelotKey } from '../src/core/track';

/**
 * Helper to create a valid base intent
 */
function createBaseIntent(): DerivedIntent {
    return {
        tempoRange: { min: 120, max: 130 },
        allowedKeys: ['8A' as CamelotKey],
        targetGenres: ['Tech House'],
        duration: 3600,
        mixStyle: 'smooth',
        mustIncludeArtists: [],
        avoidArtists: [],
        mustIncludeTracks: [],
        avoidTracks: [],
        energyCurve: 'linear'
    };
}

/**
 * Test Suite: Spotify Field Validation
 */
export function testSpotifyFieldValidation(): void {
    console.log('\n🧪 TEST SUITE: Spotify Field Validation');
    console.log('========================================\n');

    // Test 1: Valid targetEnergy
    console.log('✓ Test 1: Valid targetEnergy (0-1)');
    const validEnergy: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: 0.6
    };
    const validEnergyResult = validateDerivedIntent(validEnergy);
    if (!validEnergyResult.isValid) {
        throw new Error(`Valid targetEnergy should pass: ${validEnergyResult.errors.join(', ')}`);
    }
    console.log('  Valid targetEnergy (0.6) passed');

    // Test 2: Invalid targetEnergy < 0
    console.log('\n✓ Test 2: Invalid targetEnergy < 0');
    const lowEnergy: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: -0.5
    };
    const lowEnergyResult = validateDerivedIntent(lowEnergy);
    if (lowEnergyResult.isValid) {
        throw new Error('targetEnergy < 0 should fail validation');
    }
    console.log(`  Error detected: ${lowEnergyResult.errors.find(e => e.includes('targetEnergy'))}`);

    // Test 3: Invalid targetEnergy > 1
    console.log('\n✓ Test 3: Invalid targetEnergy > 1');
    const highEnergy: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: 1.5
    };
    const highEnergyResult = validateDerivedIntent(highEnergy);
    if (highEnergyResult.isValid) {
        throw new Error('targetEnergy > 1 should fail validation');
    }
    console.log(`  Error detected: ${highEnergyResult.errors.find(e => e.includes('targetEnergy'))}`);

    // Test 4: Valid minPopularity
    console.log('\n✓ Test 4: Valid minPopularity (0-100)');
    const validPopularity: DerivedIntent = {
        ...createBaseIntent(),
        minPopularity: 50
    };
    const validPopResult = validateDerivedIntent(validPopularity);
    if (!validPopResult.isValid) {
        throw new Error(`Valid minPopularity should pass: ${validPopResult.errors.join(', ')}`);
    }
    console.log('  Valid minPopularity (50) passed');

    // Test 5: Invalid minPopularity < 0
    console.log('\n✓ Test 5: Invalid minPopularity < 0');
    const lowPopularity: DerivedIntent = {
        ...createBaseIntent(),
        minPopularity: -10
    };
    const lowPopResult = validateDerivedIntent(lowPopularity);
    if (lowPopResult.isValid) {
        throw new Error('minPopularity < 0 should fail validation');
    }
    console.log(`  Error detected: ${lowPopResult.errors.find(e => e.includes('minPopularity'))}`);

    // Test 6: Invalid minPopularity > 100
    console.log('\n✓ Test 6: Invalid minPopularity > 100');
    const highPopularity: DerivedIntent = {
        ...createBaseIntent(),
        minPopularity: 150
    };
    const highPopResult = validateDerivedIntent(highPopularity);
    if (highPopResult.isValid) {
        throw new Error('minPopularity > 100 should fail validation');
    }
    console.log(`  Error detected: ${highPopResult.errors.find(e => e.includes('minPopularity'))}`);

    // Test 7: Boundary values (0 and 1 for energy, 0 and 100 for popularity)
    console.log('\n✓ Test 7: Boundary values');
    const boundaryIntent1: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: 0,
        minPopularity: 0
    };
    const boundary1Result = validateDerivedIntent(boundaryIntent1);
    if (!boundary1Result.isValid) {
        throw new Error(`Boundary values (0, 0) should pass: ${boundary1Result.errors.join(', ')}`);
    }
    
    const boundaryIntent2: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: 1,
        minPopularity: 100
    };
    const boundary2Result = validateDerivedIntent(boundaryIntent2);
    if (!boundary2Result.isValid) {
        throw new Error(`Boundary values (1, 100) should pass: ${boundary2Result.errors.join(', ')}`);
    }
    console.log('  Boundary values (0, 0) and (1, 100) passed');

    // Test 8: Both Spotify fields together
    console.log('\n✓ Test 8: Multiple Spotify fields together');
    const multipleFields: DerivedIntent = {
        ...createBaseIntent(),
        targetEnergy: 0.7,
        minPopularity: 60
    };
    const multipleResult = validateDerivedIntent(multipleFields);
    if (!multipleResult.isValid) {
        throw new Error(`Multiple Spotify fields should pass: ${multipleResult.errors.join(', ')}`);
    }
    console.log('  Multiple Spotify fields validated successfully');

    // Test 9: Undefined Spotify fields (should be valid)
    console.log('\n✓ Test 9: Undefined Spotify fields');
    const noSpotifyFields: DerivedIntent = {
        ...createBaseIntent()
        // targetEnergy and minPopularity intentionally omitted
    };
    const noSpotifyResult = validateDerivedIntent(noSpotifyFields);
    if (!noSpotifyResult.isValid) {
        throw new Error(`Intent without Spotify fields should pass: ${noSpotifyResult.errors.join(', ')}`);
    }
    console.log('  Undefined Spotify fields (optional) validated correctly');

    console.log('\n✅ All Spotify Field Validation tests passed!\n');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('🎵 Spotify Field Validation Test Suite');
    console.log('=======================================\n');

    try {
        testSpotifyFieldValidation();

        console.log('\n🎉 All Spotify field validation tests passed successfully!');
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

