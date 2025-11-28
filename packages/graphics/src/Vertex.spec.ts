/**
 * Vertex class tests
 */

import { Vector2 } from '@orion-ecs/math';
import { Vertex } from './Vertex';

describe('Vertex', () => {
    describe('Constructor', () => {
        it('should create vertex with position', () => {
            const vertex = new Vertex(10, 20);

            expect(vertex.position.x).toBe(10);
            expect(vertex.position.y).toBe(20);
        });

        it('should create vertex with UV coordinates', () => {
            const vertex = new Vertex(10, 20, 0.5, 0.75);

            expect(vertex.uv).toBeDefined();
            expect(vertex.uv?.x).toBe(0.5);
            expect(vertex.uv?.y).toBe(0.75);
        });

        it('should create vertex with color', () => {
            const vertex = new Vertex(10, 20, 0, 0, '#FF0000');

            expect(vertex.color).toBe('#FF0000');
        });

        it('should not create UV when only u is provided', () => {
            const vertex = new Vertex(10, 20, 0.5);

            expect(vertex.uv).toBeUndefined();
        });

        it('should create vertex without UV when not provided', () => {
            const vertex = new Vertex(10, 20);

            expect(vertex.uv).toBeUndefined();
        });

        it('should create vertex without color when not provided', () => {
            const vertex = new Vertex(10, 20);

            expect(vertex.color).toBeUndefined();
        });
    });

    describe('fromVector', () => {
        it('should create vertex from Vector2', () => {
            const position = new Vector2(30, 40);

            const vertex = Vertex.fromVector(position);

            expect(vertex.position.x).toBe(30);
            expect(vertex.position.y).toBe(40);
        });

        it('should create vertex from Vector2 with UV', () => {
            const position = new Vector2(30, 40);

            const vertex = Vertex.fromVector(position, 0.25, 0.5);

            expect(vertex.uv?.x).toBe(0.25);
            expect(vertex.uv?.y).toBe(0.5);
        });

        it('should create vertex from Vector2 with color', () => {
            const position = new Vector2(30, 40);

            const vertex = Vertex.fromVector(position, 0, 0, 'blue');

            expect(vertex.color).toBe('blue');
        });
    });

    describe('clone', () => {
        it('should create independent copy', () => {
            const original = new Vertex(10, 20, 0.5, 0.5, 'red');

            const cloned = original.clone();

            expect(cloned.position.x).toBe(10);
            expect(cloned.position.y).toBe(20);
            expect(cloned.uv?.x).toBe(0.5);
            expect(cloned.uv?.y).toBe(0.5);
            expect(cloned.color).toBe('red');

            // Modify original
            original.position.x = 100;
            expect(cloned.position.x).toBe(10);
        });

        it('should clone vertex without UV', () => {
            const original = new Vertex(10, 20);

            const cloned = original.clone();

            expect(cloned.uv).toBeUndefined();
        });
    });

    describe('translate', () => {
        it('should translate vertex position', () => {
            const vertex = new Vertex(10, 20);
            const offset = new Vector2(5, 15);

            const result = vertex.translate(offset);

            expect(vertex.position.x).toBe(15);
            expect(vertex.position.y).toBe(35);
            expect(result).toBe(vertex); // Should return this for chaining
        });

        it('should support negative translation', () => {
            const vertex = new Vertex(10, 20);
            const offset = new Vector2(-5, -10);

            vertex.translate(offset);

            expect(vertex.position.x).toBe(5);
            expect(vertex.position.y).toBe(10);
        });
    });

    describe('scale', () => {
        it('should scale vertex from origin', () => {
            const vertex = new Vertex(10, 20);

            const result = vertex.scale(2);

            expect(vertex.position.x).toBe(20);
            expect(vertex.position.y).toBe(40);
            expect(result).toBe(vertex); // Should return this for chaining
        });

        it('should scale vertex from custom origin', () => {
            const vertex = new Vertex(10, 20);
            const origin = new Vector2(10, 10);

            vertex.scale(2, origin);

            // Distance from origin: (0, 10)
            // Scaled: (0, 20)
            // New position: (10, 30)
            expect(vertex.position.x).toBe(10);
            expect(vertex.position.y).toBe(30);
        });

        it('should handle scale factor less than 1', () => {
            const vertex = new Vertex(20, 40);

            vertex.scale(0.5);

            expect(vertex.position.x).toBe(10);
            expect(vertex.position.y).toBe(20);
        });

        it('should handle zero scale factor', () => {
            const vertex = new Vertex(10, 20);

            vertex.scale(0);

            expect(vertex.position.x).toBe(0);
            expect(vertex.position.y).toBe(0);
        });
    });

    describe('rotate', () => {
        it('should rotate vertex around origin', () => {
            const vertex = new Vertex(10, 0);

            vertex.rotate(Math.PI / 2); // 90 degrees

            expect(vertex.position.x).toBeCloseTo(0, 5);
            expect(vertex.position.y).toBeCloseTo(10, 5);
        });

        it('should rotate vertex around custom origin', () => {
            const vertex = new Vertex(20, 10);
            const origin = new Vector2(10, 10);

            const result = vertex.rotate(Math.PI / 2, origin); // 90 degrees around (10,10)

            // Distance from origin: (10, 0)
            // After 90 degree rotation: (0, 10)
            // New position: (10, 20)
            expect(vertex.position.x).toBeCloseTo(10, 5);
            expect(vertex.position.y).toBeCloseTo(20, 5);
            expect(result).toBe(vertex); // Should return this for chaining
        });

        it('should rotate 180 degrees', () => {
            const vertex = new Vertex(10, 0);

            vertex.rotate(Math.PI); // 180 degrees

            expect(vertex.position.x).toBeCloseTo(-10, 5);
            expect(vertex.position.y).toBeCloseTo(0, 5);
        });

        it('should rotate 360 degrees back to original', () => {
            const vertex = new Vertex(10, 5);

            vertex.rotate(Math.PI * 2); // 360 degrees

            expect(vertex.position.x).toBeCloseTo(10, 5);
            expect(vertex.position.y).toBeCloseTo(5, 5);
        });

        it('should handle negative rotation', () => {
            const vertex = new Vertex(10, 0);

            vertex.rotate(-Math.PI / 2); // -90 degrees

            expect(vertex.position.x).toBeCloseTo(0, 5);
            expect(vertex.position.y).toBeCloseTo(-10, 5);
        });
    });

    describe('toString', () => {
        it('should return string representation', () => {
            const vertex = new Vertex(15, 25);

            const str = vertex.toString();

            expect(str).toBe('Vertex(15, 25)');
        });

        it('should handle decimal values', () => {
            const vertex = new Vertex(15.5, 25.75);

            const str = vertex.toString();

            expect(str).toBe('Vertex(15.5, 25.75)');
        });
    });

    describe('Method chaining', () => {
        it('should support translate -> scale -> rotate chaining', () => {
            const vertex = new Vertex(10, 0);

            vertex
                .translate(new Vector2(10, 0)) // Now at (20, 0)
                .scale(0.5) // Now at (10, 0)
                .rotate(Math.PI / 2); // Now at (0, 10)

            expect(vertex.position.x).toBeCloseTo(0, 5);
            expect(vertex.position.y).toBeCloseTo(10, 5);
        });
    });
});
