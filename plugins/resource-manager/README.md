# Resource Manager Plugin

Shared resource management with automatic loading, caching, and reference counting for Orion ECS.

## Overview

The Resource Manager Plugin provides intelligent resource management including:

- **Automatic Loading**: Resources load on-demand when first requested
- **Reference Counting**: Automatic memory management through reference tracking
- **Resource Caching**: Shared resources loaded once and reused
- **Automatic Cleanup**: Resources unload when no longer referenced
- **Type Safety**: Strongly-typed resource system
- **Async Loading**: Support for asynchronous resource loading
- **Usage Statistics**: Monitor resource usage and memory

**Use Cases:**
- Texture and image management
- Audio and music loading
- 3D model and mesh caching
- Font and data file management
- Any shared resource that should be loaded once

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { ResourceManagerPlugin } from '@orion-ecs/resource-manager';

const engine = new EngineBuilder()
  .use(new ResourceManagerPlugin())
  .build();
```

## Quick Start

### Basic Resource Usage

```typescript
import { EngineBuilder } from 'orion-ecs';
import {
  ResourceManagerPlugin,
  TextureResource,
  AudioResource
} from '@orion-ecs/resource-manager';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new ResourceManagerPlugin())
  .build();

// Load resources (automatically cached)
const texture = await engine.resources.get(TextureResource, 'player.png');
const audio = await engine.resources.get(AudioResource, 'music.mp3');

// Use resources
console.log('Texture size:', texture.data.width, 'x', texture.data.height);
console.log('Audio duration:', audio.buffer.duration);

// Get same resource again (returns cached instance)
const sameTexture = await engine.resources.get(TextureResource, 'player.png');
console.log(texture === sameTexture); // true

// Release when done (refCount decreases)
await engine.resources.release(texture);
await engine.resources.release(sameTexture); // Unloads when refCount reaches 0

// View statistics
engine.resources.printStats();
```

## API Reference

### Resource Interface

All resources must implement the `Resource` interface:

```typescript
interface Resource {
  readonly key: string;
  load(): void | Promise<void>;
  unload(): void | Promise<void>;
}
```

### Built-in Resources

#### TextureResource

Example texture resource (for demonstration).

```typescript
class TextureResource implements Resource {
  static resourceTypeName = 'Texture';

  constructor(public readonly key: string) {}

  async load(): Promise<void>
  async unload(): Promise<void>

  get data(): any  // Texture data
  get isLoaded(): boolean
}
```

**Example:**
```typescript
const texture = await engine.resources.get(TextureResource, 'sprite.png');
console.log('Loaded:', texture.isLoaded);
console.log('Data:', texture.data);
```

#### AudioResource

Example audio resource (for demonstration).

```typescript
class AudioResource implements Resource {
  static resourceTypeName = 'Audio';

  constructor(public readonly key: string) {}

  async load(): Promise<void>
  async unload(): Promise<void>

  get buffer(): any  // Audio buffer
  get isLoaded(): boolean
}
```

**Example:**
```typescript
const audio = await engine.resources.get(AudioResource, 'music.mp3');
console.log('Buffer:', audio.buffer);
```

### Registration

#### register<T extends Resource>(resourceType: ResourceType<T>): void

Registers a custom resource type.

```typescript
// Define custom resource
class ModelResource implements Resource {
  static resourceTypeName = 'Model';

  constructor(public readonly key: string) {}

  async load() {
    console.log('Loading model:', this.key);
    // Load model data...
  }

  async unload() {
    console.log('Unloading model:', this.key);
    // Free model data...
  }
}

// Register with resource manager
engine.resources.register(ModelResource);

// Use it
const model = await engine.resources.get(ModelResource, 'character.obj');
```

### Loading Resources

#### get<T extends Resource>(resourceType: ResourceType<T>, key: string, ...args: any[]): Promise<T>

Gets a resource, loading it if necessary.

```typescript
// First call: Loads the resource
const texture1 = await engine.resources.get(TextureResource, 'player.png');

// Second call: Returns cached instance
const texture2 = await engine.resources.get(TextureResource, 'player.png');

console.log(texture1 === texture2); // true
console.log('Reference count: 2');
```

**Behavior:**
- Loads resource if not already loaded
- Returns cached instance if already loaded
- Increments reference count
- Automatically manages memory

#### getSync<T extends Resource>(resourceType: ResourceType<T>, key: string): T | null

Gets a resource synchronously (must be already loaded).

```typescript
// Load async first
await engine.resources.get(TextureResource, 'icon.png');

// Get sync later (instant)
const icon = engine.resources.getSync(TextureResource, 'icon.png');
if (icon) {
  console.log('Got cached resource instantly');
}
```

**Returns:** Resource if loaded, null if not loaded.

#### preload<T extends Resource>(resourceType: ResourceType<T>, keys: string[], ...args: any[]): Promise<void>

Preloads multiple resources without incrementing reference count.

```typescript
// Preload resources at game start
await engine.resources.preload(TextureResource, [
  'player.png',
  'enemy1.png',
  'enemy2.png',
  'background.png',
  'tiles.png'
]);

console.log('All textures preloaded');

// Later: Get instantly (already loaded)
const player = engine.resources.getSync(TextureResource, 'player.png');
```

**Use Cases:**
- Loading screens
- Level preloading
- Reducing runtime lag
- Warming up cache

### Releasing Resources

#### release<T extends Resource>(resource: T): Promise<void>

Releases a resource (decrements reference count).

```typescript
const texture = await engine.resources.get(TextureResource, 'temp.png');

// Use texture...

// Release when done
await engine.resources.release(texture);

// If refCount reaches 0, resource is automatically unloaded
```

**Important:** Always release resources when done to prevent memory leaks.

### Statistics

#### getStats(): ResourceStats

Gets resource usage statistics.

```typescript
const stats = engine.resources.getStats();
console.log('Total types:', stats.totalTypes);
console.log('Total resources:', stats.totalResources);

stats.byType.forEach(type => {
  console.log(`${type.type}:`);
  console.log(`  Count: ${type.count}`);
  console.log(`  Total refs: ${type.totalRefs}`);
  console.log(`  Avg refs: ${type.averageRefs.toFixed(2)}`);
});
```

**Returns:**
```typescript
interface ResourceStats {
  totalTypes: number;
  totalResources: number;
  byType: Array<{
    type: string;
    count: number;
    totalRefs: number;
    averageRefs: number;
  }>;
}
```

#### printStats(): void

Prints formatted resource statistics.

```typescript
engine.resources.printStats();
```

**Output:**
```
════════════════════════════════════════════════════════════
  RESOURCE MANAGER STATISTICS
════════════════════════════════════════════════════════════
  Total Resource Types: 3
  Total Resources Loaded: 45

  By Type:
    Texture:
      Count: 30
      Total References: 75
      Average References: 2.50
    Audio:
      Count: 10
      Total References: 15
      Average References: 1.50
    Model:
      Count: 5
      Total References: 10
      Average References: 2.00
════════════════════════════════════════════════════════════
```

### Cleanup

#### clearAll(): Promise<void>

Unloads all resources immediately (ignores reference counts).

```typescript
// Emergency cleanup
await engine.resources.clearAll();
console.log('All resources cleared');
```

**Warning:** Use with caution. This force-unloads all resources.

#### cleanupUnused(): Promise<number>

Cleans up resources with zero references.

```typescript
const cleaned = await engine.resources.cleanupUnused();
console.log(`Cleaned up ${cleaned} unused resources`);
```

**Returns:** Number of resources cleaned up.

## Examples

### Loading Screen

```typescript
async function loadGameAssets() {
  const loadingScreen = showLoadingScreen();

  try {
    // Preload all game assets
    await engine.resources.preload(TextureResource, [
      'player.png',
      'enemy1.png',
      'enemy2.png',
      'boss.png',
      'background.png',
      'tiles.png',
      'ui/button.png',
      'ui/panel.png'
    ]);

    await engine.resources.preload(AudioResource, [
      'music/level1.mp3',
      'music/boss.mp3',
      'sfx/jump.wav',
      'sfx/shoot.wav',
      'sfx/explosion.wav'
    ]);

    console.log('✓ All assets loaded');
  } catch (error) {
    console.error('Failed to load assets:', error);
  } finally {
    hideLoadingScreen(loadingScreen);
  }
}

// Call at game start
await loadGameAssets();
```

### Sprite System Integration

```typescript
// Component that holds resource reference
class SpriteComponent {
  constructor(
    public texture: TextureResource | null = null,
    public releaseOnDestroy: boolean = true
  ) {}
}

// System to load textures
engine.createSystem('SpriteLoaderSystem', {
  all: [SpriteComponent]
}, {
  act: async (entity, sprite) => {
    if (!sprite.texture && sprite.texturePath) {
      // Load texture on-demand
      sprite.texture = await engine.resources.get(
        TextureResource,
        sprite.texturePath
      );
    }
  }
}, false);

// Cleanup system
engine.on('onEntityReleased', async (entity) => {
  const sprite = entity.getComponent(SpriteComponent);
  if (sprite && sprite.texture && sprite.releaseOnDestroy) {
    await engine.resources.release(sprite.texture);
  }
});
```

### Custom Resource Type

```typescript
// Define custom font resource
class FontResource implements Resource {
  static resourceTypeName = 'Font';

  private font: any = null;

  constructor(
    public readonly key: string,
    private size: number = 16
  ) {}

  async load() {
    console.log(`Loading font: ${this.key} at ${this.size}px`);

    // Simulate font loading
    await new Promise(resolve => setTimeout(resolve, 100));

    this.font = {
      family: this.key,
      size: this.size,
      loaded: true
    };
  }

  async unload() {
    console.log(`Unloading font: ${this.key}`);
    this.font = null;
  }

  get data() {
    return this.font;
  }

  get isLoaded() {
    return this.font !== null;
  }
}

// Register and use
engine.resources.register(FontResource);

const font = await engine.resources.get(FontResource, 'Arial', 24);
console.log('Font loaded:', font.data);
```

### Resource Pool Management

```typescript
// Track active resources per scene
class ResourceTracker {
  private sceneResources = new Map<string, Set<any>>();

  async loadSceneResources(sceneName: string, resources: any[]) {
    const loaded = new Set<any>();

    for (const { type, key } of resources) {
      const resource = await engine.resources.get(type, key);
      loaded.add(resource);
    }

    this.sceneResources.set(sceneName, loaded);
  }

  async unloadScene(sceneName: string) {
    const resources = this.sceneResources.get(sceneName);
    if (!resources) return;

    for (const resource of resources) {
      await engine.resources.release(resource);
    }

    this.sceneResources.delete(sceneName);
    console.log(`✓ Scene "${sceneName}" resources released`);
  }
}

// Usage
const tracker = new ResourceTracker();

await tracker.loadSceneResources('Level1', [
  { type: TextureResource, key: 'level1-bg.png' },
  { type: TextureResource, key: 'level1-tiles.png' },
  { type: AudioResource, key: 'level1-music.mp3' }
]);

// Later...
await tracker.unloadScene('Level1');
```

### Lazy Loading Pattern

```typescript
class LazyResource<T extends Resource> {
  private resource: T | null = null;
  private loading: Promise<T> | null = null;

  constructor(
    private type: ResourceType<T>,
    private key: string
  ) {}

  async get(): Promise<T> {
    if (this.resource) {
      return this.resource;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = engine.resources.get(this.type, this.key);
    this.resource = await this.loading;
    this.loading = null;

    return this.resource;
  }

  async release() {
    if (this.resource) {
      await engine.resources.release(this.resource);
      this.resource = null;
    }
  }
}

// Usage
const lazyTexture = new LazyResource(TextureResource, 'huge-texture.png');

// Doesn't load until accessed
const texture = await lazyTexture.get();

// Release when done
await lazyTexture.release();
```

### Resource Dependency Management

```typescript
class CompositeResource implements Resource {
  static resourceTypeName = 'Composite';

  private dependencies: Resource[] = [];

  constructor(public readonly key: string) {}

  async load() {
    // Load multiple dependent resources
    this.dependencies = await Promise.all([
      engine.resources.get(TextureResource, `${this.key}-diffuse.png`),
      engine.resources.get(TextureResource, `${this.key}-normal.png`),
      engine.resources.get(TextureResource, `${this.key}-specular.png`)
    ]);
  }

  async unload() {
    // Release all dependencies
    await Promise.all(
      this.dependencies.map(dep => engine.resources.release(dep))
    );
    this.dependencies = [];
  }

  get textures() {
    return this.dependencies;
  }
}

// Register and use
engine.resources.register(CompositeResource);

const material = await engine.resources.get(CompositeResource, 'metal');
console.log('Material textures:', material.textures);
```

## Performance Considerations

### Reference Counting

Automatic memory management through reference counting:

```typescript
// refCount = 1
const tex1 = await engine.resources.get(TextureResource, 'sprite.png');

// refCount = 2 (same instance)
const tex2 = await engine.resources.get(TextureResource, 'sprite.png');

// refCount = 1
await engine.resources.release(tex1);

// refCount = 0, automatically unloads
await engine.resources.release(tex2);
```

### Preloading

Preload resources to avoid runtime lag:

```typescript
// Bad: Load during gameplay (causes lag)
const enemy = engine.createEntity();
const texture = await engine.resources.get(TextureResource, 'enemy.png');

// Good: Preload before gameplay
await engine.resources.preload(TextureResource, ['enemy.png']);

// Later: Instant access
const texture = engine.resources.getSync(TextureResource, 'enemy.png');
```

### Memory Management

Monitor and clean up unused resources:

```typescript
// Periodic cleanup
setInterval(async () => {
  const cleaned = await engine.resources.cleanupUnused();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} unused resources`);
  }
}, 60000); // Every minute

// Monitor usage
setInterval(() => {
  const stats = engine.resources.getStats();
  if (stats.totalResources > 100) {
    console.warn(`High resource count: ${stats.totalResources}`);
  }
}, 10000);
```

### Best Practices

1. **Always Release**: Release resources when done to prevent leaks
2. **Preload**: Preload resources before they're needed
3. **Reuse**: Let the manager cache and reuse resources
4. **Monitor**: Check stats periodically for leaks
5. **Cleanup**: Clean up unused resources regularly
6. **Async**: Use async loading for large resources
7. **Scenes**: Track resources per scene for easy cleanup

## Integration with Other Plugins

### With Canvas2DRendererPlugin

```typescript
import { Canvas2DRendererPlugin, Sprite } from '@orion-ecs/canvas2d-renderer';

// Load texture for sprite
const texture = await engine.resources.get(TextureResource, 'player.png');

// Use in sprite (assuming Sprite can use TextureResource)
entity.addComponent(Sprite, texture.data);

// Release when entity is destroyed
engine.on('onEntityReleased', async (entity) => {
  const sprite = entity.getComponent(Sprite);
  if (sprite && sprite.texture) {
    await engine.resources.release(sprite.texture);
  }
});
```

## Troubleshooting

### Resources Not Unloading

1. Check reference count (use printStats())
2. Ensure all holders are releasing
3. Verify no memory leaks in release logic
4. Check for circular references

### Slow Loading

1. Use preload() for batching
2. Consider lazy loading for optional resources
3. Optimize resource file sizes
4. Use compression for assets

### Memory Leaks

1. Monitor with printStats()
2. Always release resources
3. Use cleanupUnused() periodically
4. Track resources per scene/level

### Type Errors

1. Ensure resource type is registered
2. Check resourceTypeName matches
3. Verify resource implements Resource interface
4. Use correct type in get() call

## Advanced Topics

### Hot Reloading

```typescript
async function hotReloadResource(type: any, key: string) {
  // Get current resource
  const current = engine.resources.getSync(type, key);
  if (!current) return;

  // Force unload
  await current.unload();

  // Reload
  await current.load();

  console.log(`✓ Hot reloaded: ${key}`);
}

// Trigger on file change
watcher.on('change', async (file) => {
  await hotReloadResource(TextureResource, file);
});
```

### Resource Variants

```typescript
class VariantResource implements Resource {
  static resourceTypeName = 'Variant';

  constructor(
    public readonly key: string,
    private variant: string = 'default'
  ) {}

  async load() {
    const path = `${this.key}-${this.variant}.png`;
    // Load variant...
  }

  async unload() {
    // Cleanup...
  }
}

// Load different variants
const normal = await engine.resources.get(VariantResource, 'icon', 'normal');
const hovered = await engine.resources.get(VariantResource, 'icon', 'hovered');
const pressed = await engine.resources.get(VariantResource, 'icon', 'pressed');
```

### Resource Compression

```typescript
class CompressedResource implements Resource {
  static resourceTypeName = 'Compressed';

  private data: any = null;

  constructor(public readonly key: string) {}

  async load() {
    // Load compressed data
    const compressed = await fetch(this.key);
    const buffer = await compressed.arrayBuffer();

    // Decompress
    this.data = await decompress(buffer);
  }

  async unload() {
    this.data = null;
  }
}
```
