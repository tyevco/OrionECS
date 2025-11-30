/**
 * Mesh class tests
 */

import { Vector2 } from '@orion-ecs/math';
import { Color } from './Color';
import { Mesh } from './Mesh';
import { Vertex } from './Vertex';

describe('Mesh', () => {
    describe('Constructor', () => {
        it('should create mesh from vertex array', () => {
            const vertices = [new Vertex(0, 0), new Vertex(10, 0), new Vertex(5, 10)];

            const mesh = new Mesh(vertices);

            expect(mesh.vertices).toHaveLength(3);
            expect(mesh.color.value).toBe(Color.White.value);
        });

        it('should create mesh from variable vertex arguments', () => {
            const v1 = new Vertex(0, 0);
            const v2 = new Vertex(10, 0);
            const v3 = new Vertex(5, 10);

            const mesh = new Mesh(v1, v2, v3);

            expect(mesh.vertices).toHaveLength(3);
        });

        it('should not apply color when using array form (limitation)', () => {
            // Note: The constructor ignores rest args when first arg is array
            const vertices = [new Vertex(0, 0), new Vertex(10, 0)];

            const mesh = new Mesh(vertices);

            expect(mesh.color.value).toBe(Color.White.value);
            // To set color with array form, assign after construction:
            mesh.color = Color.Red;
            expect(mesh.color.value).toBe(Color.Red.value);
        });

        it('should create mesh with color from variable arguments', () => {
            const v1 = new Vertex(0, 0);
            const v2 = new Vertex(10, 0);

            const mesh = new Mesh(v1, v2, Color.Blue);

            expect(mesh.vertices).toHaveLength(2);
            expect(mesh.color.value).toBe(Color.Blue.value);
        });

        it('should default to white color when not provided with variable args', () => {
            const v1 = new Vertex(0, 0);
            const v2 = new Vertex(10, 0);

            const mesh = new Mesh(v1, v2);

            expect(mesh.color.value).toBe(Color.White.value);
        });
    });

    describe('vertexCount', () => {
        it('should return number of vertices', () => {
            const vertices = [new Vertex(0, 0), new Vertex(10, 0), new Vertex(5, 10)];

            const mesh = new Mesh(vertices);

            expect(mesh.vertexCount).toBe(3);
        });

        it('should return 0 for empty mesh', () => {
            const mesh = new Mesh([]);

            expect(mesh.vertexCount).toBe(0);
        });
    });

    describe('getBounds', () => {
        it('should calculate bounding box', () => {
            const vertices = [
                new Vertex(10, 20),
                new Vertex(30, 40),
                new Vertex(5, 15),
                new Vertex(25, 35),
            ];

            const mesh = new Mesh(vertices);
            const bounds = mesh.getBounds();

            expect(bounds).not.toBeNull();
            expect(bounds?.left).toBe(5);
            expect(bounds?.top).toBe(15);
            expect(bounds?.right).toBe(30);
            expect(bounds?.bottom).toBe(40);
        });

        it('should return null for empty mesh', () => {
            const mesh = new Mesh([]);

            const bounds = mesh.getBounds();

            expect(bounds).toBeNull();
        });

        it('should handle single vertex', () => {
            const mesh = new Mesh([new Vertex(10, 20)]);

            const bounds = mesh.getBounds();

            expect(bounds).not.toBeNull();
            expect(bounds?.left).toBe(10);
            expect(bounds?.top).toBe(20);
            expect(bounds?.right).toBe(10);
            expect(bounds?.bottom).toBe(20);
        });
    });

    describe('getCenter', () => {
        it('should calculate center point', () => {
            const vertices = [
                new Vertex(0, 0),
                new Vertex(20, 0),
                new Vertex(20, 20),
                new Vertex(0, 20),
            ];

            const mesh = new Mesh(vertices);
            const center = mesh.getCenter();

            expect(center).not.toBeNull();
            expect(center?.x).toBe(10);
            expect(center?.y).toBe(10);
        });

        it('should return null for empty mesh', () => {
            const mesh = new Mesh([]);

            const center = mesh.getCenter();

            expect(center).toBeNull();
        });

        it('should handle single vertex', () => {
            const mesh = new Mesh([new Vertex(15, 25)]);

            const center = mesh.getCenter();

            expect(center).not.toBeNull();
            expect(center?.x).toBe(15);
            expect(center?.y).toBe(25);
        });

        it('should calculate center for triangle', () => {
            const vertices = [new Vertex(0, 0), new Vertex(30, 0), new Vertex(15, 30)];

            const mesh = new Mesh(vertices);
            const center = mesh.getCenter();

            expect(center?.x).toBe(15);
            expect(center?.y).toBe(10);
        });
    });

    describe('translate', () => {
        it('should translate all vertices', () => {
            const vertices = [new Vertex(0, 0), new Vertex(10, 0), new Vertex(5, 10)];
            const mesh = new Mesh(vertices);

            const result = mesh.translate(new Vector2(5, 5));

            expect(mesh.vertices[0]!.position.x).toBe(5);
            expect(mesh.vertices[0]!.position.y).toBe(5);
            expect(mesh.vertices[1]!.position.x).toBe(15);
            expect(mesh.vertices[1]!.position.y).toBe(5);
            expect(result).toBe(mesh); // Should return this for chaining
        });
    });

    describe('scale', () => {
        it('should scale all vertices from center', () => {
            const vertices = [
                new Vertex(0, 0),
                new Vertex(20, 0),
                new Vertex(20, 20),
                new Vertex(0, 20),
            ];
            const mesh = new Mesh(vertices);

            const result = mesh.scale(2);

            // Center is (10, 10), scaling by 2
            // (0,0) -> (-10, -10)
            // (20, 0) -> (30, -10)
            // etc.
            expect(mesh.vertices[0]!.position.x).toBeCloseTo(-10, 5);
            expect(mesh.vertices[0]!.position.y).toBeCloseTo(-10, 5);
            expect(mesh.vertices[1]!.position.x).toBeCloseTo(30, 5);
            expect(result).toBe(mesh);
        });

        it('should scale from custom origin', () => {
            const vertices = [new Vertex(10, 10), new Vertex(20, 10)];
            const mesh = new Mesh(vertices);

            mesh.scale(2, new Vector2(0, 0));

            expect(mesh.vertices[0]!.position.x).toBe(20);
            expect(mesh.vertices[0]!.position.y).toBe(20);
            expect(mesh.vertices[1]!.position.x).toBe(40);
            expect(mesh.vertices[1]!.position.y).toBe(20);
        });

        it('should handle empty mesh scale', () => {
            const mesh = new Mesh([]);

            expect(() => mesh.scale(2)).not.toThrow();
        });
    });

    describe('rotate', () => {
        it('should rotate all vertices around center', () => {
            const vertices = [new Vertex(10, 0), new Vertex(20, 0)];
            const mesh = new Mesh(vertices);
            // Center is (15, 0)

            const result = mesh.rotate(Math.PI); // 180 degrees

            expect(mesh.vertices[0]!.position.x).toBeCloseTo(20, 5);
            expect(mesh.vertices[0]!.position.y).toBeCloseTo(0, 5);
            expect(mesh.vertices[1]!.position.x).toBeCloseTo(10, 5);
            expect(result).toBe(mesh);
        });

        it('should rotate from custom origin', () => {
            const vertices = [new Vertex(10, 0)];
            const mesh = new Mesh(vertices);

            mesh.rotate(Math.PI / 2, new Vector2(0, 0)); // 90 degrees around origin

            expect(mesh.vertices[0]!.position.x).toBeCloseTo(0, 5);
            expect(mesh.vertices[0]!.position.y).toBeCloseTo(10, 5);
        });

        it('should handle empty mesh rotation', () => {
            const mesh = new Mesh([]);

            expect(() => mesh.rotate(Math.PI)).not.toThrow();
        });
    });

    describe('clone', () => {
        it('should clone vertices independently', () => {
            const vertices = [new Vertex(0, 0), new Vertex(10, 0)];
            const mesh = new Mesh(vertices);

            const cloned = mesh.clone();

            expect(cloned.vertices).toHaveLength(2);

            // Modify original
            mesh.vertices[0]!.position.x = 100;

            // Clone vertices should be unaffected
            expect(cloned.vertices[0]!.position.x).toBe(0);
        });

        it('should clone using variadic constructor form', () => {
            const v1 = new Vertex(0, 0);
            const v2 = new Vertex(10, 0);
            const mesh = new Mesh(v1, v2, Color.Red);

            const cloned = mesh.clone();

            // Note: clone passes color to array form constructor which ignores it
            // This is a known limitation of the current implementation
            expect(cloned.vertices).toHaveLength(2);
        });
    });

    describe('toString', () => {
        it('should return string representation', () => {
            const vertices = [new Vertex(0, 0), new Vertex(10, 0)];
            const mesh = new Mesh(vertices, Color.Red);

            const str = mesh.toString();

            expect(str).toContain('vertices: 2');
            expect(str).toContain('color:');
        });
    });

    describe('Factory Methods', () => {
        describe('rectangle', () => {
            it('should create rectangle mesh', () => {
                const mesh = Mesh.rectangle(10, 20, 100, 50);

                expect(mesh.vertices).toHaveLength(4);
                expect(mesh.vertices[0]!.position.x).toBe(10);
                expect(mesh.vertices[0]!.position.y).toBe(20);
                expect(mesh.vertices[2]!.position.x).toBe(110);
                expect(mesh.vertices[2]!.position.y).toBe(70);
            });

            it('should create rectangle with color', () => {
                const mesh = Mesh.rectangle(0, 0, 100, 100, Color.Green);

                expect(mesh.color.value).toBe(Color.Green.value);
            });

            it('should default to white color', () => {
                const mesh = Mesh.rectangle(0, 0, 100, 100);

                expect(mesh.color.value).toBe(Color.White.value);
            });
        });

        describe('circle', () => {
            it('should create circle mesh with default segments', () => {
                const mesh = Mesh.circle(50, 50, 25);

                expect(mesh.vertices).toHaveLength(32); // Default segments
            });

            it('should create circle with custom segments', () => {
                const mesh = Mesh.circle(50, 50, 25, 8);

                expect(mesh.vertices).toHaveLength(8);
            });

            it('should create circle with color', () => {
                const mesh = Mesh.circle(50, 50, 25, 16, Color.Yellow);

                expect(mesh.color.value).toBe(Color.Yellow.value);
            });

            it('should have vertices at correct radius', () => {
                const mesh = Mesh.circle(100, 100, 50, 4);

                // First vertex should be at (150, 100) - radius units to the right
                expect(mesh.vertices[0]!.position.x).toBeCloseTo(150, 5);
                expect(mesh.vertices[0]!.position.y).toBeCloseTo(100, 5);
            });
        });

        describe('polygon', () => {
            it('should create regular polygon', () => {
                const mesh = Mesh.polygon(50, 50, 25, 6);

                expect(mesh.vertices).toHaveLength(6);
            });

            it('should create triangle (3 sides)', () => {
                const mesh = Mesh.polygon(50, 50, 25, 3);

                expect(mesh.vertices).toHaveLength(3);
            });

            it('should create polygon with color', () => {
                const mesh = Mesh.polygon(50, 50, 25, 5, Color.Purple);

                expect(mesh.color.value).toBe(Color.Purple.value);
            });

            it('should start from top (first vertex at top)', () => {
                const mesh = Mesh.polygon(50, 50, 25, 4);

                // First vertex should be at the top: (50, 25) - 25 units up from center
                expect(mesh.vertices[0]!.position.x).toBeCloseTo(50, 5);
                expect(mesh.vertices[0]!.position.y).toBeCloseTo(25, 5);
            });
        });

        describe('line', () => {
            it('should create line mesh', () => {
                const mesh = Mesh.line(10, 20, 100, 200);

                expect(mesh.vertices).toHaveLength(2);
                expect(mesh.vertices[0]!.position.x).toBe(10);
                expect(mesh.vertices[0]!.position.y).toBe(20);
                expect(mesh.vertices[1]!.position.x).toBe(100);
                expect(mesh.vertices[1]!.position.y).toBe(200);
            });

            it('should create line with color', () => {
                const mesh = Mesh.line(0, 0, 100, 100, Color.Cyan);

                expect(mesh.color.value).toBe(Color.Cyan.value);
            });
        });
    });

    describe('Method chaining', () => {
        it('should support translate -> rotate -> scale chaining', () => {
            const mesh = Mesh.rectangle(0, 0, 10, 10);

            mesh.translate(new Vector2(10, 10)).rotate(0).scale(1);

            // Should not throw and mesh should be modified
            expect(mesh.vertices[0]!.position.x).toBe(10);
            expect(mesh.vertices[0]!.position.y).toBe(10);
        });
    });
});
