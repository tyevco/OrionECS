/**
 * @orion-ecs/testing
 * Comprehensive testing utilities for OrionECS
 *
 * @module @orion-ecs/testing
 */

// Export all testing utilities
export {
    TestEngineBuilder,
    TestClock,
    TestSystemRunner,
    TestSnapshot,
    createTestEntity,
    createTestEntities,
    createTestEntityFromPrefab,
    setupTestMatchers,
    waitFrames,
    waitUntil,
    createMockComponent,
    getEntitySummary,
    assertEngineClean,
} from './testing';

// Export types
export type { TestEntityOptions, CustomMatchers } from './testing';
