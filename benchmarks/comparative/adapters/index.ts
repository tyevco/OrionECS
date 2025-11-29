/**
 * ECS Adapter Registry
 *
 * Exports all available adapters for the comparative benchmark suite.
 */

export { Damage, Health, OrionAdapter, Position, Transform, Velocity } from './orion-adapter';
export {
    BecsyAdapter,
    BitEcsAdapter,
    EcsyAdapter,
    getAvailableAdapters,
    isLibraryAvailable,
    MiniplexAdapter,
    StubAdapter,
} from './stub-adapter';
