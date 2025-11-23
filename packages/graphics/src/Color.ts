/**
 * Represents a color with support for various formats (hex, RGB, RGBA, HSL).
 * Provides utilities for color manipulation and conversion.
 */
export class Color {
  private _value: string;

  /**
   * Creates a new Color from a string or RGBA values.
   * @param colorOrRed Color string (hex, named, rgb, rgba, hsl) or red component (0-255)
   * @param green Green component (0-255)
   * @param blue Blue component (0-255)
   * @param alpha Alpha component (0-1), defaults to 1
   */
  constructor(colorOrRed: string | number, green?: number, blue?: number, alpha?: number) {
    if (typeof colorOrRed === 'string') {
      this._value = colorOrRed;
    } else {
      const r = colorOrRed || 0;
      const g = green || 0;
      const b = blue || 0;
      const a = alpha !== undefined ? alpha : 1;
      this._value = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  /**
   * Gets the color value as a CSS-compatible string.
   */
  public get value(): string {
    return this._value;
  }

  /**
   * Sets the color value.
   */
  public set value(color: string) {
    this._value = color;
  }

  /**
   * Converts this color to a string (alias for value).
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Creates a Color from hex format.
   * @param hex Hex string (e.g., "#FF0000" or "FF0000")
   * @returns A new Color
   */
  public static fromHex(hex: string): Color {
    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Handle 3-digit hex
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return new Color(r, g, b);
    }

    // Handle 6-digit hex
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return new Color(r, g, b);
    }

    // Handle 8-digit hex (with alpha)
    if (cleanHex.length === 8) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      const a = parseInt(cleanHex.substring(6, 8), 16) / 255;
      return new Color(r, g, b, a);
    }

    throw new Error(`Invalid hex color: ${hex}`);
  }

  /**
   * Creates a Color from HSL values.
   * @param h Hue (0-360)
   * @param s Saturation (0-100)
   * @param l Lightness (0-100)
   * @param a Alpha (0-1), defaults to 1
   * @returns A new Color
   */
  public static fromHSL(h: number, s: number, l: number, a: number = 1): Color {
    return new Color(`hsla(${h}, ${s}%, ${l}%, ${a})`);
  }

  /**
   * Creates a Color from RGB values.
   * @param r Red (0-255)
   * @param g Green (0-255)
   * @param b Blue (0-255)
   * @returns A new Color
   */
  public static fromRGB(r: number, g: number, b: number): Color {
    return new Color(r, g, b);
  }

  /**
   * Creates a Color from RGBA values.
   * @param r Red (0-255)
   * @param g Green (0-255)
   * @param b Blue (0-255)
   * @param a Alpha (0-1)
   * @returns A new Color
   */
  public static fromRGBA(r: number, g: number, b: number, a: number): Color {
    return new Color(r, g, b, a);
  }

  /**
   * Parses RGB/RGBA from the color value.
   * @returns Object with r, g, b, a properties, or null if parsing fails
   */
  public toRGBA(): { r: number; g: number; b: number; a: number } | null {
    const match = this._value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
    }
    return null;
  }

  /**
   * Creates a copy of this color.
   * @returns A new Color with the same value
   */
  public clone(): Color {
    return new Color(this._value);
  }

  // Common color constants
  public static readonly Black = new Color(0, 0, 0);
  public static readonly White = new Color(255, 255, 255);
  public static readonly Red = new Color(255, 0, 0);
  public static readonly Green = new Color(0, 255, 0);
  public static readonly Blue = new Color(0, 0, 255);
  public static readonly Yellow = new Color(255, 255, 0);
  public static readonly Cyan = new Color(0, 255, 255);
  public static readonly Magenta = new Color(255, 0, 255);
  public static readonly Transparent = new Color(0, 0, 0, 0);
  public static readonly Gray = new Color(128, 128, 128);
  public static readonly Orange = new Color(255, 165, 0);
  public static readonly Purple = new Color(128, 0, 128);
  public static readonly Pink = new Color(255, 192, 203);
  public static readonly Brown = new Color(165, 42, 42);
}
