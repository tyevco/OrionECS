import { Bounds } from './Bounds';
import { Vector2 } from './Vector2';

describe('Bounds', () => {
  describe('Construction', () => {
    it('should create bounds with default values', () => {
      const bounds = new Bounds();
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should create bounds with specified values', () => {
      const bounds = new Bounds(10, 20, 100, 50);
      expect(bounds.left).toBe(10);
      expect(bounds.top).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(50);
    });
  });

  describe('Property Getters', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(10, 20, 100, 50);
    });

    it('should get right edge', () => {
      expect(bounds.right).toBe(110);
    });

    it('should get bottom edge', () => {
      expect(bounds.bottom).toBe(70);
    });

    it('should get center', () => {
      const center = bounds.center;
      expect(center.x).toBe(60);
      expect(center.y).toBe(45);
    });

    it('should get size', () => {
      const size = bounds.size;
      expect(size.x).toBe(100);
      expect(size.y).toBe(50);
    });

    it('should get min corner', () => {
      const min = bounds.min;
      expect(min.x).toBe(10);
      expect(min.y).toBe(20);
    });

    it('should get max corner', () => {
      const max = bounds.max;
      expect(max.x).toBe(110);
      expect(max.y).toBe(70);
    });

    it('should get topLeft corner', () => {
      const topLeft = bounds.topLeft;
      expect(topLeft.x).toBe(10);
      expect(topLeft.y).toBe(20);
    });

    it('should get topRight corner', () => {
      const topRight = bounds.topRight;
      expect(topRight.x).toBe(110);
      expect(topRight.y).toBe(20);
    });

    it('should get bottomLeft corner', () => {
      const bottomLeft = bounds.bottomLeft;
      expect(bottomLeft.x).toBe(10);
      expect(bottomLeft.y).toBe(70);
    });

    it('should get bottomRight corner', () => {
      const bottomRight = bounds.bottomRight;
      expect(bottomRight.x).toBe(110);
      expect(bottomRight.y).toBe(70);
    });
  });

  describe('Point Containment', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(0, 0, 100, 50);
    });

    it('should contain point inside bounds', () => {
      expect(bounds.contains(new Vector2(50, 25))).toBe(true);
    });

    it('should contain point on edge', () => {
      expect(bounds.contains(new Vector2(0, 0))).toBe(true);
      expect(bounds.contains(new Vector2(100, 50))).toBe(true);
    });

    it('should not contain point outside bounds', () => {
      expect(bounds.contains(new Vector2(-10, 25))).toBe(false);
      expect(bounds.contains(new Vector2(150, 25))).toBe(false);
      expect(bounds.contains(new Vector2(50, -10))).toBe(false);
      expect(bounds.contains(new Vector2(50, 100))).toBe(false);
    });
  });

  describe('Bounds Containment', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(0, 0, 100, 100);
    });

    it('should contain smaller bounds entirely inside', () => {
      const inner = new Bounds(25, 25, 50, 50);
      expect(bounds.containsBounds(inner)).toBe(true);
    });

    it('should not contain partially overlapping bounds', () => {
      const partial = new Bounds(50, 50, 100, 100);
      expect(bounds.containsBounds(partial)).toBe(false);
    });

    it('should not contain bounds outside', () => {
      const outside = new Bounds(200, 200, 50, 50);
      expect(bounds.containsBounds(outside)).toBe(false);
    });
  });

  describe('Intersection Detection', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(0, 0, 100, 100);
    });

    it('should detect overlapping bounds', () => {
      const other = new Bounds(50, 50, 100, 100);
      expect(bounds.intersects(other)).toBe(true);
    });

    it('should detect edge touching bounds', () => {
      const other = new Bounds(100, 0, 50, 50);
      expect(bounds.intersects(other)).toBe(true);
    });

    it('should not detect separated bounds', () => {
      const other = new Bounds(200, 200, 50, 50);
      expect(bounds.intersects(other)).toBe(false);
    });

    it('should calculate intersection area', () => {
      const other = new Bounds(50, 50, 100, 100);
      const intersection = bounds.intersection(other);
      expect(intersection).not.toBeNull();
      expect(intersection!.left).toBe(50);
      expect(intersection!.top).toBe(50);
      expect(intersection!.width).toBe(50);
      expect(intersection!.height).toBe(50);
    });

    it('should return null for no intersection', () => {
      const other = new Bounds(200, 200, 50, 50);
      expect(bounds.intersection(other)).toBeNull();
    });
  });

  describe('Circle Intersection', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(0, 0, 100, 100);
    });

    it('should detect circle entirely inside bounds', () => {
      const center = new Vector2(50, 50);
      const radius = 20;
      expect(bounds.intersectsCircle(center, radius)).toBe(true);
    });

    it('should detect circle overlapping bounds', () => {
      const center = new Vector2(110, 50);
      const radius = 20;
      expect(bounds.intersectsCircle(center, radius)).toBe(true);
    });

    it('should detect circle touching bounds edge', () => {
      const center = new Vector2(120, 50);
      const radius = 20;
      expect(bounds.intersectsCircle(center, radius)).toBe(true);
    });

    it('should not detect circle outside bounds', () => {
      const center = new Vector2(200, 200);
      const radius = 20;
      expect(bounds.intersectsCircle(center, radius)).toBe(false);
    });

    it('should detect circle at corner', () => {
      const center = new Vector2(110, 110);
      const radius = 15; // sqrt(10^2 + 10^2) ≈ 14.14
      expect(bounds.intersectsCircle(center, radius)).toBe(true);
    });

    it('should throw error for negative radius', () => {
      const center = new Vector2(50, 50);
      expect(() => bounds.intersectsCircle(center, -10)).toThrow('Circle radius must be non-negative');
    });

    it('should accept zero radius', () => {
      const center = new Vector2(50, 50);
      expect(bounds.intersectsCircle(center, 0)).toBe(true);
    });
  });

  describe('Spatial Queries', () => {
    let bounds: Bounds;

    beforeEach(() => {
      bounds = new Bounds(0, 0, 100, 100);
    });

    it('should find closest point inside bounds', () => {
      const point = new Vector2(50, 50);
      const closest = bounds.closestPoint(point);
      expect(closest.x).toBe(50);
      expect(closest.y).toBe(50);
    });

    it('should find closest point outside bounds (left)', () => {
      const point = new Vector2(-50, 50);
      const closest = bounds.closestPoint(point);
      expect(closest.x).toBe(0);
      expect(closest.y).toBe(50);
    });

    it('should find closest point outside bounds (corner)', () => {
      const point = new Vector2(150, 150);
      const closest = bounds.closestPoint(point);
      expect(closest.x).toBe(100);
      expect(closest.y).toBe(100);
    });

    it('should calculate distance to point inside bounds', () => {
      const point = new Vector2(50, 50);
      expect(bounds.distanceToPoint(point)).toBe(0);
    });

    it('should calculate distance to point outside bounds', () => {
      const point = new Vector2(-30, 0);
      expect(bounds.distanceToPoint(point)).toBe(30);
    });

    it('should calculate distance to point at corner', () => {
      const point = new Vector2(130, 140);
      const expected = Math.sqrt(30 * 30 + 40 * 40); // Pythagorean theorem
      expect(bounds.distanceToPoint(point)).toBeCloseTo(expected, 5);
    });
  });

  describe('Transformations', () => {
    describe('scale', () => {
      it('should scale from center by default', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.scale(2);
        expect(bounds.left).toBe(-50);
        expect(bounds.top).toBe(-50);
        expect(bounds.width).toBe(200);
        expect(bounds.height).toBe(200);
      });

      it('should scale with different x and y factors', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.scale(2, 3);
        expect(bounds.left).toBe(-50);
        expect(bounds.top).toBe(-100);
        expect(bounds.width).toBe(200);
        expect(bounds.height).toBe(300);
      });

      it('should scale from top-left corner', () => {
        const bounds = new Bounds(10, 20, 100, 100);
        bounds.scale(2, 2, false);
        expect(bounds.left).toBe(10);
        expect(bounds.top).toBe(20);
        expect(bounds.width).toBe(200);
        expect(bounds.height).toBe(200);
      });

      it('should handle negative scale factors (flip)', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        const centerBefore = bounds.center;
        bounds.scale(-1, -1);
        // Center should remain the same
        expect(bounds.center.x).toBeCloseTo(centerBefore.x, 5);
        expect(bounds.center.y).toBeCloseTo(centerBefore.y, 5);
        // Width and height become negative (flipped)
        expect(bounds.width).toBe(-100);
        expect(bounds.height).toBe(-100);
      });

      it('should flip horizontally with negative x scale', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.scale(-1, 1);
        expect(bounds.width).toBe(-100);
        expect(bounds.height).toBe(100);
      });
    });

    describe('translate', () => {
      it('should translate by x and y', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.translate(50, 25);
        expect(bounds.left).toBe(50);
        expect(bounds.top).toBe(25);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(100);
      });

      it('should translate by Vector2', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.translate(new Vector2(50, 25));
        expect(bounds.left).toBe(50);
        expect(bounds.top).toBe(25);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(100);
      });

      it('should default y to 0 if not provided', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.translate(50);
        expect(bounds.left).toBe(50);
        expect(bounds.top).toBe(0);
      });
    });

    describe('expand and shrink', () => {
      it('should expand in all directions', () => {
        const bounds = new Bounds(10, 20, 100, 50);
        bounds.expand(10);
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(10);
        expect(bounds.width).toBe(120);
        expect(bounds.height).toBe(70);
      });

      it('should shrink in all directions', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.shrink(10);
        expect(bounds.left).toBe(10);
        expect(bounds.top).toBe(10);
        expect(bounds.width).toBe(80);
        expect(bounds.height).toBe(80);
      });
    });
  });

  describe('Encapsulation', () => {
    describe('encapsulate point', () => {
      it('should not change bounds if point is inside', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.encapsulate(new Vector2(50, 50));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(100);
      });

      it('should expand to include point on the right', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.encapsulate(new Vector2(150, 50));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(150);
        expect(bounds.height).toBe(100);
      });

      it('should expand to include point on the left', () => {
        const bounds = new Bounds(10, 10, 90, 90);
        bounds.encapsulate(new Vector2(0, 50));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(10);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(90);
      });

      it('should expand to include point at corner', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.encapsulate(new Vector2(150, 150));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(150);
        expect(bounds.height).toBe(150);
      });
    });

    describe('encapsulate bounds', () => {
      it('should not change if other bounds is inside', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.encapsulateBounds(new Bounds(25, 25, 50, 50));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(100);
      });

      it('should expand to include other bounds', () => {
        const bounds = new Bounds(0, 0, 100, 100);
        bounds.encapsulateBounds(new Bounds(50, 50, 100, 100));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(150);
        expect(bounds.height).toBe(150);
      });

      it('should expand to include separate bounds', () => {
        const bounds = new Bounds(0, 0, 50, 50);
        bounds.encapsulateBounds(new Bounds(100, 100, 50, 50));
        expect(bounds.left).toBe(0);
        expect(bounds.top).toBe(0);
        expect(bounds.width).toBe(150);
        expect(bounds.height).toBe(150);
      });
    });
  });

  describe('Union', () => {
    it('should create union of two bounds', () => {
      const bounds1 = new Bounds(0, 0, 50, 50);
      const bounds2 = new Bounds(100, 100, 50, 50);
      const union = bounds1.union(bounds2);
      expect(union.left).toBe(0);
      expect(union.top).toBe(0);
      expect(union.width).toBe(150);
      expect(union.height).toBe(150);
    });

    it('should not modify original bounds', () => {
      const bounds1 = new Bounds(0, 0, 50, 50);
      const bounds2 = new Bounds(100, 100, 50, 50);
      bounds1.union(bounds2);
      expect(bounds1.left).toBe(0);
      expect(bounds1.width).toBe(50);
    });
  });

  describe('Area and Perimeter', () => {
    it('should calculate area', () => {
      const bounds = new Bounds(0, 0, 100, 50);
      expect(bounds.area()).toBe(5000);
    });

    it('should calculate perimeter', () => {
      const bounds = new Bounds(0, 0, 100, 50);
      expect(bounds.perimeter()).toBe(300);
    });

    it('should detect empty bounds', () => {
      expect(new Bounds(0, 0, 0, 100).isEmpty()).toBe(true);
      expect(new Bounds(0, 0, 100, 0).isEmpty()).toBe(true);
      expect(new Bounds(0, 0, -10, 100).isEmpty()).toBe(true);
      expect(new Bounds(0, 0, 100, 100).isEmpty()).toBe(false);
    });
  });

  describe('Cloning and Copying', () => {
    it('should clone bounds', () => {
      const bounds = new Bounds(10, 20, 100, 50);
      const clone = bounds.clone();
      expect(clone.left).toBe(10);
      expect(clone.top).toBe(20);
      expect(clone.width).toBe(100);
      expect(clone.height).toBe(50);
      expect(clone).not.toBe(bounds);
    });

    it('should copy from other bounds', () => {
      const bounds1 = new Bounds(0, 0, 50, 50);
      const bounds2 = new Bounds(10, 20, 100, 100);
      bounds1.copy(bounds2);
      expect(bounds1.left).toBe(10);
      expect(bounds1.top).toBe(20);
      expect(bounds1.width).toBe(100);
      expect(bounds1.height).toBe(100);
    });
  });

  describe('Equality', () => {
    it('should detect equal bounds', () => {
      const bounds1 = new Bounds(10, 20, 100, 50);
      const bounds2 = new Bounds(10, 20, 100, 50);
      expect(bounds1.equals(bounds2)).toBe(true);
    });

    it('should detect unequal bounds', () => {
      const bounds1 = new Bounds(10, 20, 100, 50);
      const bounds2 = new Bounds(10, 20, 100, 51);
      expect(bounds1.equals(bounds2)).toBe(false);
    });

    it('should use epsilon for floating point comparison', () => {
      const bounds1 = new Bounds(10, 20, 100.0001, 50);
      const bounds2 = new Bounds(10, 20, 100.0002, 50);
      expect(bounds1.equals(bounds2, 0.001)).toBe(true);
      expect(bounds1.equals(bounds2, 0)).toBe(false);
    });
  });

  describe('String Representation', () => {
    it('should convert to string', () => {
      const bounds = new Bounds(10, 20, 100, 50);
      expect(bounds.toString()).toBe('Bounds(10, 20, 100, 50)');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create from corners', () => {
      const bounds = Bounds.fromCorners(
        new Vector2(10, 20),
        new Vector2(110, 70)
      );
      expect(bounds.left).toBe(10);
      expect(bounds.top).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(50);
    });

    it('should create from corners in any order', () => {
      const bounds = Bounds.fromCorners(
        new Vector2(110, 70),
        new Vector2(10, 20)
      );
      expect(bounds.left).toBe(10);
      expect(bounds.top).toBe(20);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(50);
    });

    it('should create from center', () => {
      const bounds = Bounds.fromCenter(new Vector2(50, 50), 100, 100);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });

    it('should create from points', () => {
      const points = [
        new Vector2(10, 20),
        new Vector2(110, 30),
        new Vector2(60, 70),
        new Vector2(30, 25),
      ];
      const bounds = Bounds.fromPoints(points);
      expect(bounds).not.toBeNull();
      expect(bounds!.left).toBe(10);
      expect(bounds!.top).toBe(20);
      expect(bounds!.width).toBe(100);
      expect(bounds!.height).toBe(50);
    });

    it('should return null from empty points array', () => {
      expect(Bounds.fromPoints([])).toBeNull();
    });
  });

  describe('Clamp', () => {
    it('should clamp point to bounds', () => {
      const bounds = new Bounds(0, 0, 100, 100);
      const clamped = bounds.clamp(new Vector2(150, 150));
      expect(clamped.x).toBe(100);
      expect(clamped.y).toBe(100);
    });

    it('should not modify point already inside', () => {
      const bounds = new Bounds(0, 0, 100, 100);
      const clamped = bounds.clamp(new Vector2(50, 50));
      expect(clamped.x).toBe(50);
      expect(clamped.y).toBe(50);
    });
  });
});
