import { Vector2 } from './Vector2';

describe('Vector2', () => {
  // ============================================================
  // Constructor and Static Properties
  // ============================================================

  describe('Constructor', () => {
    test('creates vector with default values (0, 0)', () => {
      const v = new Vector2();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    test('creates vector with specified values', () => {
      const v = new Vector2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('Static Properties', () => {
    test('Zero returns (0, 0)', () => {
      const v = Vector2.Zero;
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    test('One returns (1, 1)', () => {
      const v = Vector2.One;
      expect(v.x).toBe(1);
      expect(v.y).toBe(1);
    });

    test('Up returns (0, -1)', () => {
      const v = Vector2.Up;
      expect(v.x).toBe(0);
      expect(v.y).toBe(-1);
    });

    test('Down returns (0, 1)', () => {
      const v = Vector2.Down;
      expect(v.x).toBe(0);
      expect(v.y).toBe(1);
    });

    test('Left returns (-1, 0)', () => {
      const v = Vector2.Left;
      expect(v.x).toBe(-1);
      expect(v.y).toBe(0);
    });

    test('Right returns (1, 0)', () => {
      const v = Vector2.Right;
      expect(v.x).toBe(1);
      expect(v.y).toBe(0);
    });
  });

  // ============================================================
  // Basic Operations
  // ============================================================

  describe('Getters and Setters', () => {
    test('x and y getters work', () => {
      const v = new Vector2(5, 7);
      expect(v.x).toBe(5);
      expect(v.y).toBe(7);
    });

    test('x and y setters work', () => {
      const v = new Vector2();
      v.x = 10;
      v.y = 20;
      expect(v.x).toBe(10);
      expect(v.y).toBe(20);
    });

    test('set() method works', () => {
      const v = new Vector2();
      const result = v.set(15, 25);
      expect(v.x).toBe(15);
      expect(v.y).toBe(25);
      expect(result).toBe(v); // Check chaining
    });
  });

  // ============================================================
  // Mutable Arithmetic Operations
  // ============================================================

  describe('Mutable Arithmetic', () => {
    test('add() modifies vector in place', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = v1.add(v2);
      expect(v1.x).toBe(4);
      expect(v1.y).toBe(6);
      expect(result).toBe(v1); // Check chaining
    });

    test('subtract() modifies vector in place', () => {
      const v1 = new Vector2(5, 7);
      const v2 = new Vector2(2, 3);
      const result = v1.subtract(v2);
      expect(v1.x).toBe(3);
      expect(v1.y).toBe(4);
      expect(result).toBe(v1);
    });

    test('multiply() modifies vector in place', () => {
      const v = new Vector2(3, 4);
      const result = v.multiply(2);
      expect(v.x).toBe(6);
      expect(v.y).toBe(8);
      expect(result).toBe(v);
    });

    test('divide() modifies vector in place', () => {
      const v = new Vector2(10, 20);
      const result = v.divide(2);
      expect(v.x).toBe(5);
      expect(v.y).toBe(10);
      expect(result).toBe(v);
    });

    test('divide() throws on division by zero', () => {
      const v = new Vector2(10, 20);
      expect(() => v.divide(0)).toThrow('Cannot divide vector by zero');
    });

    test('negate() modifies vector in place', () => {
      const v = new Vector2(3, -4);
      const result = v.negate();
      expect(v.x).toBe(-3);
      expect(v.y).toBe(4);
      expect(result).toBe(v);
    });
  });

  // ============================================================
  // Immutable Arithmetic Operations
  // ============================================================

  describe('Immutable Arithmetic', () => {
    test('plus() returns new vector', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = v1.plus(v2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
      expect(v1.x).toBe(1); // Original unchanged
      expect(v1.y).toBe(2);
      expect(result).not.toBe(v1);
    });

    test('minus() returns new vector', () => {
      const v1 = new Vector2(5, 7);
      const v2 = new Vector2(2, 3);
      const result = v1.minus(v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
      expect(v1.x).toBe(5); // Original unchanged
      expect(v1.y).toBe(7);
    });

    test('times() returns new vector', () => {
      const v = new Vector2(3, 4);
      const result = v.times(2);
      expect(result.x).toBe(6);
      expect(result.y).toBe(8);
      expect(v.x).toBe(3); // Original unchanged
      expect(v.y).toBe(4);
    });

    test('dividedBy() returns new vector', () => {
      const v = new Vector2(10, 20);
      const result = v.dividedBy(2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
      expect(v.x).toBe(10); // Original unchanged
      expect(v.y).toBe(20);
    });

    test('dividedBy() throws on division by zero', () => {
      const v = new Vector2(10, 20);
      expect(() => v.dividedBy(0)).toThrow('Cannot divide vector by zero');
    });

    test('negated() returns new vector', () => {
      const v = new Vector2(3, -4);
      const result = v.negated();
      expect(result.x).toBe(-3);
      expect(result.y).toBe(4);
      expect(v.x).toBe(3); // Original unchanged
      expect(v.y).toBe(-4);
    });
  });

  // ============================================================
  // Length and Distance
  // ============================================================

  describe('Length and Distance', () => {
    test('length() calculates magnitude', () => {
      const v = new Vector2(3, 4);
      expect(v.length()).toBe(5);
    });

    test('lengthSquared() calculates squared magnitude', () => {
      const v = new Vector2(3, 4);
      expect(v.lengthSquared()).toBe(25);
    });

    test('distanceTo() calculates distance to another vector', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(v1.distanceTo(v2)).toBe(5);
    });

    test('distanceToSquared() calculates squared distance', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(v1.distanceToSquared(v2)).toBe(25);
    });

    test('vectorTo() creates displacement vector', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(4, 6);
      const result = v1.vectorTo(v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });
  });

  // ============================================================
  // Normalization
  // ============================================================

  describe('Normalization', () => {
    test('normal() returns normalized copy', () => {
      const v = new Vector2(3, 4);
      const result = v.normal();
      expect(result.x).toBeCloseTo(0.6);
      expect(result.y).toBeCloseTo(0.8);
      expect(result.length()).toBeCloseTo(1);
      expect(v.x).toBe(3); // Original unchanged
    });

    test('normal() returns zero vector for zero-length vector', () => {
      const v = new Vector2(0, 0);
      const result = v.normal();
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    test('normalize() modifies vector in place', () => {
      const v = new Vector2(3, 4);
      const result = v.normalize();
      expect(v.x).toBeCloseTo(0.6);
      expect(v.y).toBeCloseTo(0.8);
      expect(v.length()).toBeCloseTo(1);
      expect(result).toBe(v);
    });

    test('normalize() handles zero-length vector', () => {
      const v = new Vector2(0, 0);
      v.normalize();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });
  });

  // ============================================================
  // Dot and Cross Product
  // ============================================================

  describe('Dot and Cross Product', () => {
    test('dot() calculates dot product', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(v1.dot(v2)).toBe(23); // 2*4 + 3*5
    });

    test('dot() of perpendicular vectors is zero', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      expect(v1.dot(v2)).toBe(0);
    });

    test('cross() calculates 2D cross product', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(v1.cross(v2)).toBe(-2); // 2*5 - 3*4
    });

    test('cross() of parallel vectors is zero', () => {
      const v1 = new Vector2(2, 4);
      const v2 = new Vector2(1, 2);
      expect(v1.cross(v2)).toBe(0);
    });
  });

  // ============================================================
  // Angular Operations
  // ============================================================

  describe('Angular Operations', () => {
    test('angle() returns angle from positive x-axis', () => {
      const v1 = new Vector2(1, 0);
      expect(v1.angle()).toBeCloseTo(0);

      const v2 = new Vector2(0, 1);
      expect(v2.angle()).toBeCloseTo(Math.PI / 2);

      const v3 = new Vector2(-1, 0);
      expect(v3.angle()).toBeCloseTo(Math.PI);

      const v4 = new Vector2(0, -1);
      expect(v4.angle()).toBeCloseTo(-Math.PI / 2);
    });

    test('angleTo() calculates angle between vectors', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      expect(v1.angleTo(v2)).toBeCloseTo(Math.PI / 2);
    });

    test('angleTo() returns 0 for zero-length vectors', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(1, 1);
      expect(v1.angleTo(v2)).toBe(0);
    });

    test('rotate() rotates vector in place', () => {
      const v = new Vector2(1, 0);
      v.rotate(Math.PI / 2);
      expect(v.x).toBeCloseTo(0);
      expect(v.y).toBeCloseTo(1);
    });

    test('rotated() returns new rotated vector', () => {
      const v = new Vector2(1, 0);
      const result = v.rotated(Math.PI / 2);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
      expect(v.x).toBe(1); // Original unchanged
      expect(v.y).toBe(0);
    });

    test('rotation by 360 degrees returns to original', () => {
      const v = new Vector2(3, 4);
      const result = v.rotated(2 * Math.PI);
      expect(result.x).toBeCloseTo(3);
      expect(result.y).toBeCloseTo(4);
    });
  });

  // ============================================================
  // Perpendicular Vectors
  // ============================================================

  describe('Perpendicular Vectors', () => {
    test('perpendicular() rotates 90° counter-clockwise', () => {
      const v = new Vector2(1, 0);
      const result = v.perpendicular();
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBe(1);
    });

    test('perpendicularLeft() rotates 90° counter-clockwise', () => {
      const v = new Vector2(1, 0);
      const result = v.perpendicularLeft();
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBe(1);
    });

    test('perpendicularRight() rotates 90° clockwise', () => {
      const v = new Vector2(1, 0);
      const result = v.perpendicularRight();
      expect(result.x).toBe(0);
      expect(result.y).toBe(-1);
    });

    test('perpendicular vectors are orthogonal', () => {
      const v = new Vector2(3, 4);
      const perp = v.perpendicular();
      expect(v.dot(perp)).toBe(0);
    });

    test('perpendicular maintains length', () => {
      const v = new Vector2(3, 4);
      const perp = v.perpendicular();
      expect(perp.length()).toBeCloseTo(v.length());
    });
  });

  // ============================================================
  // Reflection and Projection
  // ============================================================

  describe('Reflection and Projection', () => {
    test('reflect() reflects vector across normal', () => {
      const v = new Vector2(1, -1).normal();
      const normal = new Vector2(0, 1);
      const result = v.reflect(normal);
      expect(result.x).toBeCloseTo(v.x);
      expect(result.y).toBeCloseTo(-v.y);
    });

    test('reflection maintains magnitude', () => {
      const v = new Vector2(3, -4);
      const normal = new Vector2(0, 1);
      const result = v.reflect(normal);
      expect(result.length()).toBeCloseTo(v.length());
    });

    test('project() projects onto another vector', () => {
      const v = new Vector2(3, 4);
      const onto = new Vector2(1, 0);
      const result = v.project(onto);
      expect(result.x).toBeCloseTo(3);
      expect(result.y).toBeCloseTo(0);
    });

    test('project() handles zero-length vector', () => {
      const v = new Vector2(3, 4);
      const onto = new Vector2(0, 0);
      const result = v.project(onto);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    test('projection is parallel to target vector', () => {
      const v = new Vector2(3, 4);
      const onto = new Vector2(1, 1).normal();
      const result = v.project(onto);
      const angle = result.angleTo(onto);
      expect(Math.abs(angle)).toBeCloseTo(0);
    });
  });

  // ============================================================
  // Interpolation
  // ============================================================

  describe('Interpolation', () => {
    test('lerp() at t=0 returns start vector', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 10);
      const result = v1.lerp(v2, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    test('lerp() at t=1 returns end vector', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 10);
      const result = v1.lerp(v2, 1);
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });

    test('lerp() at t=0.5 returns midpoint', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 20);
      const result = v1.lerp(v2, 0.5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });

    test('slerp() maintains length for unit vectors', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      const result = v1.slerp(v2, 0.5);
      expect(result.length()).toBeCloseTo(1);
    });

    test('slerp() at t=0 returns start vector', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      const result = v1.slerp(v2, 0);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
    });

    test('slerp() at t=1 approximates end vector', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      const result = v1.slerp(v2, 1);
      expect(result.x).toBeCloseTo(0, 1);
      expect(result.y).toBeCloseTo(1, 1);
    });
  });

  // ============================================================
  // Clamping
  // ============================================================

  describe('Clamping', () => {
    test('clamp() clamps components in place', () => {
      const v = new Vector2(15, -5);
      const result = v.clamp(-10, 10);
      expect(v.x).toBe(10);
      expect(v.y).toBe(-5);
      expect(result).toBe(v);
    });

    test('clamped() returns new clamped vector', () => {
      const v = new Vector2(15, -5);
      const result = v.clamped(-10, 10);
      expect(result.x).toBe(10);
      expect(result.y).toBe(-5);
      expect(v.x).toBe(15); // Original unchanged
      expect(v.y).toBe(-5);
    });

    test('clampLength() clamps magnitude in place', () => {
      const v = new Vector2(3, 4); // Length = 5
      const result = v.clampLength(0, 3);
      expect(v.length()).toBeCloseTo(3);
      expect(result).toBe(v);
    });

    test('clampedLength() returns new clamped vector', () => {
      const v = new Vector2(3, 4); // Length = 5
      const result = v.clampedLength(0, 3);
      expect(result.length()).toBeCloseTo(3);
      expect(v.length()).toBeCloseTo(5); // Original unchanged
    });

    test('clampLength() handles zero-length vector', () => {
      const v = new Vector2(0, 0);
      v.clampLength(1, 10);
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    test('clampLength() maintains direction', () => {
      const v = new Vector2(3, 4);
      const original = v.clone();
      v.clampLength(0, 3);
      const angle = v.angleTo(original);
      expect(Math.abs(angle)).toBeCloseTo(0);
    });
  });

  // ============================================================
  // Utility Methods
  // ============================================================

  describe('Utility Methods', () => {
    test('clone() creates deep copy', () => {
      const v = new Vector2(5, 7);
      const copy = v.clone();
      expect(copy.x).toBe(5);
      expect(copy.y).toBe(7);
      expect(copy).not.toBe(v);
      copy.x = 10;
      expect(v.x).toBe(5); // Original unchanged
    });

    test('copy() copies values from another vector', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = v1.copy(v2);
      expect(v1.x).toBe(3);
      expect(v1.y).toBe(4);
      expect(result).toBe(v1);
    });

    test('equals() returns true for equal vectors', () => {
      const v1 = new Vector2(3, 4);
      const v2 = new Vector2(3, 4);
      expect(v1.equals(v2)).toBe(true);
    });

    test('equals() returns false for different vectors', () => {
      const v1 = new Vector2(3, 4);
      const v2 = new Vector2(3, 5);
      expect(v1.equals(v2)).toBe(false);
    });

    test('equals() with epsilon tolerance', () => {
      const v1 = new Vector2(3.0001, 4.0001);
      const v2 = new Vector2(3.0002, 4.0002);
      expect(v1.equals(v2, 0.001)).toBe(true);
      expect(v1.equals(v2, 0)).toBe(false);
    });

    test('isZero() detects zero vector', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(0.1, 0);
      expect(v1.isZero()).toBe(true);
      expect(v2.isZero()).toBe(false);
    });

    test('isZero() with epsilon tolerance', () => {
      const v = new Vector2(0.0001, 0.0001);
      expect(v.isZero(0.001)).toBe(true);
      expect(v.isZero(0)).toBe(false);
    });

    test('toString() returns formatted string', () => {
      const v = new Vector2(3, 4);
      expect(v.toString()).toBe('Vector2(3, 4)');
    });

    test('toArray() returns array representation', () => {
      const v = new Vector2(3, 4);
      const arr = v.toArray();
      expect(arr).toEqual([3, 4]);
    });
  });

  // ============================================================
  // Static Factory Methods
  // ============================================================

  describe('Static Factory Methods', () => {
    test('fromArray() creates vector from array', () => {
      const v = Vector2.fromArray([3, 4]);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });

    test('fromArray() handles short arrays', () => {
      const v = Vector2.fromArray([5]);
      expect(v.x).toBe(5);
      expect(v.y).toBe(0);
    });

    test('fromArray() handles empty arrays', () => {
      const v = Vector2.fromArray([]);
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    test('fromAngle() creates unit vector at angle', () => {
      const v = Vector2.fromAngle(0);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);

      const v2 = Vector2.fromAngle(Math.PI / 2);
      expect(v2.x).toBeCloseTo(0);
      expect(v2.y).toBeCloseTo(1);
    });

    test('fromAngle() with custom length', () => {
      const v = Vector2.fromAngle(0, 5);
      expect(v.x).toBeCloseTo(5);
      expect(v.y).toBeCloseTo(0);
      expect(v.length()).toBeCloseTo(5);
    });
  });

  // ============================================================
  // Static Helper Methods
  // ============================================================

  describe('Static Helper Methods', () => {
    test('distance() calculates distance between vectors', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(Vector2.distance(v1, v2)).toBe(5);
    });

    test('distanceSquared() calculates squared distance', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(Vector2.distanceSquared(v1, v2)).toBe(25);
    });

    test('dot() calculates dot product', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(Vector2.dot(v1, v2)).toBe(23);
    });

    test('cross() calculates cross product', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(Vector2.cross(v1, v2)).toBe(-2);
    });

    test('angleBetween() calculates angle between vectors', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      expect(Vector2.angleBetween(v1, v2)).toBeCloseTo(Math.PI / 2);
    });

    test('lerp() interpolates between vectors', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 20);
      const result = Vector2.lerp(v1, v2, 0.5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });

    test('slerp() spherically interpolates', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      const result = Vector2.slerp(v1, v2, 0.5);
      expect(result.length()).toBeCloseTo(1);
    });

    test('add() adds two vectors', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = Vector2.add(v1, v2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
      expect(v1.x).toBe(1); // Originals unchanged
    });

    test('subtract() subtracts two vectors', () => {
      const v1 = new Vector2(5, 7);
      const v2 = new Vector2(2, 3);
      const result = Vector2.subtract(v1, v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });

    test('multiply() multiplies vector by scalar', () => {
      const v = new Vector2(3, 4);
      const result = Vector2.multiply(v, 2);
      expect(result.x).toBe(6);
      expect(result.y).toBe(8);
      expect(v.x).toBe(3); // Original unchanged
    });

    test('divide() divides vector by scalar', () => {
      const v = new Vector2(10, 20);
      const result = Vector2.divide(v, 2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });

    test('min() returns component-wise minimum', () => {
      const v1 = new Vector2(3, 8);
      const v2 = new Vector2(5, 2);
      const result = Vector2.min(v1, v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(2);
    });

    test('max() returns component-wise maximum', () => {
      const v1 = new Vector2(3, 8);
      const v2 = new Vector2(5, 2);
      const result = Vector2.max(v1, v2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(8);
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe('Edge Cases', () => {
    test('handles very small numbers', () => {
      const v = new Vector2(0.0000001, 0.0000001);
      expect(v.x).toBe(0.0000001);
      expect(v.y).toBe(0.0000001);
    });

    test('handles very large numbers', () => {
      const v = new Vector2(1e10, 1e10);
      expect(v.x).toBe(1e10);
      expect(v.y).toBe(1e10);
    });

    test('handles negative zero', () => {
      const v = new Vector2(-0, -0);
      expect(v.x).toBeCloseTo(0);
      expect(v.y).toBeCloseTo(0);
    });

    test('perpendicular of zero vector', () => {
      const v = new Vector2(0, 0);
      const perp = v.perpendicular();
      expect(perp.x).toBeCloseTo(0);
      expect(perp.y).toBeCloseTo(0);
    });

    test('rotation of zero vector', () => {
      const v = new Vector2(0, 0);
      const result = v.rotated(Math.PI / 2);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });
});
