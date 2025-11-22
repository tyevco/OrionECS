/**
 * React Integration Example for OrionECS
 *
 * This example demonstrates how to integrate OrionECS with React for UI.
 * It shows custom hooks for entity queries, reactive components, and
 * performance optimization patterns.
 *
 * To run this example:
 * 1. Install dependencies: npm install react react-dom
 * 2. Set up a React project with TypeScript
 * 3. Import and use the hooks and components
 * 4. See usage examples at the bottom of this file
 */

// React imports (uncomment when react is installed)
/*
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
  memo,
} from 'react';
import type { FC, ReactNode } from 'react';
*/

import { EngineBuilder } from '../../core/src/engine';
import type { Engine } from '../../core/src/engine';
import type { EntityDef, QueryOptions } from '../../core/src/definitions';

// ============================================================================
// Mock React for this example (remove when React is installed)
// ============================================================================

const React = {
  useState: (initial: any) => [initial, (v: any) => {}],
  useEffect: (fn: any, deps?: any[]) => {},
  useCallback: (fn: any, deps: any[]) => fn,
  useMemo: (fn: any, deps: any[]) => fn(),
  useRef: (initial: any) => ({ current: initial }),
  createContext: (defaultValue: any) => ({
    Provider: ({ children }: any) => children,
    Consumer: ({ children }: any) => children,
  }),
  useContext: (context: any) => null,
  memo: (component: any) => component,
};

type FC<P = {}> = (props: P) => any;
type ReactNode = any;

// ============================================================================
// Components - Game data
// ============================================================================

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Health {
  constructor(
    public current: number = 100,
    public max: number = 100,
  ) {}

  get percentage(): number {
    return (this.current / this.max) * 100;
  }
}

class PlayerStats {
  constructor(
    public level: number = 1,
    public experience: number = 0,
    public experienceToNext: number = 100,
  ) {}

  get progress(): number {
    return (this.experience / this.experienceToNext) * 100;
  }
}

class Inventory {
  items: InventoryItem[] = [];
  maxSlots: number = 20;

  constructor(maxSlots: number = 20) {
    this.maxSlots = maxSlots;
  }

  addItem(item: InventoryItem): boolean {
    if (this.items.length >= this.maxSlots) return false;
    this.items.push(item);
    return true;
  }

  removeItem(index: number): InventoryItem | undefined {
    return this.items.splice(index, 1)[0];
  }

  get isFull(): boolean {
    return this.items.length >= this.maxSlots;
  }
}

interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'quest';
  description: string;
  icon?: string;
  quantity?: number;
}

class PlayerInfo {
  constructor(
    public name: string = 'Player',
    public class: string = 'Warrior',
  ) {}
}

// ============================================================================
// Engine Context
// ============================================================================

interface EngineContextValue {
  engine: Engine | null;
  isRunning: boolean;
}

const EngineContext = React.createContext<EngineContextValue>({
  engine: null,
  isRunning: false,
});

/**
 * Provider component for the ECS engine
 */
interface EngineProviderProps {
  engine: Engine;
  children: ReactNode;
}

const EngineProvider: FC<EngineProviderProps> = ({ engine, children }) => {
  const [isRunning, setIsRunning] = React.useState(false);

  React.useEffect(() => {
    engine.start();
    setIsRunning(true);

    return () => {
      engine.stop();
      setIsRunning(false);
    };
  }, [engine]);

  const value = React.useMemo(
    () => ({
      engine,
      isRunning,
    }),
    [engine, isRunning],
  );

  return React.createElement(EngineContext.Provider, { value }, children);
};

/**
 * Hook to access the engine instance
 */
function useEngine(): Engine {
  const context = React.useContext(EngineContext);
  if (!context.engine) {
    throw new Error('useEngine must be used within EngineProvider');
  }
  return context.engine;
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to query entities matching criteria
 * Re-renders when entities matching the query change
 */
function useEntities(query: QueryOptions): EntityDef[] {
  const engine = useEngine();
  const [entities, setEntities] = React.useState<EntityDef[]>([]);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    // Create query
    const queryObj = engine.createQuery(query);

    // Update entities
    const updateEntities = () => {
      const matched = queryObj.getEntities();
      setEntities([...matched]); // Create new array to trigger re-render
    };

    // Initial update
    updateEntities();

    // Subscribe to entity changes
    // Note: In a real implementation, you'd subscribe to specific events
    // For this example, we'll poll (not optimal but works)
    const interval = setInterval(() => {
      const currentEntities = queryObj.getEntities();
      if (currentEntities.length !== entities.length) {
        updateEntities();
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [engine, JSON.stringify(query)]);

  return entities;
}

/**
 * Hook to access entities with specific tags
 */
function useEntitiesWithTag(tag: string): EntityDef[] {
  const engine = useEngine();
  const [entities, setEntities] = React.useState<EntityDef[]>([]);

  React.useEffect(() => {
    const update = () => {
      const tagged = engine.getEntitiesWithTag(tag);
      setEntities([...tagged]);
    };

    update();

    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [engine, tag]);

  return entities;
}

/**
 * Hook to observe a single entity's component
 * Re-renders when the component changes
 */
function useComponent<T>(entity: EntityDef | null, componentClass: new (...args: any[]) => T): T | null {
  const [component, setComponent] = React.useState<T | null>(null);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (!entity) {
      setComponent(null);
      return;
    }

    if (!entity.hasComponent(componentClass)) {
      setComponent(null);
      return;
    }

    const comp = entity.getComponent(componentClass);
    setComponent(comp);

    // Poll for changes (in real app, use change detection)
    const interval = setInterval(() => {
      setVersion((v) => v + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [entity, componentClass]);

  return component;
}

/**
 * Hook to create and manage an entity
 */
function useCreateEntity(
  name: string,
  setup: (entity: EntityDef) => void,
  deps: any[] = [],
): EntityDef | null {
  const engine = useEngine();
  const [entity, setEntity] = React.useState<EntityDef | null>(null);

  React.useEffect(() => {
    const newEntity = engine.createEntity(name);
    setup(newEntity);
    setEntity(newEntity);

    return () => {
      newEntity.queueFree();
    };
  }, [engine, ...deps]);

  return entity;
}

/**
 * Hook to run a callback every frame
 */
function useGameLoop(callback: (deltaTime: number) => void, deps: any[] = []): void {
  const engine = useEngine();
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    const systemName = `ReactHook_${Date.now()}`;

    engine.createSystem(
      systemName,
      { all: [] },
      {
        priority: -1000,
        after: () => {
          const dt = 1 / 60; // Simplified
          callbackRef.current(dt);
        },
      },
      false,
    );

    return () => {
      // Remove system when unmounting
      // Note: Engine would need a removeSystem method
      // For now, disable it
      const system = engine.getSystem(systemName);
      if (system) {
        system.enabled = false;
      }
    };
  }, [engine, ...deps]);
}

// ============================================================================
// UI Components
// ============================================================================

/**
 * Health Bar Component
 */
interface HealthBarProps {
  entity: EntityDef;
  width?: number;
  height?: number;
  showText?: boolean;
}

const HealthBar: FC<HealthBarProps> = React.memo(
  ({ entity, width = 200, height = 20, showText = true }) => {
    const health = useComponent(entity, Health);

    if (!health) {
      return React.createElement('div', null, 'No health component');
    }

    const percentage = health.percentage;
    const fillColor = percentage > 60 ? '#4ade80' : percentage > 30 ? '#facc15' : '#ef4444';

    const containerStyle = {
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: '#333',
      border: '2px solid #666',
      borderRadius: '4px',
      overflow: 'hidden',
      position: 'relative' as const,
    };

    const fillStyle = {
      width: `${percentage}%`,
      height: '100%',
      backgroundColor: fillColor,
      transition: 'width 0.3s ease, background-color 0.3s ease',
    };

    const textStyle = {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#fff',
      fontSize: '12px',
      fontWeight: 'bold' as const,
      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
    };

    return React.createElement(
      'div',
      { style: containerStyle },
      React.createElement('div', { style: fillStyle }),
      showText &&
        React.createElement('div', { style: textStyle }, `${health.current}/${health.max}`),
    );
  },
);

/**
 * Experience Bar Component
 */
interface ExperienceBarProps {
  entity: EntityDef;
  width?: number;
  height?: number;
}

const ExperienceBar: FC<ExperienceBarProps> = React.memo(({ entity, width = 200, height = 10 }) => {
  const stats = useComponent(entity, PlayerStats);

  if (!stats) return null;

  const containerStyle = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    borderRadius: '2px',
    overflow: 'hidden',
  };

  const fillStyle = {
    width: `${stats.progress}%`,
    height: '100%',
    backgroundColor: '#8b5cf6',
    transition: 'width 0.3s ease',
  };

  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      { style: { fontSize: '10px', color: '#94a3b8', marginBottom: '2px' } },
      `Level ${stats.level} - ${stats.experience}/${stats.experienceToNext} XP`,
    ),
    React.createElement(
      'div',
      { style: containerStyle },
      React.createElement('div', { style: fillStyle }),
    ),
  );
});

/**
 * Player HUD Component
 */
interface PlayerHUDProps {
  playerEntity: EntityDef;
}

const PlayerHUD: FC<PlayerHUDProps> = ({ playerEntity }) => {
  const health = useComponent(playerEntity, Health);
  const stats = useComponent(playerEntity, PlayerStats);
  const info = useComponent(playerEntity, PlayerInfo);

  const containerStyle = {
    position: 'fixed' as const,
    top: '20px',
    left: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '20px',
    borderRadius: '8px',
    color: '#fff',
    fontFamily: 'monospace',
    minWidth: '250px',
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: '#60a5fa',
  };

  const sectionStyle = {
    marginTop: '10px',
  };

  return React.createElement(
    'div',
    { style: containerStyle },
    React.createElement('div', { style: titleStyle }, info?.name || 'Player'),
    React.createElement('div', { style: { fontSize: '12px', color: '#94a3b8' } }, info?.class),
    React.createElement(
      'div',
      { style: sectionStyle },
      React.createElement('div', { style: { fontSize: '12px', marginBottom: '5px' } }, 'Health'),
      React.createElement(HealthBar, { entity: playerEntity, width: 210, showText: true }),
    ),
    stats &&
      React.createElement(
        'div',
        { style: sectionStyle },
        React.createElement(ExperienceBar, { entity: playerEntity, width: 210 }),
      ),
  );
};

/**
 * Inventory Component
 */
interface InventoryProps {
  entity: EntityDef;
  onItemClick?: (item: InventoryItem, index: number) => void;
}

const InventoryComponent: FC<InventoryProps> = ({ entity, onItemClick }) => {
  const inventory = useComponent(entity, Inventory);

  if (!inventory) return null;

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    padding: '16px',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: '8px',
    maxWidth: '400px',
  };

  const slotStyle = {
    width: '64px',
    height: '64px',
    backgroundColor: '#1e293b',
    border: '2px solid #475569',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const slots = [];
  for (let i = 0; i < inventory.maxSlots; i++) {
    const item = inventory.items[i];

    slots.push(
      React.createElement(
        'div',
        {
          key: i,
          style: slotStyle,
          onClick: () => item && onItemClick?.(item, i),
          title: item?.description,
        },
        item &&
          React.createElement(
            'div',
            { style: { textAlign: 'center', fontSize: '10px', color: '#fff' } },
            React.createElement('div', null, item.icon || '📦'),
            React.createElement('div', null, item.quantity || ''),
          ),
      ),
    );
  }

  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      {
        style: {
          fontSize: '14px',
          marginBottom: '8px',
          color: '#94a3b8',
        },
      },
      `Inventory (${inventory.items.length}/${inventory.maxSlots})`,
    ),
    React.createElement('div', { style: containerStyle }, ...slots),
  );
};

/**
 * Entity List Component
 */
interface EntityListProps {
  query: QueryOptions;
  title: string;
  renderEntity: (entity: EntityDef) => ReactNode;
}

const EntityList: FC<EntityListProps> = ({ query, title, renderEntity }) => {
  const entities = useEntities(query);

  const containerStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '16px',
    borderRadius: '8px',
    color: '#fff',
    maxHeight: '400px',
    overflowY: 'auto' as const,
  };

  const titleStyle = {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    marginBottom: '12px',
    color: '#60a5fa',
  };

  return React.createElement(
    'div',
    { style: containerStyle },
    React.createElement('div', { style: titleStyle }, `${title} (${entities.length})`),
    React.createElement(
      'div',
      null,
      ...entities.map((entity) =>
        React.createElement('div', { key: String(entity.id) }, renderEntity(entity)),
      ),
    ),
  );
};

/**
 * Mini-map Component
 */
interface MiniMapProps {
  width?: number;
  height?: number;
  worldWidth: number;
  worldHeight: number;
  playerEntity: EntityDef;
}

const MiniMap: FC<MiniMapProps> = React.memo(
  ({ width = 200, height = 200, worldWidth, worldHeight, playerEntity }) => {
    const entities = useEntities({ all: [Position] });
    const playerPos = useComponent(playerEntity, Position);

    const containerStyle = {
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: '#1e293b',
      border: '2px solid #475569',
      borderRadius: '4px',
      position: 'relative' as const,
      overflow: 'hidden',
    };

    const scaleX = width / worldWidth;
    const scaleY = height / worldHeight;

    return React.createElement(
      'div',
      { style: containerStyle },
      ...entities.map((entity) => {
        const pos = entity.getComponent(Position);
        const isPlayer = entity === playerEntity;

        const dotStyle = {
          position: 'absolute' as const,
          left: `${pos.x * scaleX}px`,
          top: `${pos.y * scaleY}px`,
          width: isPlayer ? '8px' : '4px',
          height: isPlayer ? '8px' : '4px',
          backgroundColor: isPlayer ? '#4ade80' : '#ef4444',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
        };

        return React.createElement('div', { key: String(entity.id), style: dotStyle });
      }),
    );
  },
);

// ============================================================================
// Example Game Setup
// ============================================================================

/**
 * Create example game with entities
 */
function createExampleGame(): Engine {
  const engine = new EngineBuilder().withDebugMode(true).withFixedUpdateFPS(60).build();

  // Create player
  const player = engine.createEntity('Player');
  player.addComponent(Position, 400, 300);
  player.addComponent(Velocity, 0, 0);
  player.addComponent(Health, 80, 100);
  player.addComponent(PlayerStats, 5, 350, 500);
  player.addComponent(PlayerInfo, 'Hero', 'Warrior');
  const inventory = player.addComponent(Inventory, 20);
  player.addTag('player');

  // Add some items to inventory
  inventory.addItem({
    id: 'sword_1',
    name: 'Iron Sword',
    type: 'weapon',
    description: 'A sturdy iron sword',
    icon: '⚔️',
  });

  inventory.addItem({
    id: 'potion_1',
    name: 'Health Potion',
    type: 'consumable',
    description: 'Restores 50 HP',
    icon: '🧪',
    quantity: 3,
  });

  // Create some enemies
  for (let i = 0; i < 5; i++) {
    const enemy = engine.createEntity(`Enemy_${i}`);
    enemy.addComponent(Position, Math.random() * 800, Math.random() * 600);
    enemy.addComponent(Health, 50, 50);
    enemy.addTag('enemy');
  }

  // Movement system
  engine.createSystem(
    'MovementSystem',
    { all: [Position, Velocity] },
    {
      priority: 500,
      act: (entity: EntityDef, pos: Position, vel: Velocity) => {
        const dt = 1 / 60;
        pos.x += vel.dx * dt;
        pos.y += vel.dy * dt;
      },
    },
    true,
  );

  return engine;
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Context
  EngineProvider,
  EngineContext,
  // Hooks
  useEngine,
  useEntities,
  useEntitiesWithTag,
  useComponent,
  useCreateEntity,
  useGameLoop,
  // Components
  HealthBar,
  ExperienceBar,
  PlayerHUD,
  InventoryComponent,
  EntityList,
  MiniMap,
  // Game Components
  Position,
  Velocity,
  Health,
  PlayerStats,
  Inventory,
  PlayerInfo,
  // Setup
  createExampleGame,
};

// ============================================================================
// Usage Example
// ============================================================================

/*

// In your React app:

import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  EngineProvider,
  useEntitiesWithTag,
  PlayerHUD,
  InventoryComponent,
  EntityList,
  MiniMap,
  createExampleGame,
  Health,
} from './examples/integrations/react-example';

// Create game engine
const gameEngine = createExampleGame();

// Main App Component
function App() {
  const players = useEntitiesWithTag('player');
  const player = players[0];

  if (!player) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#0f172a', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff' }}>OrionECS + React Example</h1>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {// Player HUD//}
        <PlayerHUD playerEntity={player} />

        {// Inventory //}
        <InventoryComponent
          entity={player}
          onItemClick={(item, index) => {
            console.log('Clicked item:', item);
          }}
        />

        {// Mini-map //}
        <div style={{ position: 'fixed', bottom: '20px', right: '20px' }}>
          <MiniMap
            playerEntity={player}
            worldWidth={800}
            worldHeight={600}
            width={150}
            height={150}
          />
        </div>
      </div>

      {// Entity List //}
      <div style={{ marginTop: '20px' }}>
        <EntityList
          query={{ tags: ['enemy'] }}
          title="Enemies"
          renderEntity={(entity) => {
            const health = entity.getComponent(Health);
            return (
              <div style={{ padding: '8px', borderBottom: '1px solid #334155' }}>
                {entity.name} - HP: {health.current}/{health.max}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

// Render
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <EngineProvider engine={gameEngine}>
      <App />
    </EngineProvider>
  </React.StrictMode>
);

// Start game loop
function gameLoop() {
  gameEngine.update();
  requestAnimationFrame(gameLoop);
}
gameLoop();

*/
