/**
 * Test Runner - Execute All Test Suites
 * 
 * Runs all CratePilot test suites in sequence with summary reporting.
 * Usage: npx ts-node tests/run_all_tests.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';

interface TestResult {
    suite: string;
    passed: boolean;
    error?: string;
    duration?: number;
}

const testFiles = [
    'catalog.test.ts',
    'scorer.test.ts',
    'validator.test.ts',
    'crate_planner.test.ts'
];

/**
 * Run a single test file
 */
function runTest(testFile: string): TestResult {
    const testPath = path.join(__dirname, testFile);
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Running: ${testFile}`);
    console.log('='.repeat(80));
    
    try {
        execSync(`npx ts-node "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        const duration = Date.now() - startTime;
        return {
            suite: testFile,
            passed: true,
            duration
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            suite: testFile,
            passed: false,
            error: (error as Error).message,
            duration
        };
    }
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
    console.log('\n🎵 CratePilot Test Suite Runner');
    console.log('================================\n');
    console.log(`Running ${testFiles.length} test suites...\n`);
    
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    // Run each test suite
    for (const testFile of testFiles) {
        const result = runTest(testFile);
        results.push(result);
        
        if (!result.passed) {
            console.log(`\n❌ ${testFile} FAILED`);
        }
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Print summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    results.forEach(result => {
        const status = result.passed ? '✅ PASSED' : '❌ FAILED';
        const duration = result.duration ? `(${(result.duration / 1000).toFixed(2)}s)` : '';
        console.log(`${status} ${result.suite} ${duration}`);
        if (result.error) {
            console.log(`         Error: ${result.error}`);
        }
    });
    
    console.log('\n' + '-'.repeat(80));
    console.log(`Total: ${results.length} suites`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('-'.repeat(80) + '\n');
    
    if (failed > 0) {
        console.log('❌ Some tests failed. See details above.\n');
        process.exit(1);
    } else {
        console.log('🎉 All tests passed successfully!\n');
        process.exit(0);
    }
}

// Run the test suite
main().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
});
