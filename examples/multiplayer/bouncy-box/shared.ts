/**
 * Bouncy Box - Shared Configuration and Components
 *
 * This file contains shared configuration and components used by both
 * the server and client implementations of the Bouncy Box multiplayer example.
 */

import type { NetworkConfig } from '../../../plugins/network/src';

// ============================================================================
// Game Configuration
// ============================================================================

export const GAME_CONFIG = {
    // World bounds
    worldWidth: 800,
    worldHeight: 600,

    // Box properties
    boxWidth: 40,
    boxHeight: 40,
    boxSpeed: 200, // pixels per second

    // Server settings
    serverPort: 8080,
    serverHost: '0.0.0.0',

    // Colors for different players
    playerColors: [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#96CEB4', // Green
        '#FFEAA7', // Yellow
        '#DDA0DD', // Plum
        '#98D8C8', // Mint
        '#F7DC6F', // Gold
    ],
};

// ============================================================================
// Network Configuration
// ============================================================================

export const NETWORK_CONFIG: Partial<NetworkConfig> = {
    tickRate: 25, // Match original bouncy-box (25 ticks/sec)
    snapshotRate: 25, // Broadcast state at same rate
    clientTickRate: 60, // Client renders at 60fps
    interpolationDelay: 80, // 80ms interpolation delay
    reconciliationWindow: 30, // Keep 30 inputs for reconciliation
    enablePrediction: true,
    enableInterpolation: true,
    enableReconciliation: true,
    debug: true,
};

// ============================================================================
// Additional Components
// ============================================================================

/**
 * Box visual component - stores color and dimensions
 */
export class BoxVisual {
    constructor(
        public width: number = GAME_CONFIG.boxWidth,
        public height: number = GAME_CONFIG.boxHeight,
        public color: string = '#FFFFFF'
    ) {}

    toJSON() {
        return {
            width: this.width,
            height: this.height,
            color: this.color,
        };
    }
}

/**
 * Bouncing component - marks an entity as bouncing off walls
 */
export class Bouncing {
    constructor(
        /** Whether currently bouncing (for visual feedback) */
        public isBouncing: boolean = false,
        /** Last bounce timestamp */
        public lastBounceTime: number = 0
    ) {}
}

/**
 * Player info component
 */
export class PlayerInfo {
    constructor(
        public playerName: string = 'Player',
        public score: number = 0,
        public joinedAt: number = Date.now()
    ) {}

    toJSON() {
        return {
            playerName: this.playerName,
            score: this.score,
        };
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a player color by index
 */
export function getPlayerColor(index: number): string {
    return GAME_CONFIG.playerColors[index % GAME_CONFIG.playerColors.length];
}

/**
 * Check if position is within world bounds
 */
export function isInBounds(
    x: number,
    y: number,
    width: number = GAME_CONFIG.boxWidth,
    height: number = GAME_CONFIG.boxHeight
): boolean {
    return (
        x >= 0 &&
        y >= 0 &&
        x + width <= GAME_CONFIG.worldWidth &&
        y + height <= GAME_CONFIG.worldHeight
    );
}

/**
 * Clamp position to world bounds
 */
export function clampToBounds(
    x: number,
    y: number,
    width: number = GAME_CONFIG.boxWidth,
    height: number = GAME_CONFIG.boxHeight
): { x: number; y: number } {
    return {
        x: Math.max(0, Math.min(GAME_CONFIG.worldWidth - width, x)),
        y: Math.max(0, Math.min(GAME_CONFIG.worldHeight - height, y)),
    };
}
