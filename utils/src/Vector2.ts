/**
 * Represents a 2D vector with common mathematical operations.
 * Useful for positions, velocities, directions, and other 2D spatial calculations.
 */
export class Vector2 {
  /**
   * Creates a new Vector2 at the origin (0, 0).
   */
  public static get Zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /**
   * Creates a new Vector2 pointing up (0, -1).
   */
  public static get Up(): Vector2 {
    return new Vector2(0, -1);
  }

  /**
   * Creates a new Vector2 pointing down (0, 1).
   */
  public static get Down(): Vector2 {
    return new Vector2(0, 1);
  }

  /**
   * Creates a new Vector2 pointing left (-1, 0).
   */
  public static get Left(): Vector2 {
    return new Vector2(-1, 0);
  }

  /**
   * Creates a new Vector2 pointing right (1, 0).
   */
  public static get Right(): Vector2 {
    return new Vector2(1, 0);
  }

  /**
   * Creates a new Vector2 with both components set to 1.
   */
  public static get One(): Vector2 {
    return new Vector2(1, 1);
  }

  private _x: number;
  private _y: number;

  /**
   * Creates a new Vector2 with the specified coordinates.
   * @param x The x coordinate (default: 0)
   * @param y The y coordinate (default: 0)
   */
  constructor(x: number = 0, y: number = 0) {
    this._x = x;
    this._y = y;
  }

  /**
   * Gets the x coordinate.
   */
  public get x(): number {
    return this._x;
  }

  /**
   * Sets the x coordinate.
   */
  public set x(value: number) {
    this._x = value;
  }

  /**
   * Gets the y coordinate.
   */
  public get y(): number {
    return this._y;
  }

  /**
   * Sets the y coordinate.
   */
  public set y(value: number) {
    this._y = value;
  }

  /**
   * Sets both x and y coordinates.
   * @param x The new x coordinate
   * @param y The new y coordinate
   */
  public set(x: number, y: number): this {
    this._x = x;
    this._y = y;
    return this;
  }

  /**
   * Calculates the vector from this point to another point.
   * @param other The target point
   * @returns A new Vector2 representing the displacement
   */
  public vectorTo(other: Vector2): Vector2 {
    return new Vector2(other.x - this.x, other.y - this.y);
  }

  /**
   * Calculates the Euclidean distance to another point.
   * @param other The target point
   * @returns The distance between the two points
   */
  public distanceTo(other: Vector2): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates the squared distance to another point (faster than distanceTo).
   * Useful for distance comparisons where the actual distance value isn't needed.
   * @param other The target point
   * @returns The squared distance between the two points
   */
  public distanceToSquared(other: Vector2): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return dx * dx + dy * dy;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The length of the vector
   */
  public length(): number {
    return Math.sqrt(this._x * this._x + this._y * this._y);
  }

  /**
   * Calculates the squared length of this vector (faster than length).
   * @returns The squared length of the vector
   */
  public lengthSquared(): number {
    return this._x * this._x + this._y * this._y;
  }

  /**
   * Returns a normalized copy of this vector (unit vector with same direction).
   * If the vector has zero length, returns a zero vector.
   * @returns A new normalized Vector2
   */
  public normal(): Vector2 {
    const len = this.length();
    if (len === 0) {
      return Vector2.Zero;
    }
    return new Vector2(this._x / len, this._y / len);
  }

  /**
   * Normalizes this vector in place (converts to unit vector).
   * If the vector has zero length, it remains unchanged.
   * @returns This vector for chaining
   */
  public normalize(): this {
    const len = this.length();
    if (len !== 0) {
      this._x /= len;
      this._y /= len;
    }
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param other The vector to add
   * @returns This vector for chaining
   */
  public add(other: Vector2): this {
    this._x += other.x;
    this._y += other.y;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param other The vector to subtract
   * @returns This vector for chaining
   */
  public subtract(other: Vector2): this {
    this._x -= other.x;
    this._y -= other.y;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar The scalar value
   * @returns This vector for chaining
   */
  public multiply(scalar: number): this {
    this._x *= scalar;
    this._y *= scalar;
    return this;
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar The scalar value (must not be zero)
   * @returns This vector for chaining
   */
  public divide(scalar: number): this {
    if (scalar === 0) {
      throw new Error('Cannot divide vector by zero');
    }
    this._x /= scalar;
    this._y /= scalar;
    return this;
  }

  /**
   * Calculates the dot product with another vector.
   * @param other The other vector
   * @returns The dot product
   */
  public dot(other: Vector2): number {
    return this._x * other.x + this._y * other.y;
  }

  /**
   * Calculates the 2D cross product (scalar value) with another vector.
   * @param other The other vector
   * @returns The cross product magnitude
   */
  public cross(other: Vector2): number {
    return this._x * other.y - this._y * other.x;
  }

  /**
   * Calculates the angle between this vector and another vector in radians.
   * @param other The other vector
   * @returns The angle in radians
   */
  public angleTo(other: Vector2): number {
    const dot = this.dot(other);
    const lengths = this.length() * other.length();
    if (lengths === 0) {
      return 0;
    }
    return Math.acos(Math.max(-1, Math.min(1, dot / lengths)));
  }

  /**
   * Linearly interpolates between this vector and another vector.
   * @param other The target vector
   * @param t The interpolation factor (0-1)
   * @returns A new interpolated Vector2
   */
  public lerp(other: Vector2, t: number): Vector2 {
    return new Vector2(
      this._x + (other.x - this._x) * t,
      this._y + (other.y - this._y) * t
    );
  }

  /**
   * Creates a deep copy of this vector.
   * @returns A new Vector2 with the same values
   */
  public clone(): Vector2 {
    return new Vector2(this._x, this._y);
  }

  /**
   * Copies values from another vector.
   * @param other The vector to copy from
   * @returns This vector for chaining
   */
  public copy(other: Vector2): this {
    this._x = other.x;
    this._y = other.y;
    return this;
  }

  /**
   * Checks if this vector equals another vector.
   * @param other The vector to compare with
   * @param epsilon Optional tolerance for floating point comparison
   * @returns True if vectors are equal
   */
  public equals(other: Vector2, epsilon: number = 0): boolean {
    if (epsilon === 0) {
      return this._x === other.x && this._y === other.y;
    }
    return (
      Math.abs(this._x - other.x) <= epsilon &&
      Math.abs(this._y - other.y) <= epsilon
    );
  }

  /**
   * Converts this vector to a string representation.
   * @returns String in format "Vector2(x, y)"
   */
  public toString(): string {
    return `Vector2(${this._x}, ${this._y})`;
  }

  /**
   * Converts this vector to an array [x, y].
   * @returns Array containing x and y values
   */
  public toArray(): [number, number] {
    return [this._x, this._y];
  }

  /**
   * Creates a Vector2 from an array.
   * @param array Array containing at least 2 numbers
   * @returns A new Vector2
   */
  public static fromArray(array: number[]): Vector2 {
    return new Vector2(array[0] || 0, array[1] || 0);
  }

  /**
   * Creates a Vector2 from an angle in radians.
   * @param angle The angle in radians
   * @param length The length of the vector (default: 1)
   * @returns A new Vector2
   */
  public static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  // ============================================================
  // Immutable Arithmetic Operations (return new instances)
  // ============================================================

  /**
   * Returns a new vector that is the sum of this vector and another.
   * This is the immutable version of add().
   * @param other The vector to add
   * @returns A new Vector2
   */
  public plus(other: Vector2): Vector2 {
    return new Vector2(this._x + other.x, this._y + other.y);
  }

  /**
   * Returns a new vector that is the difference of this vector and another.
   * This is the immutable version of subtract().
   * @param other The vector to subtract
   * @returns A new Vector2
   */
  public minus(other: Vector2): Vector2 {
    return new Vector2(this._x - other.x, this._y - other.y);
  }

  /**
   * Returns a new vector that is this vector multiplied by a scalar.
   * This is the immutable version of multiply().
   * @param scalar The scalar value
   * @returns A new Vector2
   */
  public times(scalar: number): Vector2 {
    return new Vector2(this._x * scalar, this._y * scalar);
  }

  /**
   * Returns a new vector that is this vector divided by a scalar.
   * This is the immutable version of divide().
   * @param scalar The scalar value (must not be zero)
   * @returns A new Vector2
   */
  public dividedBy(scalar: number): Vector2 {
    if (scalar === 0) {
      throw new Error('Cannot divide vector by zero');
    }
    return new Vector2(this._x / scalar, this._y / scalar);
  }

  /**
   * Returns a new vector with negated components.
   * @returns A new Vector2 pointing in the opposite direction
   */
  public negated(): Vector2 {
    return new Vector2(-this._x, -this._y);
  }

  /**
   * Negates this vector in place (flips direction).
   * @returns This vector for chaining
   */
  public negate(): this {
    this._x = -this._x;
    this._y = -this._y;
    return this;
  }

  // ============================================================
  // Angular Operations
  // ============================================================

  /**
   * Calculates the angle of this vector from the positive x-axis in radians.
   * Returns a value in the range [-PI, PI].
   * @returns The angle in radians
   */
  public angle(): number {
    return Math.atan2(this._y, this._x);
  }

  /**
   * Rotates this vector by the specified angle in radians.
   * @param radians The angle to rotate by
   * @returns This vector for chaining
   */
  public rotate(radians: number): this {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const newX = this._x * cos - this._y * sin;
    const newY = this._x * sin + this._y * cos;
    this._x = newX;
    this._y = newY;
    return this;
  }

  /**
   * Returns a new vector rotated by the specified angle in radians.
   * @param radians The angle to rotate by
   * @returns A new rotated Vector2
   */
  public rotated(radians: number): Vector2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2(
      this._x * cos - this._y * sin,
      this._x * sin + this._y * cos
    );
  }

  // ============================================================
  // Perpendicular Vectors
  // ============================================================

  /**
   * Returns a vector perpendicular to this one (rotated 90° counter-clockwise).
   * Same as perpendicularLeft().
   * @returns A new perpendicular Vector2
   */
  public perpendicular(): Vector2 {
    return new Vector2(-this._y, this._x);
  }

  /**
   * Returns a vector perpendicular to this one (rotated 90° counter-clockwise).
   * @returns A new perpendicular Vector2
   */
  public perpendicularLeft(): Vector2 {
    return new Vector2(-this._y, this._x);
  }

  /**
   * Returns a vector perpendicular to this one (rotated 90° clockwise).
   * @returns A new perpendicular Vector2
   */
  public perpendicularRight(): Vector2 {
    return new Vector2(this._y, -this._x);
  }

  // ============================================================
  // Reflection and Projection
  // ============================================================

  /**
   * Reflects this vector across a normal vector.
   * @param normal The normal vector to reflect across (should be normalized)
   * @returns A new reflected Vector2
   */
  public reflect(normal: Vector2): Vector2 {
    const dotProduct = this.dot(normal);
    return new Vector2(
      this._x - 2 * dotProduct * normal.x,
      this._y - 2 * dotProduct * normal.y
    );
  }

  /**
   * Projects this vector onto another vector.
   * @param other The vector to project onto
   * @returns A new projected Vector2
   */
  public project(other: Vector2): Vector2 {
    const otherLengthSq = other.lengthSquared();
    if (otherLengthSq === 0) {
      return Vector2.Zero;
    }
    const dotProduct = this.dot(other);
    const scale = dotProduct / otherLengthSq;
    return new Vector2(other.x * scale, other.y * scale);
  }

  // ============================================================
  // Interpolation
  // ============================================================

  /**
   * Spherical linear interpolation between this vector and another.
   * Maintains constant speed and length during interpolation.
   * Better than lerp for rotation-like interpolation.
   * @param other The target vector
   * @param t The interpolation factor (0-1)
   * @returns A new interpolated Vector2
   */
  public slerp(other: Vector2, t: number): Vector2 {
    const dot = this.dot(other) / (this.length() * other.length());
    const theta = Math.acos(Math.max(-1, Math.min(1, dot))) * t;

    if (Math.abs(theta) < 0.0001) {
      // Vectors are nearly parallel, use lerp
      return this.lerp(other, t);
    }

    const relative = other.minus(this.times(dot)).normal();
    return this.times(Math.cos(theta)).plus(relative.times(Math.sin(theta)));
  }

  // ============================================================
  // Clamping
  // ============================================================

  /**
   * Clamps the vector components to the specified min and max values.
   * @param min The minimum value for each component
   * @param max The maximum value for each component
   * @returns This vector for chaining
   */
  public clamp(min: number, max: number): this {
    this._x = Math.max(min, Math.min(max, this._x));
    this._y = Math.max(min, Math.min(max, this._y));
    return this;
  }

  /**
   * Returns a new vector with clamped components.
   * @param min The minimum value for each component
   * @param max The maximum value for each component
   * @returns A new clamped Vector2
   */
  public clamped(min: number, max: number): Vector2 {
    return new Vector2(
      Math.max(min, Math.min(max, this._x)),
      Math.max(min, Math.min(max, this._y))
    );
  }

  /**
   * Clamps the length (magnitude) of this vector to the specified range.
   * @param minLength The minimum length
   * @param maxLength The maximum length
   * @returns This vector for chaining
   */
  public clampLength(minLength: number, maxLength: number): this {
    const len = this.length();
    if (len === 0) {
      return this;
    }
    const clampedLen = Math.max(minLength, Math.min(maxLength, len));
    if (len !== clampedLen) {
      this.multiply(clampedLen / len);
    }
    return this;
  }

  /**
   * Returns a new vector with clamped length.
   * @param minLength The minimum length
   * @param maxLength The maximum length
   * @returns A new Vector2 with clamped length
   */
  public clampedLength(minLength: number, maxLength: number): Vector2 {
    const len = this.length();
    if (len === 0) {
      return this.clone();
    }
    const clampedLen = Math.max(minLength, Math.min(maxLength, len));
    if (len === clampedLen) {
      return this.clone();
    }
    return this.times(clampedLen / len);
  }

  // ============================================================
  // Utility Checks
  // ============================================================

  /**
   * Checks if this is a zero vector (both components are zero).
   * @param epsilon Optional tolerance for floating point comparison
   * @returns True if this is a zero vector
   */
  public isZero(epsilon: number = 0): boolean {
    if (epsilon === 0) {
      return this._x === 0 && this._y === 0;
    }
    return Math.abs(this._x) <= epsilon && Math.abs(this._y) <= epsilon;
  }

  // ============================================================
  // Static Helper Methods
  // ============================================================

  /**
   * Calculates the distance between two vectors.
   * @param a First vector
   * @param b Second vector
   * @returns The distance between the vectors
   */
  public static distance(a: Vector2, b: Vector2): number {
    return a.distanceTo(b);
  }

  /**
   * Calculates the squared distance between two vectors.
   * @param a First vector
   * @param b Second vector
   * @returns The squared distance between the vectors
   */
  public static distanceSquared(a: Vector2, b: Vector2): number {
    return a.distanceToSquared(b);
  }

  /**
   * Calculates the dot product of two vectors.
   * @param a First vector
   * @param b Second vector
   * @returns The dot product
   */
  public static dot(a: Vector2, b: Vector2): number {
    return a.dot(b);
  }

  /**
   * Calculates the 2D cross product of two vectors.
   * @param a First vector
   * @param b Second vector
   * @returns The cross product magnitude
   */
  public static cross(a: Vector2, b: Vector2): number {
    return a.cross(b);
  }

  /**
   * Calculates the angle between two vectors in radians.
   * @param a First vector
   * @param b Second vector
   * @returns The angle in radians
   */
  public static angleBetween(a: Vector2, b: Vector2): number {
    return a.angleTo(b);
  }

  /**
   * Linearly interpolates between two vectors.
   * @param a Start vector
   * @param b End vector
   * @param t Interpolation factor (0-1)
   * @returns A new interpolated Vector2
   */
  public static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return a.lerp(b, t);
  }

  /**
   * Spherically interpolates between two vectors.
   * @param a Start vector
   * @param b End vector
   * @param t Interpolation factor (0-1)
   * @returns A new interpolated Vector2
   */
  public static slerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return a.slerp(b, t);
  }

  /**
   * Adds two vectors and returns the result.
   * @param a First vector
   * @param b Second vector
   * @returns A new Vector2
   */
  public static add(a: Vector2, b: Vector2): Vector2 {
    return a.plus(b);
  }

  /**
   * Subtracts two vectors and returns the result.
   * @param a First vector
   * @param b Second vector
   * @returns A new Vector2
   */
  public static subtract(a: Vector2, b: Vector2): Vector2 {
    return a.minus(b);
  }

  /**
   * Multiplies a vector by a scalar and returns the result.
   * @param vector The vector
   * @param scalar The scalar value
   * @returns A new Vector2
   */
  public static multiply(vector: Vector2, scalar: number): Vector2 {
    return vector.times(scalar);
  }

  /**
   * Divides a vector by a scalar and returns the result.
   * @param vector The vector
   * @param scalar The scalar value
   * @returns A new Vector2
   */
  public static divide(vector: Vector2, scalar: number): Vector2 {
    return vector.dividedBy(scalar);
  }

  /**
   * Returns the minimum of two vectors (component-wise).
   * @param a First vector
   * @param b Second vector
   * @returns A new Vector2 with minimum components
   */
  public static min(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y));
  }

  /**
   * Returns the maximum of two vectors (component-wise).
   * @param a First vector
   * @param b Second vector
   * @returns A new Vector2 with maximum components
   */
  public static max(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y));
  }
}
