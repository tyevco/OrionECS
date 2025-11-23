import { Vector2 } from '@orion-ecs/math';

/**
 * Represents a vertex in 2D space with position and optional attributes.
 * Used for rendering meshes, polygons, and other geometric shapes.
 */
export class Vertex {
    /**
     * The position of the vertex.
     */
    public position: Vector2;

    /**
     * Optional texture coordinates (UV).
     */
    public uv?: Vector2;

    /**
     * Optional color tint for this vertex.
     */
    public color?: string;

    /**
     * Creates a new Vertex.
     * @param x X coordinate
     * @param y Y coordinate
     * @param u Optional U texture coordinate
     * @param v Optional V texture coordinate
     * @param color Optional color value
     */
    constructor(x: number, y: number, u?: number, v?: number, color?: string) {
        this.position = new Vector2(x, y);
        if (u !== undefined && v !== undefined) {
            this.uv = new Vector2(u, v);
        }
        this.color = color;
    }

    /**
     * Creates a Vertex from a Vector2 position.
     * @param position The position vector
     * @param u Optional U texture coordinate
     * @param v Optional V texture coordinate
     * @param color Optional color value
     * @returns A new Vertex
     */
    public static fromVector(position: Vector2, u?: number, v?: number, color?: string): Vertex {
        const vertex = new Vertex(position.x, position.y, u, v, color);
        return vertex;
    }

    /**
     * Creates a deep copy of this vertex.
     * @returns A new Vertex with the same values
     */
    public clone(): Vertex {
        return new Vertex(this.position.x, this.position.y, this.uv?.x, this.uv?.y, this.color);
    }

    /**
     * Transforms this vertex by an offset.
     * @param offset The offset to apply
     * @returns This vertex for chaining
     */
    public translate(offset: Vector2): this {
        this.position.add(offset);
        return this;
    }

    /**
     * Scales this vertex relative to an origin.
     * @param scale The scale factor
     * @param origin Optional origin point (defaults to 0,0)
     * @returns This vertex for chaining
     */
    public scale(scale: number, origin: Vector2 = Vector2.Zero): this {
        const dx = this.position.x - origin.x;
        const dy = this.position.y - origin.y;
        this.position.x = origin.x + dx * scale;
        this.position.y = origin.y + dy * scale;
        return this;
    }

    /**
     * Rotates this vertex around an origin.
     * @param angle The angle in radians
     * @param origin Optional origin point (defaults to 0,0)
     * @returns This vertex for chaining
     */
    public rotate(angle: number, origin: Vector2 = Vector2.Zero): this {
        const dx = this.position.x - origin.x;
        const dy = this.position.y - origin.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.position.x = origin.x + dx * cos - dy * sin;
        this.position.y = origin.y + dx * sin + dy * cos;
        return this;
    }

    /**
     * Converts this vertex to a string representation.
     * @returns String in format "Vertex(x, y)"
     */
    public toString(): string {
        return `Vertex(${this.position.x}, ${this.position.y})`;
    }
}
