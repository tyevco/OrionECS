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
}
