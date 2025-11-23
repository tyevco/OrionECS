/**
 * Tutorial 1: Your First ECS Project
 * Component Definitions
 */

/**
 * Position component stores x and y coordinates
 */
export class Position {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

/**
 * Velocity component stores movement speed
 */
export class Velocity {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

/**
 * Renderable component marks entities that should be displayed
 */
export class Renderable {
  constructor(
    public symbol: string = '•',
    public color: string = 'white'
  ) {}
}
