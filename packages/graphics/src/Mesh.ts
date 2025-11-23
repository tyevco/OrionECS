import { Bounds, Vector2 } from '@orion-ecs/math';
import { Color } from './Color';
import { Vertex } from './Vertex';

/**
 * Represents a 2D mesh composed of vertices with a color.
 * Used for rendering polygons, sprites, and other 2D shapes.
 */
export class Mesh {
    /**
     * The vertices that make up this mesh.
     */
    public vertices: Vertex[];

    /**
     * The color of this mesh.
     */
    public color: Color;

    /**
     * Creates a new Mesh.
     * @param vertices Array of vertices or variable arguments of vertices
     * @param color The mesh color (defaults to white)
     */
    constructor(vertices: Vertex[] | Vertex, ...rest: (Vertex | Color)[]) {
        if (Array.isArray(vertices)) {
            this.vertices = vertices;
            this.color = Color.White;
        } else {
            // Handle variable arguments: new Mesh(v1, v2, v3, color)
            const allArgs = [vertices, ...rest];
            const lastArg = allArgs[allArgs.length - 1];

            if (lastArg instanceof Color) {
                this.color = lastArg;
                this.vertices = allArgs.slice(0, -1) as Vertex[];
            } else {
                this.color = Color.White;
                this.vertices = allArgs as Vertex[];
            }
        }
    }

    /**
     * Gets the number of vertices in this mesh.
     */
    public get vertexCount(): number {
        return this.vertices.length;
    }

    /**
     * Calculates the bounding box of this mesh.
     * @returns A Bounds object, or null if mesh has no vertices
     */
    public getBounds(): Bounds | null {
        if (this.vertices.length === 0) {
            return null;
        }

        const points = this.vertices.map((v) => v.position);
        return Bounds.fromPoints(points);
    }

    /**
     * Calculates the center point of this mesh.
     * @returns The center as a Vector2, or null if mesh has no vertices
     */
    public getCenter(): Vector2 | null {
        if (this.vertices.length === 0) {
            return null;
        }

        let sumX = 0;
        let sumY = 0;
        for (const vertex of this.vertices) {
            sumX += vertex.position.x;
            sumY += vertex.position.y;
        }

        return new Vector2(sumX / this.vertices.length, sumY / this.vertices.length);
    }

    /**
     * Translates all vertices by an offset.
     * @param offset The offset to apply
     * @returns This mesh for chaining
     */
    public translate(offset: Vector2): this {
        for (const vertex of this.vertices) {
            vertex.translate(offset);
        }
        return this;
    }

    /**
     * Scales all vertices relative to an origin.
     * @param scale The scale factor
     * @param origin Optional origin point (defaults to mesh center)
     * @returns This mesh for chaining
     */
    public scale(scale: number, origin?: Vector2): this {
        const scaleOrigin = origin || this.getCenter() || Vector2.Zero;
        for (const vertex of this.vertices) {
            vertex.scale(scale, scaleOrigin);
        }
        return this;
    }

    /**
     * Rotates all vertices around an origin.
     * @param angle The angle in radians
     * @param origin Optional origin point (defaults to mesh center)
     * @returns This mesh for chaining
     */
    public rotate(angle: number, origin?: Vector2): this {
        const rotateOrigin = origin || this.getCenter() || Vector2.Zero;
        for (const vertex of this.vertices) {
            vertex.rotate(angle, rotateOrigin);
        }
        return this;
    }

    /**
     * Creates a deep copy of this mesh.
     * @returns A new Mesh with cloned vertices and color
     */
    public clone(): Mesh {
        const clonedVertices = this.vertices.map((v) => v.clone());
        return new Mesh(clonedVertices, this.color.clone());
    }

    /**
     * Converts this mesh to a string representation.
     * @returns String with vertex count and color
     */
    public toString(): string {
        return `Mesh(vertices: ${this.vertices.length}, color: ${this.color.value})`;
    }

    // --- Factory methods for common shapes ---

    /**
     * Creates a rectangular mesh.
     * @param x Top-left x coordinate
     * @param y Top-left y coordinate
     * @param width Rectangle width
     * @param height Rectangle height
     * @param color Optional color (defaults to white)
     * @returns A new Mesh
     */
    public static rectangle(
        x: number,
        y: number,
        width: number,
        height: number,
        color?: Color
    ): Mesh {
        const vertices = [
            new Vertex(x, y),
            new Vertex(x + width, y),
            new Vertex(x + width, y + height),
            new Vertex(x, y + height),
        ];
        const mesh = new Mesh(vertices);
        if (color) {
            mesh.color = color;
        }
        return mesh;
    }

    /**
     * Creates a circular mesh (approximated with segments).
     * @param centerX Center x coordinate
     * @param centerY Center y coordinate
     * @param radius Circle radius
     * @param segments Number of segments (more = smoother)
     * @param color Optional color (defaults to white)
     * @returns A new Mesh
     */
    public static circle(
        centerX: number,
        centerY: number,
        radius: number,
        segments: number = 32,
        color?: Color
    ): Mesh {
        const vertices: Vertex[] = [];
        const angleStep = (Math.PI * 2) / segments;

        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            vertices.push(new Vertex(x, y));
        }

        const mesh = new Mesh(vertices);
        if (color) {
            mesh.color = color;
        }
        return mesh;
    }

    /**
     * Creates a regular polygon mesh.
     * @param centerX Center x coordinate
     * @param centerY Center y coordinate
     * @param radius Distance from center to vertices
     * @param sides Number of sides
     * @param color Optional color (defaults to white)
     * @returns A new Mesh
     */
    public static polygon(
        centerX: number,
        centerY: number,
        radius: number,
        sides: number,
        color?: Color
    ): Mesh {
        const vertices: Vertex[] = [];
        const angleStep = (Math.PI * 2) / sides;

        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep - Math.PI / 2; // Start from top
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            vertices.push(new Vertex(x, y));
        }

        const mesh = new Mesh(vertices);
        if (color) {
            mesh.color = color;
        }
        return mesh;
    }

    /**
     * Creates a line mesh.
     * @param x1 Start x coordinate
     * @param y1 Start y coordinate
     * @param x2 End x coordinate
     * @param y2 End y coordinate
     * @param color Optional color (defaults to white)
     * @returns A new Mesh
     */
    public static line(x1: number, y1: number, x2: number, y2: number, color?: Color): Mesh {
        const vertices = [new Vertex(x1, y1), new Vertex(x2, y2)];
        const mesh = new Mesh(vertices);
        if (color) {
            mesh.color = color;
        }
        return mesh;
    }
}
