/**
 * Stub Adapter for Competitor Libraries
 *
 * This provides a base implementation that can be extended when
 * competitor libraries (BitECS, ECSY, miniplex, Becsy) are installed.
 *
 * To enable a competitor:
 * 1. Install the library: npm install bitecs
 * 2. Create a new adapter extending this stub
 * 3. Implement all required methods
 */

import type { EcsAdapter } from '../types';

/**
 * Base stub adapter - throws "not implemented" for all methods
 * Used when a competitor library is not installed
 */
export class StubAdapter implements EcsAdapter {
    name: string;
    version: string;
    private installed: boolean;

    constructor(name: string, version: string = '0.0.0', installed: boolean = false) {
        this.name = name;
        this.version = version;
        this.installed = installed;
    }

    private notInstalled(): never {
        throw new Error(
            `${this.name} is not installed. Install with: npm install ${this.name.toLowerCase()}`
        );
    }

    initialize(): void {
        if (!this.installed) this.notInstalled();
    }

    cleanup(): void {
        if (!this.installed) this.notInstalled();
    }

    createEntities(_count: number): void {
        if (!this.installed) this.notInstalled();
    }

    addComponentToAll(): void {
        if (!this.installed) this.notInstalled();
    }

    removeComponentFromAll(): void {
        if (!this.installed) this.notInstalled();
    }

    iterateEntities(): number {
        if (!this.installed) this.notInstalled();
        return 0;
    }

    runSystems(): void {
        if (!this.installed) this.notInstalled();
    }

    serialize(): string {
        if (!this.installed) this.notInstalled();
        return '';
    }

    getEntityCount(): number {
        if (!this.installed) this.notInstalled();
        return 0;
    }
}

/**
 * BitECS Adapter Stub
 *
 * BitECS is a highly-optimized ECS using typed arrays.
 * When installed, implement this adapter with actual BitECS calls.
 *
 * @see https://github.com/NateTheGreatt/bitECS
 */
export class BitEcsAdapter extends StubAdapter {
    constructor() {
        super('BitECS', '0.3.x', false);
    }

    // When BitECS is installed, override these methods:
    // initialize(): Create a world
    // createEntities(): Use addEntity() and addComponent()
    // iterateEntities(): Use defineQuery() and query()
}

/**
 * ECSY Adapter Stub
 *
 * ECSY is a framework-agnostic ECS by Mozilla.
 * When installed, implement this adapter with actual ECSY calls.
 *
 * @see https://github.com/ecsyjs/ecsy
 */
export class EcsyAdapter extends StubAdapter {
    constructor() {
        super('ECSY', '0.4.x', false);
    }

    // When ECSY is installed, override these methods:
    // initialize(): Create a World
    // createEntities(): Use world.createEntity()
    // iterateEntities(): Use this.queries in a System
}

/**
 * Miniplex Adapter Stub
 *
 * Miniplex is a minimal ECS implementation.
 * When installed, implement this adapter with actual Miniplex calls.
 *
 * @see https://github.com/hmans/miniplex
 */
export class MiniplexAdapter extends StubAdapter {
    constructor() {
        super('Miniplex', '2.0.x', false);
    }

    // When Miniplex is installed, override these methods:
    // initialize(): Create a World
    // createEntities(): Use world.add()
    // iterateEntities(): Use world.with()
}

/**
 * Becsy Adapter Stub
 *
 * Becsy is a TypeScript ECS with multi-threading support.
 * When installed, implement this adapter with actual Becsy calls.
 *
 * @see https://github.com/LastOliveGames/becsy
 */
export class BecsyAdapter extends StubAdapter {
    constructor() {
        super('Becsy', '0.17.x', false);
    }

    // When Becsy is installed, override these methods:
    // initialize(): Create a World with WorldBuilder
    // createEntities(): Use world.createEntity()
    // iterateEntities(): Use @query decorator in systems
}

/**
 * Factory function to get available adapters
 */
export function getAvailableAdapters(): EcsAdapter[] {
    const adapters: EcsAdapter[] = [];

    // Always include OrionECS (handled separately)

    // Try to detect installed libraries
    // In a real implementation, this would check if the modules can be imported

    return adapters;
}

/**
 * Check if a library is available
 */
export function isLibraryAvailable(_name: string): boolean {
    try {
        // This would attempt to require the library
        // require(_name);
        return false; // For now, return false until properly implemented
    } catch {
        return false;
    }
}
