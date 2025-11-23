/**
 * Represents a 2D vector with comprehensive mathematical operations.
 *
 * This class provides a complete set of vector operations including:
 * - Basic arithmetic (add, subtract, multiply, divide)
 * - Vector products (dot, cross)
 * - Angular operations (rotation, angle calculation)
 * - Interpolation (linear and spherical)
 * - Reflection, projection, and perpendicular calculations
 * - Component and magnitude clamping
 *
 * Most methods come in both mutable (modify in place) and immutable (return new instance) variants.
 *
 * @example
 * ```typescript
 * // Create vectors
 * const position = new Vector2(10, 20);
 * const velocity = new Vector2(1, 0);
 *
 * // Immutable operations (return new vectors)
 * const newPos = position.plus(velocity);
 * const normalized = velocity.normal();
 *
 * // Mutable operations (modify in place)
 * position.add(velocity);
 * velocity.normalize();
 *
 * // Angular operations
 * const angle = velocity.angle();
 * const rotated = velocity.rotated(Math.PI / 4);
 *
 * // Static helper methods
 * const distance = Vector2.distance(position, newPos);
 * const interpolated = Vector2.lerp(position, newPos, 0.5);
 * ```
 *
 * @category Math
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
   *
   * This is the immutable version of {@link add}. The original vector remains unchanged.
   *
   * @param other - The vector to add
   * @returns A new Vector2 representing the sum
   *
   * @example
   * ```typescript
   * const v1 = new Vector2(1, 2);
   * const v2 = new Vector2(3, 4);
   * const sum = v1.plus(v2); // Vector2(4, 6)
   * // v1 is still Vector2(1, 2)
   * ```
   *
   * @see {@link add} for the mutable version
   * @category Arithmetic
   */
  public plus(other: Vector2): Vector2 {
    return new Vector2(this._x + other.x, this._y + other.y);
  }

  /**
   * Returns a new vector that is the difference of this vector and another.
   *
   * This is the immutable version of {@link subtract}. The original vector remains unchanged.
   *
   * @param other - The vector to subtract
   * @returns A new Vector2 representing the difference
   *
   * @example
   * ```typescript
   * const v1 = new Vector2(5, 7);
   * const v2 = new Vector2(2, 3);
   * const diff = v1.minus(v2); // Vector2(3, 4)
   * // v1 is still Vector2(5, 7)
   * ```
   *
   * @see {@link subtract} for the mutable version
   * @category Arithmetic
   */
  public minus(other: Vector2): Vector2 {
    return new Vector2(this._x - other.x, this._y - other.y);
  }

  /**
   * Returns a new vector that is this vector multiplied by a scalar.
   *
   * This is the immutable version of {@link multiply}. The original vector remains unchanged.
   *
   * @param scalar - The scalar value to multiply by
   * @returns A new Vector2 scaled by the scalar
   *
   * @example
   * ```typescript
   * const v = new Vector2(3, 4);
   * const scaled = v.times(2); // Vector2(6, 8)
   * // v is still Vector2(3, 4)
   * ```
   *
   * @see {@link multiply} for the mutable version
   * @category Arithmetic
   */
  public times(scalar: number): Vector2 {
    return new Vector2(this._x * scalar, this._y * scalar);
  }

  /**
   * Returns a new vector that is this vector divided by a scalar.
   *
   * This is the immutable version of {@link divide}. The original vector remains unchanged.
   *
   * @param scalar - The scalar value to divide by (must not be zero)
   * @returns A new Vector2 divided by the scalar
   * @throws {Error} If scalar is zero
   *
   * @example
   * ```typescript
   * const v = new Vector2(10, 20);
   * const scaled = v.dividedBy(2); // Vector2(5, 10)
   * // v is still Vector2(10, 20)
   * ```
   *
   * @see {@link divide} for the mutable version
   * @category Arithmetic
   */
  public dividedBy(scalar: number): Vector2 {
    if (scalar === 0) {
      throw new Error('Cannot divide vector by zero');
    }
    return new Vector2(this._x / scalar, this._y / scalar);
  }

  /**
   * Returns a new vector with negated components.
   *
   * This creates a vector pointing in the opposite direction with the same magnitude.
   *
   * @returns A new Vector2 pointing in the opposite direction
   *
   * @example
   * ```typescript
   * const v = new Vector2(3, -4);
   * const neg = v.negated(); // Vector2(-3, 4)
   * // v is still Vector2(3, -4)
   * ```
   *
   * @see {@link negate} for the mutable version
   * @category Arithmetic
   */
  public negated(): Vector2 {
    return new Vector2(-this._x, -this._y);
  }

  /**
   * Negates this vector in place (flips direction).
   *
   * Modifies this vector to point in the opposite direction.
   *
   * @returns This vector for chaining
   *
   * @example
   * ```typescript
   * const v = new Vector2(3, -4);
   * v.negate(); // v is now Vector2(-3, 4)
   * ```
   *
   * @see {@link negated} for the immutable version
   * @category Arithmetic
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
   *
   * Returns a value in the range [-π, π], using the standard mathematical convention
   * where positive angles are counter-clockwise.
   *
   * @returns The angle in radians [-π, π]
   *
   * @example
   * ```typescript
   * const right = new Vector2(1, 0);
   * right.angle(); // 0
   *
   * const up = new Vector2(0, 1);
   * up.angle(); // π/2 (90 degrees)
   *
   * const left = new Vector2(-1, 0);
   * left.angle(); // π (180 degrees)
   *
   * const down = new Vector2(0, -1);
   * down.angle(); // -π/2 (-90 degrees)
   * ```
   *
   * @see {@link angleTo} for the angle between two vectors
   * @category Angular
   */
  public angle(): number {
    return Math.atan2(this._y, this._x);
  }

  /**
   * Rotates this vector by the specified angle in radians (in place).
   *
   * Applies a 2D rotation transformation using the rotation matrix. Positive angles
   * rotate counter-clockwise.
   *
   * @param radians - The angle to rotate by (positive = counter-clockwise)
   * @returns This vector for chaining
   *
   * @example
   * ```typescript
   * const v = new Vector2(1, 0);
   * v.rotate(Math.PI / 2); // Rotate 90° counter-clockwise
   * // v is now approximately Vector2(0, 1)
   *
   * const v2 = new Vector2(3, 4);
   * v2.rotate(-Math.PI / 4); // Rotate 45° clockwise
   * ```
   *
   * @see {@link rotated} for the immutable version
   * @category Angular
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
   *
   * Applies a 2D rotation transformation using the rotation matrix. The original
   * vector remains unchanged. Positive angles rotate counter-clockwise.
   *
   * @param radians - The angle to rotate by (positive = counter-clockwise)
   * @returns A new rotated Vector2
   *
   * @example
   * ```typescript
   * const v = new Vector2(1, 0);
   * const rotated = v.rotated(Math.PI / 2); // Vector2(0, 1)
   * // v is still Vector2(1, 0)
   *
   * // Rotate 45 degrees clockwise
   * const diagonal = new Vector2(1, 1);
   * const rotated45 = diagonal.rotated(-Math.PI / 4);
   * ```
   *
   * @see {@link rotate} for the mutable version
   * @category Angular
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
   *
   * This is an alias for {@link perpendicularLeft}. The perpendicular vector maintains
   * the same length as the original and is orthogonal (dot product = 0).
   *
   * @returns A new perpendicular Vector2
   *
   * @example
   * ```typescript
   * const right = new Vector2(1, 0);
   * const up = right.perpendicular(); // Vector2(0, 1)
   *
   * const v = new Vector2(3, 4);
   * const perp = v.perpendicular();
   * v.dot(perp); // 0 (orthogonal)
   * perp.length(); // 5 (same length as v)
   * ```
   *
   * @see {@link perpendicularLeft} for explicit left rotation
   * @see {@link perpendicularRight} for clockwise rotation
   * @category Perpendicular
   */
  public perpendicular(): Vector2 {
    return new Vector2(-this._y, this._x);
  }

  /**
   * Returns a vector perpendicular to this one (rotated 90° counter-clockwise).
   *
   * The perpendicular vector maintains the same length as the original and is
   * orthogonal (dot product = 0).
   *
   * @returns A new perpendicular Vector2
   *
   * @example
   * ```typescript
   * const right = new Vector2(1, 0);
   * const up = right.perpendicularLeft(); // Vector2(0, 1)
   * ```
   *
   * @see {@link perpendicular} for the default perpendicular (same as this)
   * @see {@link perpendicularRight} for clockwise rotation
   * @category Perpendicular
   */
  public perpendicularLeft(): Vector2 {
    return new Vector2(-this._y, this._x);
  }

  /**
   * Returns a vector perpendicular to this one (rotated 90° clockwise).
   *
   * The perpendicular vector maintains the same length as the original and is
   * orthogonal (dot product = 0).
   *
   * @returns A new perpendicular Vector2
   *
   * @example
   * ```typescript
   * const right = new Vector2(1, 0);
   * const down = right.perpendicularRight(); // Vector2(0, -1)
   * ```
   *
   * @see {@link perpendicular} for counter-clockwise rotation
   * @see {@link perpendicularLeft} for counter-clockwise rotation (explicit)
   * @category Perpendicular
   */
  public perpendicularRight(): Vector2 {
    return new Vector2(this._y, -this._x);
  }

  // ============================================================
  // Reflection and Projection
  // ============================================================

  /**
   * Reflects this vector across a normal vector.
   *
   * Computes the reflection of this vector across a surface defined by the normal vector,
   * simulating a bounce effect. The magnitude of the reflected vector equals the original.
   *
   * @param normal - The normal vector to reflect across (should be normalized for accurate results)
   * @returns A new reflected Vector2
   *
   * @example
   * ```typescript
   * // Ball bouncing off a horizontal surface
   * const velocity = new Vector2(3, -4); // Moving right and down
   * const surfaceNormal = new Vector2(0, 1); // Pointing up
   * const reflected = velocity.reflect(surfaceNormal);
   * // reflected is Vector2(3, 4) - now moving right and up
   *
   * // Reflection maintains magnitude
   * velocity.length() === reflected.length(); // true
   * ```
   *
   * @see {@link project} for vector projection
   * @category Reflection
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
   *
   * Computes the orthogonal projection of this vector onto the target vector.
   * The result is a vector parallel to the target with length equal to the
   * component of this vector in the direction of the target.
   *
   * @param other - The vector to project onto
   * @returns A new projected Vector2 (parallel to `other`)
   *
   * @example
   * ```typescript
   * // Project velocity onto horizontal axis
   * const velocity = new Vector2(3, 4);
   * const horizontal = new Vector2(1, 0);
   * const projected = velocity.project(horizontal);
   * // projected is Vector2(3, 0) - horizontal component only
   *
   * // Project onto diagonal
   * const v = new Vector2(4, 2);
   * const diagonal = new Vector2(1, 1);
   * const proj = v.project(diagonal);
   * // proj is parallel to diagonal, length = v's component along diagonal
   * ```
   *
   * @see {@link reflect} for vector reflection
   * @category Projection
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
   *
   * SLERP maintains constant angular velocity and magnitude during interpolation,
   * making it ideal for smooth rotational animations. Unlike {@link lerp}, which
   * takes a straight-line path, SLERP follows an arc on the unit circle.
   *
   * For vectors that are nearly parallel, this method automatically falls back to
   * {@link lerp} for numerical stability.
   *
   * @param other - The target vector
   * @param t - The interpolation factor (0 = this vector, 1 = other vector)
   * @returns A new interpolated Vector2
   *
   * @example
   * ```typescript
   * // Smooth rotation between two directions
   * const start = new Vector2(1, 0);    // East
   * const end = new Vector2(0, 1);      // North
   *
   * const quarter = start.slerp(end, 0.25);   // Northeast-ish
   * const half = start.slerp(end, 0.5);       // Exactly northeast
   * const threeQuarter = start.slerp(end, 0.75); // North-ish
   *
   * // SLERP maintains constant length
   * start.length() === half.length(); // true (approximately)
   *
   * // Compare with lerp (straight line, variable speed)
   * const lerpHalf = start.lerp(end, 0.5);
   * lerpHalf.length() < start.length(); // true (shorter path)
   * ```
   *
   * @see {@link lerp} for linear interpolation
   * @category Interpolation
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
   * Clamps the vector components to the specified min and max values (in place).
   *
   * Each component (x and y) is independently clamped to the range [min, max].
   * This is useful for keeping positions within boundaries.
   *
   * @param min - The minimum value for each component
   * @param max - The maximum value for each component
   * @returns This vector for chaining
   *
   * @example
   * ```typescript
   * const position = new Vector2(150, -50);
   * position.clamp(0, 100); // Clamp to screen bounds
   * // position is now Vector2(100, 0)
   * ```
   *
   * @see {@link clamped} for the immutable version
   * @see {@link clampLength} for magnitude clamping
   * @category Clamping
   */
  public clamp(min: number, max: number): this {
    this._x = Math.max(min, Math.min(max, this._x));
    this._y = Math.max(min, Math.min(max, this._y));
    return this;
  }

  /**
   * Returns a new vector with clamped components.
   *
   * Each component (x and y) is independently clamped to the range [min, max].
   * The original vector remains unchanged.
   *
   * @param min - The minimum value for each component
   * @param max - The maximum value for each component
   * @returns A new clamped Vector2
   *
   * @example
   * ```typescript
   * const position = new Vector2(150, -50);
   * const clamped = position.clamped(0, 100);
   * // clamped is Vector2(100, 0)
   * // position is still Vector2(150, -50)
   * ```
   *
   * @see {@link clamp} for the mutable version
   * @see {@link clampedLength} for magnitude clamping
   * @category Clamping
   */
  public clamped(min: number, max: number): Vector2 {
    return new Vector2(
      Math.max(min, Math.min(max, this._x)),
      Math.max(min, Math.min(max, this._y))
    );
  }

  /**
   * Clamps the length (magnitude) of this vector to the specified range (in place).
   *
   * Maintains the vector's direction while ensuring its magnitude falls within
   * [minLength, maxLength]. Useful for limiting velocities and forces.
   *
   * @param minLength - The minimum length
   * @param maxLength - The maximum length
   * @returns This vector for chaining
   *
   * @example
   * ```typescript
   * // Limit player speed
   * const velocity = new Vector2(300, 400); // Length = 500
   * velocity.clampLength(0, 200);
   * // velocity is now scaled to length 200, direction unchanged
   *
   * // Ensure minimum speed
   * const slowVelocity = new Vector2(1, 1); // Length ≈ 1.41
   * slowVelocity.clampLength(10, 100);
   * // slowVelocity is now scaled to length 10
   * ```
   *
   * @see {@link clampedLength} for the immutable version
   * @see {@link clamp} for component clamping
   * @category Clamping
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
   *
   * Maintains the vector's direction while ensuring its magnitude falls within
   * [minLength, maxLength]. The original vector remains unchanged.
   *
   * @param minLength - The minimum length
   * @param maxLength - The maximum length
   * @returns A new Vector2 with clamped length
   *
   * @example
   * ```typescript
   * const velocity = new Vector2(300, 400); // Length = 500
   * const limited = velocity.clampedLength(0, 200);
   * // limited has length 200, same direction as velocity
   * // velocity still has length 500
   * ```
   *
   * @see {@link clampLength} for the mutable version
   * @see {@link clamped} for component clamping
   * @category Clamping
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
   *
   * When an epsilon value is provided, the check uses tolerance for floating-point
   * comparison, which is useful for physics simulations and numerical computations.
   *
   * @param epsilon - Optional tolerance for floating-point comparison (default: 0)
   * @returns True if this is a zero vector within the tolerance
   *
   * @example
   * ```typescript
   * const zero = new Vector2(0, 0);
   * zero.isZero(); // true
   *
   * const nearZero = new Vector2(0.00001, 0.00001);
   * nearZero.isZero(); // false (exact comparison)
   * nearZero.isZero(0.0001); // true (with tolerance)
   *
   * // Useful for stopping nearly-stopped objects
   * if (velocity.isZero(0.01)) {
   *   velocity.set(0, 0); // Stop completely
   * }
   * ```
   *
   * @category Utility
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
   * @param a - First vector
   * @param b - Second vector
   * @returns The distance between the vectors
   * @category Static Helpers
   */
  public static distance(a: Vector2, b: Vector2): number {
    return a.distanceTo(b);
  }

  /**
   * Calculates the squared distance between two vectors.
   * @param a - First vector
   * @param b - Second vector
   * @returns The squared distance between the vectors
   * @category Static Helpers
   */
  public static distanceSquared(a: Vector2, b: Vector2): number {
    return a.distanceToSquared(b);
  }

  /**
   * Calculates the dot product of two vectors.
   * @param a - First vector
   * @param b - Second vector
   * @returns The dot product
   * @category Static Helpers
   */
  public static dot(a: Vector2, b: Vector2): number {
    return a.dot(b);
  }

  /**
   * Calculates the 2D cross product of two vectors.
   * @param a - First vector
   * @param b - Second vector
   * @returns The cross product magnitude
   * @category Static Helpers
   */
  public static cross(a: Vector2, b: Vector2): number {
    return a.cross(b);
  }

  /**
   * Calculates the angle between two vectors in radians.
   * @param a - First vector
   * @param b - Second vector
   * @returns The angle in radians
   * @category Static Helpers
   */
  public static angleBetween(a: Vector2, b: Vector2): number {
    return a.angleTo(b);
  }

  /**
   * Linearly interpolates between two vectors.
   * @param a - Start vector
   * @param b - End vector
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated Vector2
   * @category Static Helpers
   */
  public static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return a.lerp(b, t);
  }

  /**
   * Spherically interpolates between two vectors.
   * @param a - Start vector
   * @param b - End vector
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated Vector2
   * @category Static Helpers
   */
  public static slerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return a.slerp(b, t);
  }

  /**
   * Adds two vectors and returns the result.
   * @param a - First vector
   * @param b - Second vector
   * @returns A new Vector2
   * @category Static Helpers
   */
  public static add(a: Vector2, b: Vector2): Vector2 {
    return a.plus(b);
  }

  /**
   * Subtracts two vectors and returns the result.
   * @param a - First vector
   * @param b - Second vector
   * @returns A new Vector2
   * @category Static Helpers
   */
  public static subtract(a: Vector2, b: Vector2): Vector2 {
    return a.minus(b);
  }

  /**
   * Multiplies a vector by a scalar and returns the result.
   * @param vector - The vector
   * @param scalar - The scalar value
   * @returns A new Vector2
   * @category Static Helpers
   */
  public static multiply(vector: Vector2, scalar: number): Vector2 {
    return vector.times(scalar);
  }

  /**
   * Divides a vector by a scalar and returns the result.
   * @param vector - The vector
   * @param scalar - The scalar value
   * @returns A new Vector2
   * @category Static Helpers
   */
  public static divide(vector: Vector2, scalar: number): Vector2 {
    return vector.dividedBy(scalar);
  }

  /**
   * Returns the minimum of two vectors (component-wise).
   *
   * Creates a new vector where each component is the minimum of the corresponding
   * components from the input vectors.
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns A new Vector2 with minimum components
   *
   * @example
   * ```typescript
   * const v1 = new Vector2(3, 8);
   * const v2 = new Vector2(5, 2);
   * const min = Vector2.min(v1, v2); // Vector2(3, 2)
   * ```
   *
   * @see {@link max} for component-wise maximum
   * @category Static Helpers
   */
  public static min(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y));
  }

  /**
   * Returns the maximum of two vectors (component-wise).
   *
   * Creates a new vector where each component is the maximum of the corresponding
   * components from the input vectors.
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns A new Vector2 with maximum components
   *
   * @example
   * ```typescript
   * const v1 = new Vector2(3, 8);
   * const v2 = new Vector2(5, 2);
   * const max = Vector2.max(v1, v2); // Vector2(5, 8)
   * ```
   *
   * @see {@link min} for component-wise minimum
   * @category Static Helpers
   */
  public static max(a: Vector2, b: Vector2): Vector2 {
    return new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y));
  }
}
