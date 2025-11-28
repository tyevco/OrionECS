# Tutorial 1: Your First ECS Project

This is the runnable code example for Tutorial 1 of the OrionECS tutorial series.

## What This Example Demonstrates

- Creating an Engine with EngineBuilder
- Registering components
- Creating entities and adding components
- Creating systems with queries
- Running a basic update loop
- Console-based rendering

## Running the Example

```bash
# Install dependencies
npm install

# Run the tutorial
npm start

# Or run in watch mode (restarts on file changes)
npm run dev
```

## What You'll See

The example creates three entities (particles) that move across the screen:
- Particle1: Moves right (→)
- Particle2: Moves diagonally up-right (↗)
- Particle3: Moves up (↑)

The simulation runs for 50 frames, displaying the position of each entity in the console.

## Project Structure

```
01-first-ecs-project/
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── README.md            # This file
└── src/
    ├── components.ts    # Component definitions (Position, Velocity, Renderable)
    └── index.ts         # Main entry point with systems and update loop
```

## Next Steps

After running this example:

1. Try the challenges in the tutorial:
   - Add more entities with random positions/velocities
   - Add boundary wrapping
   - Create an acceleration component

2. Experiment with the code:
   - Change entity velocities
   - Add new components
   - Create new systems

3. Read the full tutorial: [docs/tutorials/01-first-ecs-project.md](../../docs/tutorials/01-first-ecs-project.md)

4. Continue to Tutorial 2: Understanding Entities, Components, and Systems

## Troubleshooting

**"Cannot find module '@orion-ecs/core'"**

Make sure you're in the repository root and have built the core package:
```bash
cd ../../
npm install
npm run build
cd tutorials/01-first-ecs-project
npm install
```

**TypeScript errors**

Make sure TypeScript is installed:
```bash
npm install
```

## Learn More

- [OrionECS Documentation](../../README.md)
- [Tutorial Series Index](../../docs/tutorials/README.md)
- [Examples](../../examples/)
