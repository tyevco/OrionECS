import { Vector2 } from './Vector2';

/**
 * Represents a 2D axis-aligned bounding box (AABB).
 * Useful for collision detection, spatial queries, and UI layout.
 */
export class Bounds {
  private _left: number;
  private _top: number;
  private _width: number;
  private _height: number;

  /**
   * Creates a new Bounds with the specified properties.
   * @param left The left edge position
   * @param top The top edge position
   * @param width The width of the bounds
   * @param height The height of the bounds
   */
  constructor(left: number = 0, top: number = 0, width: number = 0, height: number = 0) {
    this._left = left;
    this._top = top;
    this._width = width;
    this._height = height;
  }

  /**
   * Gets the left edge position.
   */
  public get left(): number {
    return this._left;
  }

  /**
   * Sets the left edge position.
   */
  public set left(value: number) {
    this._left = value;
  }

  /**
   * Gets the top edge position.
   */
  public get top(): number {
    return this._top;
  }

  /**
   * Sets the top edge position.
   */
  public set top(value: number) {
    this._top = value;
  }

  /**
   * Gets the width of the bounds.
   */
  public get width(): number {
    return this._width;
  }

  /**
   * Sets the width of the bounds.
   */
  public set width(value: number) {
    this._width = value;
  }

  /**
   * Gets the height of the bounds.
   */
  public get height(): number {
    return this._height;
  }

  /**
   * Sets the height of the bounds.
   */
  public set height(value: number) {
    this._height = value;
  }

  /**
   * Gets the right edge position.
   */
  public get right(): number {
    return this._left + this._width;
  }

  /**
   * Gets the bottom edge position.
   */
  public get bottom(): number {
    return this._top + this._height;
  }

  /**
   * Gets the center position as a Vector2.
   */
  public get center(): Vector2 {
    return new Vector2(
      this._left + this._width / 2,
      this._top + this._height / 2
    );
  }

  /**
   * Gets the size as a Vector2.
   */
  public get size(): Vector2 {
    return new Vector2(this._width, this._height);
  }

  /**
   * Gets the minimum corner (top-left) as a Vector2.
   */
  public get min(): Vector2 {
    return new Vector2(this._left, this._top);
  }

  /**
   * Gets the maximum corner (bottom-right) as a Vector2.
   */
  public get max(): Vector2 {
    return new Vector2(this.right, this.bottom);
  }

  /**
   * Gets the top-left corner as a Vector2.
   */
  public get topLeft(): Vector2 {
    return new Vector2(this._left, this._top);
  }

  /**
   * Gets the top-right corner as a Vector2.
   */
  public get topRight(): Vector2 {
    return new Vector2(this.right, this._top);
  }

  /**
   * Gets the bottom-left corner as a Vector2.
   */
  public get bottomLeft(): Vector2 {
    return new Vector2(this._left, this.bottom);
  }

  /**
   * Gets the bottom-right corner as a Vector2.
   */
  public get bottomRight(): Vector2 {
    return new Vector2(this.right, this.bottom);
  }

  /**
   * Checks if this bounds contains a point.
   * @param position The point to check
   * @returns True if the point is inside the bounds
   */
  public contains(position: Vector2): boolean {
    return (
      position.x >= this._left &&
      position.x <= this.right &&
      position.y >= this._top &&
      position.y <= this.bottom
    );
  }

  /**
   * Checks if this bounds contains another bounds entirely.
   * @param other The bounds to check
   * @returns True if the other bounds is completely inside this bounds
   */
  public containsBounds(other: Bounds): boolean {
    return (
      other.left >= this._left &&
      other.right <= this.right &&
      other.top >= this._top &&
      other.bottom <= this.bottom
    );
  }

  /**
   * Checks if this bounds intersects with another bounds.
   * @param other The bounds to check for intersection
   * @returns True if the bounds overlap
   */
  public intersects(other: Bounds): boolean {
    return !(
      other.left > this.right ||
      other.right < this._left ||
      other.top > this.bottom ||
      other.bottom < this._top
    );
  }

  /**
   * Checks if this bounds intersects with a circle.
   * @param center The center of the circle
   * @param radius The radius of the circle
   * @returns True if the circle and bounds overlap
   */
  public intersectsCircle(center: Vector2, radius: number): boolean {
    // Find the closest point on the bounds to the circle center
    const closest = this.closestPoint(center);

    // Calculate the distance from the circle center to this closest point
    const distance = center.distanceTo(closest);

    // If the distance is less than or equal to the radius, they intersect
    return distance <= radius;
  }

  /**
   * Calculates the intersection area with another bounds.
   * @param other The bounds to intersect with
   * @returns A new Bounds representing the intersection, or null if no intersection
   */
  public intersection(other: Bounds): Bounds | null {
    if (!this.intersects(other)) {
      return null;
    }

    const left = Math.max(this._left, other.left);
    const top = Math.max(this._top, other.top);
    const right = Math.min(this.right, other.right);
    const bottom = Math.min(this.bottom, other.bottom);

    return new Bounds(left, top, right - left, bottom - top);
  }

  /**
   * Calculates the union (bounding box) of this bounds and another bounds.
   * @param other The bounds to union with
   * @returns A new Bounds that encompasses both bounds
   */
  public union(other: Bounds): Bounds {
    const left = Math.min(this._left, other.left);
    const top = Math.min(this._top, other.top);
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);

    return new Bounds(left, top, right - left, bottom - top);
  }

  /**
   * Expands this bounds to include the specified point.
   * If the point is already inside, the bounds remain unchanged.
   * @param point The point to encapsulate
   * @returns This bounds for chaining
   */
  public encapsulate(point: Vector2): this {
    const right = Math.max(this.right, point.x);
    const bottom = Math.max(this.bottom, point.y);
    this._left = Math.min(this._left, point.x);
    this._top = Math.min(this._top, point.y);
    this._width = right - this._left;
    this._height = bottom - this._top;
    return this;
  }

  /**
   * Expands this bounds to include another bounds.
   * This modifies the current bounds in place (unlike union which returns a new Bounds).
   * @param other The bounds to encapsulate
   * @returns This bounds for chaining
   */
  public encapsulateBounds(other: Bounds): this {
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);
    this._left = Math.min(this._left, other.left);
    this._top = Math.min(this._top, other.top);
    this._width = right - this._left;
    this._height = bottom - this._top;
    return this;
  }

  /**
   * Expands this bounds by the specified amount in all directions.
   * @param amount The amount to expand by
   * @returns This bounds for chaining
   */
  public expand(amount: number): this {
    this._left -= amount;
    this._top -= amount;
    this._width += amount * 2;
    this._height += amount * 2;
    return this;
  }

  /**
   * Shrinks this bounds by the specified amount in all directions.
   * @param amount The amount to shrink by
   * @returns This bounds for chaining
   */
  public shrink(amount: number): this {
    return this.expand(-amount);
  }

  /**
   * Scales this bounds by the specified factors.
   * @param sx The x scale factor
   * @param sy The y scale factor (defaults to sx if not provided)
   * @param fromCenter Whether to scale from center (true) or from top-left corner (false)
   * @returns This bounds for chaining
   */
  public scale(sx: number, sy: number = sx, fromCenter: boolean = true): this {
    if (fromCenter) {
      const centerX = this._left + this._width / 2;
      const centerY = this._top + this._height / 2;
      this._width *= sx;
      this._height *= sy;
      this._left = centerX - this._width / 2;
      this._top = centerY - this._height / 2;
    } else {
      this._width *= sx;
      this._height *= sy;
    }
    return this;
  }

  /**
   * Translates (moves) this bounds by the specified amount.
   * This is an alias for offset() for API consistency.
   * @param x The x translation (or Vector2 if only parameter provided)
   * @param y The y translation (optional if x is Vector2)
   * @returns This bounds for chaining
   */
  public translate(x: number | Vector2, y?: number): this {
    if (x instanceof Vector2) {
      return this.offset(x.x, x.y);
    }
    return this.offset(x, y ?? 0);
  }

  /**
   * Offsets this bounds by the specified amount.
   * @param x The x offset
   * @param y The y offset
   * @returns This bounds for chaining
   */
  public offset(x: number, y: number): this {
    this._left += x;
    this._top += y;
    return this;
  }

  /**
   * Offsets this bounds by a vector.
   * @param vector The offset vector
   * @returns This bounds for chaining
   */
  public offsetVector(vector: Vector2): this {
    return this.offset(vector.x, vector.y);
  }

  /**
   * Calculates the area of this bounds.
   * @returns The area (width * height)
   */
  public area(): number {
    return this._width * this._height;
  }

  /**
   * Calculates the perimeter of this bounds.
   * @returns The perimeter
   */
  public perimeter(): number {
    return 2 * (this._width + this._height);
  }

  /**
   * Checks if this bounds is empty (width or height is zero or negative).
   * @returns True if the bounds is empty
   */
  public isEmpty(): boolean {
    return this._width <= 0 || this._height <= 0;
  }

  /**
   * Clamps a point to be within this bounds.
   * @param position The point to clamp
   * @returns A new clamped Vector2
   */
  public clamp(position: Vector2): Vector2 {
    return new Vector2(
      Math.max(this._left, Math.min(this.right, position.x)),
      Math.max(this._top, Math.min(this.bottom, position.y))
    );
  }

  /**
   * Finds the closest point on or within this bounds to the given position.
   * This is an alias for clamp() for API consistency.
   * @param position The point to find the closest point to
   * @returns The closest point on the bounds
   */
  public closestPoint(position: Vector2): Vector2 {
    return this.clamp(position);
  }

  /**
   * Calculates the distance from this bounds to a point.
   * Returns 0 if the point is inside the bounds.
   * @param position The point to measure distance to
   * @returns The distance to the point
   */
  public distanceToPoint(position: Vector2): number {
    const closest = this.closestPoint(position);
    return position.distanceTo(closest);
  }

  /**
   * Creates a deep copy of this bounds.
   * @returns A new Bounds with the same values
   */
  public clone(): Bounds {
    return new Bounds(this._left, this._top, this._width, this._height);
  }

  /**
   * Copies values from another bounds.
   * @param other The bounds to copy from
   * @returns This bounds for chaining
   */
  public copy(other: Bounds): this {
    this._left = other.left;
    this._top = other.top;
    this._width = other.width;
    this._height = other.height;
    return this;
  }

  /**
   * Checks if this bounds equals another bounds.
   * @param other The bounds to compare with
   * @param epsilon Optional tolerance for floating point comparison
   * @returns True if bounds are equal
   */
  public equals(other: Bounds, epsilon: number = 0): boolean {
    if (epsilon === 0) {
      return (
        this._left === other.left &&
        this._top === other.top &&
        this._width === other.width &&
        this._height === other.height
      );
    }
    return (
      Math.abs(this._left - other.left) <= epsilon &&
      Math.abs(this._top - other.top) <= epsilon &&
      Math.abs(this._width - other.width) <= epsilon &&
      Math.abs(this._height - other.height) <= epsilon
    );
  }

  /**
   * Converts this bounds to a string representation.
   * @returns String in format "Bounds(left, top, width, height)"
   */
  public toString(): string {
    return `Bounds(${this._left}, ${this._top}, ${this._width}, ${this._height})`;
  }

  /**
   * Creates a Bounds from two corner points.
   * @param corner1 The first corner
   * @param corner2 The opposite corner
   * @returns A new Bounds
   */
  public static fromCorners(corner1: Vector2, corner2: Vector2): Bounds {
    const left = Math.min(corner1.x, corner2.x);
    const top = Math.min(corner1.y, corner2.y);
    const right = Math.max(corner1.x, corner2.x);
    const bottom = Math.max(corner1.y, corner2.y);
    return new Bounds(left, top, right - left, bottom - top);
  }

  /**
   * Creates a Bounds from center point and size.
   * @param center The center position
   * @param width The width
   * @param height The height
   * @returns A new Bounds
   */
  public static fromCenter(center: Vector2, width: number, height: number): Bounds {
    return new Bounds(
      center.x - width / 2,
      center.y - height / 2,
      width,
      height
    );
  }

  /**
   * Creates a Bounds that encompasses all provided points.
   * @param points Array of points
   * @returns A new Bounds, or null if no points provided
   */
  public static fromPoints(points: Vector2[]): Bounds | null {
    if (points.length === 0) {
      return null;
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      minX = Math.min(minX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxX = Math.max(maxX, points[i].x);
      maxY = Math.max(maxY, points[i].y);
    }

    return new Bounds(minX, minY, maxX - minX, maxY - minY);
  }
}
