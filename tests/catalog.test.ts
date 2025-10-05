/**
 * MusicAssetCatalog Test Cases
 * 
 * Comprehensive tests for the music catalog functionality including:
 * - Track management (add, remove, update, get)
 * - Search and filtering
 * - Statistics and analytics
 * - Import/export functionality
 * - Key compatibility queries
 */

import { MusicAssetCatalog } from '../src/core/catalog';
import { Track, CamelotKey, TrackFilter } from '../src/core/track';

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
 * Test Suite: Basic Track Management
 */
export function testBasicTrackManagement(): void {
    console.log('\n🧪 TEST SUITE: Basic Track Management');
    console.log('======================================\n');

    const catalog = new MusicAssetCatalog();

    // Test 1: Add track
    console.log('✓ Test 1: Add track to catalog');
    const track1 = createSampleTrack('track-001');
    const addedTrack = catalog.addTrack(track1);
    
    if (!addedTrack.registeredAt || !addedTrack.updatedAt) {
        throw new Error('Track should have timestamps after adding');
    }
    console.log(`  Added track: ${addedTrack.artist} - ${addedTrack.title}`);

    // Test 2: Get track
    console.log('\n✓ Test 2: Get track by ID');
    const retrievedTrack = catalog.getTrack('track-001');
    if (!retrievedTrack) {
        throw new Error('Track should be retrievable after adding');
    }
    if (retrievedTrack.id !== 'track-001') {
        throw new Error('Retrieved track ID should match');
    }
    console.log(`  Retrieved: ${retrievedTrack.artist} - ${retrievedTrack.title}`);

    // Test 3: Check track exists
    console.log('\n✓ Test 3: Check if track exists');
    if (!catalog.hasTrack('track-001')) {
        throw new Error('Track should exist in catalog');
    }
    if (catalog.hasTrack('non-existent')) {
        throw new Error('Non-existent track should not exist');
    }
    console.log('  Track existence check passed');

    // Test 4: Get track count
    console.log('\n✓ Test 4: Get track count');
    if (catalog.getTrackCount() !== 1) {
        throw new Error('Track count should be 1');
    }
    console.log(`  Track count: ${catalog.getTrackCount()}`);

    // Test 5: Update track
    console.log('\n✓ Test 5: Update track metadata');
    const updatedTrack = catalog.updateTrack('track-001', {
        title: 'Updated Title',
        bpm: 130
    });
    if (!updatedTrack) {
        throw new Error('Track should be updatable');
    }
    if (updatedTrack.title !== 'Updated Title' || updatedTrack.bpm !== 130) {
        throw new Error('Track updates should be applied');
    }
    console.log(`  Updated track: ${updatedTrack.title} @ ${updatedTrack.bpm} BPM`);

    // Test 6: Remove track
    console.log('\n✓ Test 6: Remove track from catalog');
    const removed = catalog.removeTrack('track-001');
    if (!removed) {
        throw new Error('Track should be removable');
    }
    if (catalog.hasTrack('track-001')) {
        throw new Error('Track should not exist after removal');
    }
    console.log('  Track removed successfully');

    // Test 7: Get non-existent track
    console.log('\n✓ Test 7: Get non-existent track returns undefined');
    const nonExistent = catalog.getTrack('does-not-exist');
    if (nonExistent !== undefined) {
        throw new Error('Non-existent track should return undefined');
    }
    console.log('  Non-existent track handling correct');

    console.log('\n✅ All Basic Track Management tests passed!\n');
}

/**
 * Test Suite: Search and Filtering
 */
export function testSearchAndFiltering(): void {
    console.log('\n🧪 TEST SUITE: Search and Filtering');
    console.log('====================================\n');

    const catalog = new MusicAssetCatalog();

    // Add diverse test tracks
    catalog.addTrack(createSampleTrack('track-001', {
        artist: 'Artist A',
        genre: 'Tech House',
        bpm: 120,
        key: '8A' as CamelotKey,
        energy: 2
    }));

    catalog.addTrack(createSampleTrack('track-002', {
        artist: 'Artist A',
        genre: 'Tech House',
        bpm: 122,
        key: '8A' as CamelotKey,
        energy: 3
    }));

    catalog.addTrack(createSampleTrack('track-003', {
        artist: 'Artist B',
        genre: 'Deep House',
        bpm: 125,
        key: '9A' as CamelotKey,
        energy: 3
    }));

    catalog.addTrack(createSampleTrack('track-004', {
        artist: 'Artist C',
        genre: 'Tech House',
        bpm: 128,
        key: '10A' as CamelotKey,
        energy: 4
    }));

    catalog.addTrack(createSampleTrack('track-005', {
        artist: 'Artist B',
        genre: 'Deep House',
        bpm: 130,
        key: '9B' as CamelotKey,
        energy: 5
    }));

    // Test 1: Get all tracks
    console.log('✓ Test 1: Get all tracks');
    const allTracks = catalog.getAllTracks();
    if (allTracks.length !== 5) {
        throw new Error(`Expected 5 tracks, got ${allTracks.length}`);
    }
    console.log(`  Found ${allTracks.length} tracks`);

    // Test 2: Filter by genre
    console.log('\n✓ Test 2: Filter by genre');
    const techHouseTracks = catalog.searchTracks({ genre: 'Tech House' });
    if (techHouseTracks.length !== 3) {
        throw new Error(`Expected 3 Tech House tracks, got ${techHouseTracks.length}`);
    }
    console.log(`  Found ${techHouseTracks.length} Tech House tracks`);

    // Test 3: Filter by BPM range
    console.log('\n✓ Test 3: Filter by BPM range');
    const bpmFiltered = catalog.searchTracks({
        bpmRange: { min: 120, max: 125 }
    });
    if (bpmFiltered.length !== 3) {
        throw new Error(`Expected 3 tracks in BPM range, got ${bpmFiltered.length}`);
    }
    console.log(`  Found ${bpmFiltered.length} tracks in 120-125 BPM range`);

    // Test 4: Filter by key
    console.log('\n✓ Test 4: Filter by single key');
    const keyFiltered = catalog.searchTracks({ key: '8A' as CamelotKey });
    if (keyFiltered.length !== 2) {
        throw new Error(`Expected 2 tracks in 8A, got ${keyFiltered.length}`);
    }
    console.log(`  Found ${keyFiltered.length} tracks in key 8A`);

    // Test 5: Filter by multiple keys
    console.log('\n✓ Test 5: Filter by multiple keys');
    const multiKeyFiltered = catalog.searchTracks({
        keys: ['8A' as CamelotKey, '9A' as CamelotKey]
    });
    if (multiKeyFiltered.length !== 3) {
        throw new Error(`Expected 3 tracks, got ${multiKeyFiltered.length}`);
    }
    console.log(`  Found ${multiKeyFiltered.length} tracks in keys 8A or 9A`);

    // Test 6: Filter by artist
    console.log('\n✓ Test 6: Filter by artist');
    const artistFiltered = catalog.searchTracks({ artist: 'Artist A' });
    if (artistFiltered.length !== 2) {
        throw new Error(`Expected 2 tracks by Artist A, got ${artistFiltered.length}`);
    }
    console.log(`  Found ${artistFiltered.length} tracks by Artist A`);

    // Test 7: Filter by energy range
    console.log('\n✓ Test 7: Filter by energy range');
    const energyFiltered = catalog.searchTracks({
        energyRange: { min: 3, max: 4 }
    });
    if (energyFiltered.length !== 3) {
        throw new Error(`Expected 3 tracks with energy 3-4, got ${energyFiltered.length}`);
    }
    console.log(`  Found ${energyFiltered.length} tracks with energy 3-4`);

    // Test 8: Exclude artists
    console.log('\n✓ Test 8: Exclude specific artists');
    const excludeFiltered = catalog.searchTracks({
        excludeArtists: ['Artist B']
    });
    if (excludeFiltered.length !== 3) {
        throw new Error(`Expected 3 tracks excluding Artist B, got ${excludeFiltered.length}`);
    }
    console.log(`  Found ${excludeFiltered.length} tracks excluding Artist B`);

    // Test 9: Combined filters
    console.log('\n✓ Test 9: Combined filters (genre + BPM + energy)');
    const combinedFiltered = catalog.searchTracks({
        genre: 'Tech House',
        bpmRange: { min: 120, max: 125 },
        energyRange: { min: 2, max: 3 }
    });
    if (combinedFiltered.length !== 2) {
        throw new Error(`Expected 2 tracks, got ${combinedFiltered.length}`);
    }
    console.log(`  Found ${combinedFiltered.length} tracks matching all criteria`);

    // Test 10: Filter by specific IDs
    console.log('\n✓ Test 10: Filter by specific track IDs');
    const idFiltered = catalog.searchTracks({
        ids: ['track-001', 'track-003', 'track-005']
    });
    if (idFiltered.length !== 3) {
        throw new Error(`Expected 3 tracks, got ${idFiltered.length}`);
    }
    console.log(`  Found ${idFiltered.length} tracks by ID`);

    console.log('\n✅ All Search and Filtering tests passed!\n');
}

/**
 * Test Suite: Key Compatibility
 */
export function testKeyCompatibility(): void {
    console.log('\n🧪 TEST SUITE: Key Compatibility');
    console.log('=================================\n');

    const catalog = new MusicAssetCatalog();

    // Add tracks with various keys
    catalog.addTrack(createSampleTrack('track-8a-1', { key: '8A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('track-8a-2', { key: '8A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('track-8b', { key: '8B' as CamelotKey }));
    catalog.addTrack(createSampleTrack('track-9a', { key: '9A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('track-7a', { key: '7A' as CamelotKey }));
    catalog.addTrack(createSampleTrack('track-10a', { key: '10A' as CamelotKey }));

    // Test 1: Get compatible keys
    console.log('✓ Test 1: Get compatible keys for 8A');
    const compatibleKeys = catalog.getCompatibleKeys('8A' as CamelotKey);
    // Should include: 8A (same), 8B (relative), 9A (next), 7A (prev)
    if (compatibleKeys.length !== 4) {
        throw new Error(`Expected 4 compatible keys, got ${compatibleKeys.length}`);
    }
    console.log(`  Compatible keys: ${compatibleKeys.join(', ')}`);

    // Test 2: Get tracks with compatible keys
    console.log('\n✓ Test 2: Get tracks with compatible keys to 8A');
    const compatibleTracks = catalog.getTracksWithCompatibleKeys('8A' as CamelotKey);
    if (compatibleTracks.length !== 5) {
        throw new Error(`Expected 5 compatible tracks, got ${compatibleTracks.length}`);
    }
    console.log(`  Found ${compatibleTracks.length} harmonically compatible tracks`);

    // Test 3: Get tracks by specific key
    console.log('\n✓ Test 3: Get tracks by specific key');
    const tracks8A = catalog.getTracksByKey('8A' as CamelotKey);
    if (tracks8A.length !== 2) {
        throw new Error(`Expected 2 tracks in 8A, got ${tracks8A.length}`);
    }
    console.log(`  Found ${tracks8A.length} tracks in key 8A`);

    console.log('\n✅ All Key Compatibility tests passed!\n');
}

/**
 * Test Suite: Statistics and Analytics
 */
export function testStatistics(): void {
    console.log('\n🧪 TEST SUITE: Statistics and Analytics');
    console.log('========================================\n');

    const catalog = new MusicAssetCatalog();

    // Add diverse tracks
    catalog.addTrack(createSampleTrack('track-001', {
        genre: 'Tech House',
        bpm: 120,
        key: '8A' as CamelotKey,
        duration_sec: 300
    }));

    catalog.addTrack(createSampleTrack('track-002', {
        genre: 'Tech House',
        bpm: 125,
        key: '8A' as CamelotKey,
        duration_sec: 360
    }));

    catalog.addTrack(createSampleTrack('track-003', {
        genre: 'Deep House',
        bpm: 122,
        key: '9A' as CamelotKey,
        duration_sec: 400
    }));

    catalog.addTrack(createSampleTrack('track-004', {
        genre: 'Tech House',
        bpm: 128,
        key: '8A' as CamelotKey,
        duration_sec: 340
    }));

    // Test 1: Get statistics
    console.log('✓ Test 1: Get catalog statistics');
    const stats = catalog.getStatistics();

    if (stats.totalTracks !== 4) {
        throw new Error(`Expected 4 tracks, got ${stats.totalTracks}`);
    }
    console.log(`  Total tracks: ${stats.totalTracks}`);

    // Test 2: Genre distribution
    console.log('\n✓ Test 2: Genre distribution');
    if (stats.genres.get('Tech House') !== 3) {
        throw new Error('Expected 3 Tech House tracks');
    }
    if (stats.genres.get('Deep House') !== 1) {
        throw new Error('Expected 1 Deep House track');
    }
    console.log(`  Tech House: ${stats.genres.get('Tech House')}`);
    console.log(`  Deep House: ${stats.genres.get('Deep House')}`);

    // Test 3: BPM range
    console.log('\n✓ Test 3: BPM range');
    if (stats.bpmRange.min !== 120 || stats.bpmRange.max !== 128) {
        throw new Error(`Expected BPM range 120-128, got ${stats.bpmRange.min}-${stats.bpmRange.max}`);
    }
    console.log(`  BPM range: ${stats.bpmRange.min}-${stats.bpmRange.max}`);

    // Test 4: Average BPM
    console.log('\n✓ Test 4: Average BPM');
    const expectedAvg = (120 + 125 + 122 + 128) / 4;
    if (Math.abs(stats.averageBPM - expectedAvg) > 0.5) {
        throw new Error(`Expected average BPM ~${expectedAvg}, got ${stats.averageBPM}`);
    }
    console.log(`  Average BPM: ${stats.averageBPM}`);

    // Test 5: Key distribution
    console.log('\n✓ Test 5: Key distribution');
    if (stats.keyDistribution.get('8A' as CamelotKey) !== 3) {
        throw new Error('Expected 3 tracks in 8A');
    }
    console.log(`  Key 8A: ${stats.keyDistribution.get('8A' as CamelotKey)} tracks`);

    // Test 6: Empty catalog statistics
    console.log('\n✓ Test 6: Empty catalog statistics');
    const emptyCatalog = new MusicAssetCatalog();
    const emptyStats = emptyCatalog.getStatistics();
    if (emptyStats.totalTracks !== 0) {
        throw new Error('Empty catalog should have 0 tracks');
    }
    console.log('  Empty catalog handled correctly');

    console.log('\n✅ All Statistics tests passed!\n');
}

/**
 * Test Suite: Bulk Operations
 */
export function testBulkOperations(): void {
    console.log('\n🧪 TEST SUITE: Bulk Operations');
    console.log('===============================\n');

    const catalog = new MusicAssetCatalog();

    // Test 1: Import multiple tracks
    console.log('✓ Test 1: Import multiple tracks');
    const tracksToImport: Track[] = [
        createSampleTrack('bulk-001'),
        createSampleTrack('bulk-002'),
        createSampleTrack('bulk-003')
    ];
    const importCount = catalog.importTracks(tracksToImport);
    if (importCount !== 3) {
        throw new Error(`Expected 3 imported, got ${importCount}`);
    }
    if (catalog.getTrackCount() !== 3) {
        throw new Error('Catalog should have 3 tracks after import');
    }
    console.log(`  Imported ${importCount} tracks`);

    // Test 2: Get multiple tracks by IDs
    console.log('\n✓ Test 2: Get multiple tracks by IDs');
    const multipleTrack = catalog.getTracks(['bulk-001', 'bulk-003']);
    if (multipleTrack.length !== 2) {
        throw new Error(`Expected 2 tracks, got ${multipleTrack.length}`);
    }
    console.log(`  Retrieved ${multipleTrack.length} tracks`);

    // Test 3: Clear catalog
    console.log('\n✓ Test 3: Clear catalog');
    catalog.clear();
    if (catalog.getTrackCount() !== 0) {
        throw new Error('Catalog should be empty after clear');
    }
    console.log('  Catalog cleared successfully');

    console.log('\n✅ All Bulk Operations tests passed!\n');
}

/**
 * Test Suite: Import/Export JSON
 */
export function testImportExportJSON(): void {
    console.log('\n🧪 TEST SUITE: Import/Export JSON');
    console.log('==================================\n');

    const catalog = new MusicAssetCatalog();

    // Add some tracks
    catalog.addTrack(createSampleTrack('json-001', { title: 'Track 1' }));
    catalog.addTrack(createSampleTrack('json-002', { title: 'Track 2' }));

    // Test 1: Export to JSON
    console.log('✓ Test 1: Export catalog to JSON');
    const jsonExport = catalog.exportToJSON();
    const parsed = JSON.parse(jsonExport);
    if (!Array.isArray(parsed) || parsed.length !== 2) {
        throw new Error('Exported JSON should contain 2 tracks');
    }
    console.log(`  Exported ${parsed.length} tracks to JSON`);

    // Test 2: Import from JSON
    console.log('\n✓ Test 2: Import catalog from JSON');
    const newCatalog = new MusicAssetCatalog();
    const importCount = newCatalog.importFromJSON(jsonExport);
    if (importCount !== 2) {
        throw new Error(`Expected 2 imported, got ${importCount}`);
    }
    if (newCatalog.getTrackCount() !== 2) {
        throw new Error('New catalog should have 2 tracks');
    }
    console.log(`  Imported ${importCount} tracks from JSON`);

    // Test 3: Verify imported data
    console.log('\n✓ Test 3: Verify imported track data');
    const importedTrack = newCatalog.getTrack('json-001');
    if (!importedTrack || importedTrack.title !== 'Track 1') {
        throw new Error('Imported track data should match original');
    }
    console.log('  Imported data verified successfully');

    // Test 4: Invalid JSON import
    console.log('\n✓ Test 4: Handle invalid JSON import');
    try {
        newCatalog.importFromJSON('invalid json');
        throw new Error('Should throw error on invalid JSON');
    } catch (error) {
        if (!(error as Error).message.includes('Failed to import')) {
            throw error;
        }
        console.log('  Invalid JSON handled correctly');
    }

    console.log('\n✅ All Import/Export JSON tests passed!\n');
}

/**
 * Test Suite: Helper Methods
 */
export function testHelperMethods(): void {
    console.log('\n🧪 TEST SUITE: Helper Methods');
    console.log('==============================\n');

    const catalog = new MusicAssetCatalog();

    // Add test data
    catalog.addTrack(createSampleTrack('helper-001', {
        genre: 'Tech House',
        artist: 'Artist A',
        bpm: 125
    }));
    catalog.addTrack(createSampleTrack('helper-002', {
        genre: 'Tech House',
        artist: 'Artist B',
        bpm: 128
    }));
    catalog.addTrack(createSampleTrack('helper-003', {
        genre: 'Deep House',
        artist: 'Artist A',
        bpm: 120
    }));

    // Test 1: Get tracks by genre
    console.log('✓ Test 1: Get tracks by genre');
    const genreTracks = catalog.getTracksByGenre('Tech House');
    if (genreTracks.length !== 2) {
        throw new Error(`Expected 2 tracks, got ${genreTracks.length}`);
    }
    console.log(`  Found ${genreTracks.length} Tech House tracks`);

    // Test 2: Get tracks by artist
    console.log('\n✓ Test 2: Get tracks by artist');
    const artistTracks = catalog.getTracksByArtist('Artist A');
    if (artistTracks.length !== 2) {
        throw new Error(`Expected 2 tracks, got ${artistTracks.length}`);
    }
    console.log(`  Found ${artistTracks.length} tracks by Artist A`);

    // Test 3: Get tracks by BPM range
    console.log('\n✓ Test 3: Get tracks by BPM range');
    const bpmTracks = catalog.getTracksByBPMRange(120, 126);
    if (bpmTracks.length !== 2) {
        throw new Error(`Expected 2 tracks, got ${bpmTracks.length}`);
    }
    console.log(`  Found ${bpmTracks.length} tracks in 120-126 BPM`);

    console.log('\n✅ All Helper Methods tests passed!\n');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('🎵 MusicAssetCatalog Test Suite');
    console.log('================================\n');

    try {
        testBasicTrackManagement();
        testSearchAndFiltering();
        testKeyCompatibility();
        testStatistics();
        testBulkOperations();
        testImportExportJSON();
        testHelperMethods();

        console.log('\n🎉 All MusicAssetCatalog tests passed successfully!');
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
