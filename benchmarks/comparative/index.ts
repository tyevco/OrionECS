/**
 * OrionECS Comparative Benchmark Suite
 *
 * Main entry point for running comparative performance benchmarks.
 *
 * Usage:
 *   npm run benchmark:comparative        # Run full benchmark suite
 *   npm run benchmark:comparative:quick  # Run quick benchmarks
 *   npm run benchmark:report             # Generate reports from latest results
 */

export { OrionAdapter } from './adapters';
export * from './history';
export * from './reporter';
export * from './runner';
export * from './scenarios';
export * from './types';
