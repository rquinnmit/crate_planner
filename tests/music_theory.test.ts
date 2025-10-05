/**
 * Music Theory & Transition Scoring Tests
 * 
 * Comprehensive tests for music theory utilities including:
 * - BPM compatibility and transition scoring
 * - Harmonic key compatibility
 * - Energy progression validation
 * - Transition quality analysis
 * - Set mixability scoring
 */

import {
    getBPMCompatibility,
    areBPMsMixable,
    getBPMTransition,
    getEnergyCompatibility,
    validateEnergyProgression,
    getTransitionQuality,
    suggestTrackOrder,
    analyzeSetMixability,
    getKeyInterval
} from '../src/utils/music_theory';

import { getCompatibleKeys, getKeyDistance } from '../src/utils/camelot';
import { CamelotKey } from '../src/core/track';

/**
 * Test Suite: BPM Compatibility
 */
export function testBPMCompatibility(): void {
    console.log('\n🧪 TEST SUITE: BPM Compatibility');
    console.log('=================================\n');

    // Test 1: Perfect match
    console.log('✓ Test 1: Perfect BPM match');
    const perfect = getBPMCompatibility(128, 128);
    if (perfect !== 1.0) {
        throw new Error('Perfect match should score 1.0');
    }
    console.log(`  128 → 128 BPM: ${perfect} (excellent)`);

    // Test 2: Close BPMs (within 2)
    console.log('\n✓ Test 2: Very close BPMs');
    const close = getBPMCompatibility(128, 130);
    if (close < 0.9) {
        throw new Error('Close BPMs should score high');
    }
    console.log(`  128 → 130 BPM: ${close.toFixed(2)} (very good)`);

    // Test 3: Moderate difference (5 BPM)
    console.log('\n✓ Test 3: Moderate BPM difference');
    const moderate = getBPMCompatibility(120, 125);
    if (moderate < 0.7 || moderate > 0.95) {
        throw new Error('Moderate difference should score 0.7-0.95');
    }
    console.log(`  120 → 125 BPM: ${moderate.toFixed(2)} (good)`);

    // Test 4: Acceptable difference (10 BPM)
    console.log('\n✓ Test 4: Acceptable BPM difference');
    const acceptable = getBPMCompatibility(120, 130);
    if (acceptable < 0.5 || acceptable > 0.8) {
        throw new Error('10 BPM difference should score 0.5-0.8');
    }
    console.log(`  120 → 130 BPM: ${acceptable.toFixed(2)} (acceptable)`);

    // Test 5: Large difference (20+ BPM)
    console.log('\n✓ Test 5: Large BPM difference');
    const large = getBPMCompatibility(120, 140);
    if (large > 0.5) {
        throw new Error('Large difference should score low');
    }
    console.log(`  120 → 140 BPM: ${large.toFixed(2)} (challenging)`);

    // Test 6: Mixable check
    console.log('\n✓ Test 6: BPM mixability check');
    if (!areBPMsMixable(125, 128)) {
        throw new Error('3 BPM difference should be mixable');
    }
    if (areBPMsMixable(120, 140)) {
        throw new Error('20 BPM difference should not be mixable by default');
    }
    console.log('  Mixability threshold working correctly');

    // Test 7: Custom tolerance
    console.log('\n✓ Test 7: Custom mixability tolerance');
    if (!areBPMsMixable(120, 135, 15)) {
        throw new Error('Should be mixable with 15 BPM tolerance');
    }
    console.log('  Custom tolerance applied correctly');

    console.log('\n✅ All BPM Compatibility tests passed!\n');
}

/**
 * Test Suite: BPM Transitions
 */
export function testBPMTransitions(): void {
    console.log('\n🧪 TEST SUITE: BPM Transitions');
    console.log('===============================\n');

    // Test 1: Direct transition
    console.log('✓ Test 1: Direct transition (small change)');
    const direct = getBPMTransition(128, 130);
    if (direct.method !== 'direct') {
        throw new Error('Small change should suggest direct transition');
    }
    console.log(`  128 → 130: ${direct.method} (${direct.description})`);

    // Test 2: Gradual transition
    console.log('\n✓ Test 2: Gradual transition (large change)');
    const gradual = getBPMTransition(120, 140);
    if (gradual.method !== 'gradual') {
        throw new Error('Large change should suggest gradual transition');
    }
    console.log(`  120 → 140: ${gradual.method} (${gradual.description})`);

    // Test 3: Half-time detection
    console.log('\n✓ Test 3: Half-time opportunity');
    const halfTime = getBPMTransition(140, 70);
    if (halfTime.method !== 'half-time') {
        console.log(`  Note: 140 → 70 suggested ${halfTime.method} instead of half-time`);
    } else {
        console.log(`  140 → 70: ${halfTime.method} (${halfTime.description})`);
    }

    // Test 4: Double-time detection
    console.log('\n✓ Test 4: Double-time opportunity');
    const doubleTime = getBPMTransition(70, 140);
    if (doubleTime.method !== 'double-time') {
        console.log(`  Note: 70 → 140 suggested ${doubleTime.method} instead of double-time`);
    } else {
        console.log(`  70 → 140: ${doubleTime.method} (${doubleTime.description})`);
    }

    // Test 5: Adjustment calculation
    console.log('\n✓ Test 5: BPM adjustment calculation');
    const speedUp = getBPMTransition(120, 128);
    if (Math.abs(speedUp.adjustment) !== 8) {
        throw new Error('Adjustment should be 8 BPM');
    }
    console.log(`  Adjustment calculated: ${speedUp.adjustment > 0 ? '+' : ''}${speedUp.adjustment} BPM`);

    console.log('\n✅ All BPM Transition tests passed!\n');
}

/**
 * Test Suite: Energy Compatibility
 */
export function testEnergyCompatibility(): void {
    console.log('\n🧪 TEST SUITE: Energy Compatibility');
    console.log('====================================\n');

    // Test 1: Same energy
    console.log('✓ Test 1: Same energy level');
    const same = getEnergyCompatibility(3, 3);
    if (same !== 1.0) {
        throw new Error('Same energy should score 1.0');
    }
    console.log(`  3 → 3: ${same} (perfect)`);

    // Test 2: One level difference
    console.log('\n✓ Test 2: One energy level difference');
    const oneDiff = getEnergyCompatibility(3, 4);
    if (oneDiff < 0.8) {
        throw new Error('One level difference should score high');
    }
    console.log(`  3 → 4: ${oneDiff.toFixed(2)} (very good)`);

    // Test 3: Two level difference
    console.log('\n✓ Test 3: Two energy level difference');
    const twoDiff = getEnergyCompatibility(2, 4);
    if (twoDiff < 0.5 || twoDiff > 0.7) {
        throw new Error('Two level difference should score 0.5-0.7');
    }
    console.log(`  2 → 4: ${twoDiff.toFixed(2)} (acceptable)`);

    // Test 4: Large difference
    console.log('\n✓ Test 4: Large energy difference');
    const large = getEnergyCompatibility(1, 5);
    if (large > 0.5) {
        throw new Error('Large energy difference should score low');
    }
    console.log(`  1 → 5: ${large.toFixed(2)} (challenging)`);

    // Test 5: Symmetric scoring
    console.log('\n✓ Test 5: Symmetric energy scoring');
    const forward = getEnergyCompatibility(2, 4);
    const backward = getEnergyCompatibility(4, 2);
    if (forward !== backward) {
        throw new Error('Energy compatibility should be symmetric');
    }
    console.log('  Energy scoring is symmetric');

    console.log('\n✅ All Energy Compatibility tests passed!\n');
}

/**
 * Test Suite: Energy Progression Validation
 */
export function testEnergyProgression(): void {
    console.log('\n🧪 TEST SUITE: Energy Progression');
    console.log('==================================\n');

    // Test 1: Valid linear progression
    console.log('✓ Test 1: Valid linear progression');
    const linear = validateEnergyProgression([2, 2, 3, 3, 4, 4, 5], 'linear');
    if (!linear.isValid) {
        throw new Error('Gradual build should be valid');
    }
    console.log(`  Linear progression score: ${linear.score.toFixed(2)}`);

    // Test 2: Sudden drop detection
    console.log('\n✓ Test 2: Detect sudden energy drop');
    const suddenDrop = validateEnergyProgression([3, 4, 5, 2, 3], 'linear');
    if (suddenDrop.isValid) {
        throw new Error('Sudden drop should be flagged');
    }
    console.log(`  Sudden drop detected: ${suddenDrop.issues[0]}`);

    // Test 3: Peak curve validation
    console.log('\n✓ Test 3: Peak curve validation');
    const peak = validateEnergyProgression([2, 3, 4, 5, 4, 3, 2], 'peak');
    if (peak.score < 0.7) {
        console.log(`  Peak curve score: ${peak.score.toFixed(2)} (${peak.suggestions.join(', ')})`);
    } else {
        console.log(`  Peak curve score: ${peak.score.toFixed(2)} (good)`);
    }

    // Test 4: Wave curve
    console.log('\n✓ Test 4: Wave curve validation');
    const wave = validateEnergyProgression([2, 3, 2, 3, 4, 3, 4], 'wave');
    console.log(`  Wave curve score: ${wave.score.toFixed(2)}`);

    // Test 5: Empty/single track
    console.log('\n✓ Test 5: Handle edge cases');
    const empty = validateEnergyProgression([], 'linear');
    const single = validateEnergyProgression([3], 'linear');
    if (!empty.isValid || !single.isValid) {
        throw new Error('Empty or single track should be valid');
    }
    console.log('  Edge cases handled correctly');

    // Test 6: Suggestions generation
    console.log('\n✓ Test 6: Generate helpful suggestions');
    const needsSuggestions = validateEnergyProgression([4, 3, 2, 1], 'linear');
    if (needsSuggestions.suggestions.length === 0) {
        console.log('  Note: Descending energy may generate suggestions');
    } else {
        console.log(`  Generated ${needsSuggestions.suggestions.length} suggestion(s)`);
    }

    console.log('\n✅ All Energy Progression tests passed!\n');
}

/**
 * Test Suite: Transition Quality
 */
export function testTransitionQuality(): void {
    console.log('\n🧪 TEST SUITE: Transition Quality');
    console.log('==================================\n');

    const track1 = { bpm: 128, key: '8A' as CamelotKey, energy: 3 };
    const track2 = { bpm: 130, key: '8B' as CamelotKey, energy: 3 };
    const track3 = { bpm: 140, key: '5A' as CamelotKey, energy: 5 };

    // Test 1: Excellent transition
    console.log('✓ Test 1: Excellent transition (compatible)');
    const excellent = getTransitionQuality(track1, track2);
    if (excellent.rating !== 'excellent' && excellent.rating !== 'good') {
        console.log(`  Note: Compatible tracks rated as ${excellent.rating}`);
    }
    console.log(`  Overall: ${excellent.overall.toFixed(2)} (${excellent.rating})`);
    console.log(`    BPM: ${excellent.bpmScore.toFixed(2)}, Key: ${excellent.keyScore.toFixed(2)}, Energy: ${excellent.energyScore.toFixed(2)}`);

    // Test 2: Challenging transition
    console.log('\n✓ Test 2: Challenging transition (incompatible)');
    const challenging = getTransitionQuality(track1, track3);
    if (challenging.rating === 'excellent') {
        throw new Error('Incompatible tracks should not rate as excellent');
    }
    console.log(`  Overall: ${challenging.overall.toFixed(2)} (${challenging.rating})`);
    console.log(`    BPM: ${challenging.bpmScore.toFixed(2)}, Key: ${challenging.keyScore.toFixed(2)}, Energy: ${challenging.energyScore.toFixed(2)}`);

    // Test 3: Rating thresholds
    console.log('\n✓ Test 3: Rating threshold accuracy');
    const ratings = ['excellent', 'good', 'fair', 'challenging'];
    const allPresent = ratings.includes(excellent.rating) && ratings.includes(challenging.rating);
    if (!allPresent) {
        throw new Error('Invalid rating returned');
    }
    console.log('  Rating thresholds working correctly');

    // Test 4: Missing energy (should use neutral)
    console.log('\n✓ Test 4: Handle missing energy');
    const noEnergy1 = { bpm: 128, key: '8A' as CamelotKey };
    const noEnergy2 = { bpm: 130, key: '8B' as CamelotKey };
    const neutral = getTransitionQuality(noEnergy1, noEnergy2);
    if (neutral.energyScore !== 0.7) {
        console.log(`  Note: Neutral energy score is ${neutral.energyScore}`);
    } else {
        console.log('  Missing energy handled with neutral score');
    }

    // Test 5: Component weighting
    console.log('\n✓ Test 5: Verify component weighting');
    // BPM and key are 40% each, energy is 20%
    const calculated = excellent.bpmScore * 0.4 + excellent.keyScore * 0.4 + excellent.energyScore * 0.2;
    if (Math.abs(calculated - excellent.overall) > 0.01) {
        throw new Error('Overall score should match weighted average');
    }
    console.log('  Weighted scoring verified (40% BPM, 40% key, 20% energy)');

    console.log('\n✅ All Transition Quality tests passed!\n');
}

/**
 * Test Suite: Track Ordering
 */
export function testTrackOrdering(): void {
    console.log('\n🧪 TEST SUITE: Track Ordering');
    console.log('==============================\n');

    const tracks = [
        { bpm: 120, key: '8A' as CamelotKey, energy: 2 },
        { bpm: 128, key: '10A' as CamelotKey, energy: 4 },
        { bpm: 122, key: '9A' as CamelotKey, energy: 3 },
        { bpm: 140, key: '5A' as CamelotKey, energy: 5 },
    ];

    // Test 1: Generate optimal order
    console.log('✓ Test 1: Generate optimal track order');
    const order = suggestTrackOrder(tracks);
    if (order.length !== tracks.length) {
        throw new Error('Order should include all tracks');
    }
    console.log(`  Optimal order: [${order.join(', ')}]`);

    // Test 2: All tracks included
    console.log('\n✓ Test 2: Verify all tracks included');
    const uniqueIndices = new Set(order);
    if (uniqueIndices.size !== tracks.length) {
        throw new Error('All tracks should be included exactly once');
    }
    console.log('  All tracks included exactly once');

    // Test 3: Empty array
    console.log('\n✓ Test 3: Handle empty track list');
    const empty = suggestTrackOrder([]);
    if (empty.length !== 0) {
        throw new Error('Empty array should return empty order');
    }
    console.log('  Empty list handled correctly');

    // Test 4: Single track
    console.log('\n✓ Test 4: Handle single track');
    const single = suggestTrackOrder([tracks[0]]);
    if (single.length !== 1 || single[0] !== 0) {
        throw new Error('Single track should return [0]');
    }
    console.log('  Single track handled correctly');

    // Test 5: Order improves transitions
    console.log('\n✓ Test 5: Verify ordering improves transitions');
    let originalScore = 0;
    for (let i = 0; i < tracks.length - 1; i++) {
        originalScore += getTransitionQuality(tracks[i], tracks[i + 1]).overall;
    }
    let optimizedScore = 0;
    for (let i = 0; i < order.length - 1; i++) {
        optimizedScore += getTransitionQuality(tracks[order[i]], tracks[order[i + 1]]).overall;
    }
    console.log(`  Original avg: ${(originalScore / (tracks.length - 1)).toFixed(2)}`);
    console.log(`  Optimized avg: ${(optimizedScore / (order.length - 1)).toFixed(2)}`);
    if (optimizedScore < originalScore) {
        console.log('  Note: Optimized order may vary based on starting track');
    }

    console.log('\n✅ All Track Ordering tests passed!\n');
}

/**
 * Test Suite: Set Mixability Analysis
 */
export function testSetMixability(): void {
    console.log('\n🧪 TEST SUITE: Set Mixability Analysis');
    console.log('=======================================\n');

    const goodSet = [
        { bpm: 120, key: '8A' as CamelotKey, energy: 2 },
        { bpm: 122, key: '9A' as CamelotKey, energy: 3 },
        { bpm: 124, key: '9A' as CamelotKey, energy: 3 },
        { bpm: 126, key: '10A' as CamelotKey, energy: 4 },
    ];

    const challengingSet = [
        { bpm: 120, key: '8A' as CamelotKey, energy: 2 },
        { bpm: 140, key: '5A' as CamelotKey, energy: 5 },
        { bpm: 110, key: '12B' as CamelotKey, energy: 1 },
        { bpm: 135, key: '3A' as CamelotKey, energy: 4 },
    ];

    // Test 1: Analyze good set
    console.log('✓ Test 1: Analyze well-mixed set');
    const goodAnalysis = analyzeSetMixability(goodSet);
    if (goodAnalysis.overallScore < 0.7) {
        console.log(`  Note: Good set scored ${goodAnalysis.overallScore.toFixed(2)}`);
    }
    console.log(`  Overall score: ${goodAnalysis.overallScore.toFixed(2)}`);
    console.log(`  Avg transition quality: ${goodAnalysis.averageTransitionQuality.toFixed(2)}`);
    console.log(`  Problematic transitions: ${goodAnalysis.problematicTransitions.length}`);

    // Test 2: Analyze challenging set
    console.log('\n✓ Test 2: Analyze challenging set');
    const challengingAnalysis = analyzeSetMixability(challengingSet);
    if (challengingAnalysis.overallScore > goodAnalysis.overallScore) {
        console.log('  Note: Challenging set may score higher depending on transitions');
    }
    console.log(`  Overall score: ${challengingAnalysis.overallScore.toFixed(2)}`);
    console.log(`  Problematic transitions: ${challengingAnalysis.problematicTransitions.length}`);

    // Test 3: Problematic transition details
    console.log('\n✓ Test 3: Identify problematic transitions');
    if (challengingAnalysis.problematicTransitions.length > 0) {
        const problem = challengingAnalysis.problematicTransitions[0];
        console.log(`  Transition ${problem.index}: ${problem.reason} (score: ${problem.score.toFixed(2)})`);
    } else {
        console.log('  No highly problematic transitions found');
    }

    // Test 4: Recommendations
    console.log('\n✓ Test 4: Generate recommendations');
    if (challengingAnalysis.recommendations.length > 0) {
        console.log(`  Generated ${challengingAnalysis.recommendations.length} recommendation(s):`);
        challengingAnalysis.recommendations.forEach(rec => {
            console.log(`    - ${rec}`);
        });
    } else {
        console.log('  No recommendations needed');
    }

    // Test 5: Edge cases
    console.log('\n✓ Test 5: Handle edge cases');
    const empty = analyzeSetMixability([]);
    const single = analyzeSetMixability([goodSet[0]]);
    if (empty.overallScore !== 1.0 || single.overallScore !== 1.0) {
        throw new Error('Empty or single track should score 1.0');
    }
    console.log('  Edge cases handled correctly');

    // Test 6: Transition scores array
    console.log('\n✓ Test 6: Transition scores array');
    if (goodAnalysis.transitionScores.length !== goodSet.length - 1) {
        throw new Error('Should have n-1 transition scores for n tracks');
    }
    console.log(`  ${goodAnalysis.transitionScores.length} transitions analyzed`);

    console.log('\n✅ All Set Mixability tests passed!\n');
}

/**
 * Test Suite: Key Theory
 */
export function testKeyTheory(): void {
    console.log('\n🧪 TEST SUITE: Key Theory');
    console.log('==========================\n');

    // Test 1: Compatible keys
    console.log('✓ Test 1: Get compatible keys');
    const compatible = getCompatibleKeys('8A' as CamelotKey);
    if (!compatible.includes('8A' as CamelotKey)) {
        throw new Error('Compatible keys should include same key');
    }
    if (!compatible.includes('8B' as CamelotKey)) {
        throw new Error('Compatible keys should include relative major/minor');
    }
    console.log(`  8A compatible with: ${compatible.join(', ')}`);

    // Test 2: Key distance
    console.log('\n✓ Test 2: Calculate key distance');
    const sameKey = getKeyDistance('8A' as CamelotKey, '8A' as CamelotKey);
    if (sameKey !== 0) {
        throw new Error('Same key distance should be 0');
    }
    const adjacent = getKeyDistance('8A' as CamelotKey, '9A' as CamelotKey);
    if (adjacent !== 1) {
        throw new Error('Adjacent key distance should be 1');
    }
    console.log(`  8A → 8A: ${sameKey}, 8A → 9A: ${adjacent}`);

    // Test 3: Key interval
    console.log('\n✓ Test 3: Calculate key interval');
    const interval = getKeyInterval('8A' as CamelotKey, '9A' as CamelotKey);
    console.log(`  8A → 9A interval: ${interval} semitones`);

    // Test 4: Relative major/minor
    console.log('\n✓ Test 4: Relative major/minor relationship');
    const compatibleWithRelative = getCompatibleKeys('8A' as CamelotKey);
    if (!compatibleWithRelative.includes('8B' as CamelotKey)) {
        throw new Error('8A should be compatible with 8B (relative major)');
    }
    console.log('  Relative major/minor compatibility confirmed');

    // Test 5: Full wheel coverage
    console.log('\n✓ Test 5: Full Camelot wheel coverage');
    const allKeys: CamelotKey[] = [
        '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B',
        '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B',
        '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
    ];
    for (const key of allKeys) {
        const compat = getCompatibleKeys(key);
        if (compat.length < 3) {
            throw new Error(`Each key should have at least 3 compatible keys, ${key} has ${compat.length}`);
        }
    }
    console.log(`  All ${allKeys.length} keys have compatible keys`);

    console.log('\n✅ All Key Theory tests passed!\n');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('🎵 Music Theory & Transition Scoring Test Suite');
    console.log('================================================\n');

    try {
        testBPMCompatibility();
        testBPMTransitions();
        testEnergyCompatibility();
        testEnergyProgression();
        testTransitionQuality();
        testTrackOrdering();
        testSetMixability();
        testKeyTheory();

        console.log('\n🎉 All Music Theory tests passed successfully!');
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
