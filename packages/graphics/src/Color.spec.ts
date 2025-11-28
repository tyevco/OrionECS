/**
 * Color class tests
 */

import { Color } from './Color';

describe('Color', () => {
    describe('Constructor', () => {
        it('should create color from string', () => {
            const color = new Color('#FF0000');

            expect(color.value).toBe('#FF0000');
        });

        it('should create color from RGB values', () => {
            const color = new Color(255, 128, 64);

            expect(color.value).toBe('rgba(255, 128, 64, 1)');
        });

        it('should create color from RGBA values', () => {
            const color = new Color(255, 128, 64, 0.5);

            expect(color.value).toBe('rgba(255, 128, 64, 0.5)');
        });

        it('should handle zero values', () => {
            const color = new Color(0, 0, 0);

            expect(color.value).toBe('rgba(0, 0, 0, 1)');
        });

        it('should default alpha to 1 when not provided', () => {
            const color = new Color(100, 100, 100);

            expect(color.value).toContain(', 1)');
        });
    });

    describe('value getter/setter', () => {
        it('should get color value', () => {
            const color = new Color('blue');

            expect(color.value).toBe('blue');
        });

        it('should set color value', () => {
            const color = new Color('red');

            color.value = 'green';

            expect(color.value).toBe('green');
        });
    });

    describe('toString', () => {
        it('should return color value as string', () => {
            const color = new Color('#123456');

            expect(color.toString()).toBe('#123456');
        });
    });

    describe('fromHex', () => {
        it('should create color from 6-digit hex with hash', () => {
            const color = Color.fromHex('#FF5500');

            expect(color.value).toBe('rgba(255, 85, 0, 1)');
        });

        it('should create color from 6-digit hex without hash', () => {
            const color = Color.fromHex('00FF00');

            expect(color.value).toBe('rgba(0, 255, 0, 1)');
        });

        it('should create color from 3-digit hex', () => {
            const color = Color.fromHex('#F00');

            expect(color.value).toBe('rgba(255, 0, 0, 1)');
        });

        it('should create color from 3-digit hex without hash', () => {
            const color = Color.fromHex('0F0');

            expect(color.value).toBe('rgba(0, 255, 0, 1)');
        });

        it('should create color from 8-digit hex with alpha', () => {
            const color = Color.fromHex('#FF000080');

            expect(color.value).toContain('rgba(255, 0, 0,');
            // Alpha should be approximately 0.5 (128/255)
            const rgba = color.toRGBA();
            expect(rgba?.a).toBeCloseTo(0.502, 2);
        });

        it('should throw error for invalid hex', () => {
            expect(() => Color.fromHex('#12')).toThrow('Invalid hex color');
            expect(() => Color.fromHex('#1234567')).toThrow('Invalid hex color');
        });
    });

    describe('fromHSL', () => {
        it('should create color from HSL values', () => {
            const color = Color.fromHSL(180, 50, 50);

            expect(color.value).toBe('hsla(180, 50%, 50%, 1)');
        });

        it('should create color from HSLA values', () => {
            const color = Color.fromHSL(270, 100, 75, 0.8);

            expect(color.value).toBe('hsla(270, 100%, 75%, 0.8)');
        });
    });

    describe('fromRGB', () => {
        it('should create color from RGB values', () => {
            const color = Color.fromRGB(128, 64, 32);

            expect(color.value).toBe('rgba(128, 64, 32, 1)');
        });
    });

    describe('fromRGBA', () => {
        it('should create color from RGBA values', () => {
            const color = Color.fromRGBA(200, 100, 50, 0.75);

            expect(color.value).toBe('rgba(200, 100, 50, 0.75)');
        });
    });

    describe('toRGBA', () => {
        it('should parse rgba color', () => {
            const color = new Color(100, 150, 200, 0.5);

            const rgba = color.toRGBA();

            expect(rgba).not.toBeNull();
            expect(rgba?.r).toBe(100);
            expect(rgba?.g).toBe(150);
            expect(rgba?.b).toBe(200);
            expect(rgba?.a).toBe(0.5);
        });

        it('should parse rgb color without alpha', () => {
            const color = new Color('rgb(50, 100, 150)');

            const rgba = color.toRGBA();

            expect(rgba).not.toBeNull();
            expect(rgba?.r).toBe(50);
            expect(rgba?.g).toBe(100);
            expect(rgba?.b).toBe(150);
            expect(rgba?.a).toBe(1);
        });

        it('should return null for non-rgb format', () => {
            const color = new Color('#FF0000');

            const rgba = color.toRGBA();

            expect(rgba).toBeNull();
        });

        it('should return null for named colors', () => {
            const color = new Color('red');

            const rgba = color.toRGBA();

            expect(rgba).toBeNull();
        });
    });

    describe('clone', () => {
        it('should create an independent copy', () => {
            const original = new Color(255, 0, 0);

            const cloned = original.clone();

            expect(cloned.value).toBe(original.value);

            cloned.value = 'blue';
            expect(original.value).not.toBe('blue');
        });
    });

    describe('Static color constants', () => {
        it('should have Black', () => {
            expect(Color.Black.value).toBe('rgba(0, 0, 0, 1)');
        });

        it('should have White', () => {
            expect(Color.White.value).toBe('rgba(255, 255, 255, 1)');
        });

        it('should have Red', () => {
            expect(Color.Red.value).toBe('rgba(255, 0, 0, 1)');
        });

        it('should have Green', () => {
            expect(Color.Green.value).toBe('rgba(0, 255, 0, 1)');
        });

        it('should have Blue', () => {
            expect(Color.Blue.value).toBe('rgba(0, 0, 255, 1)');
        });

        it('should have Yellow', () => {
            expect(Color.Yellow.value).toBe('rgba(255, 255, 0, 1)');
        });

        it('should have Cyan', () => {
            expect(Color.Cyan.value).toBe('rgba(0, 255, 255, 1)');
        });

        it('should have Magenta', () => {
            expect(Color.Magenta.value).toBe('rgba(255, 0, 255, 1)');
        });

        it('should have Transparent', () => {
            expect(Color.Transparent.value).toBe('rgba(0, 0, 0, 0)');
        });

        it('should have Gray', () => {
            expect(Color.Gray.value).toBe('rgba(128, 128, 128, 1)');
        });

        it('should have Orange', () => {
            expect(Color.Orange.value).toBe('rgba(255, 165, 0, 1)');
        });

        it('should have Purple', () => {
            expect(Color.Purple.value).toBe('rgba(128, 0, 128, 1)');
        });

        it('should have Pink', () => {
            expect(Color.Pink.value).toBe('rgba(255, 192, 203, 1)');
        });

        it('should have Brown', () => {
            expect(Color.Brown.value).toBe('rgba(165, 42, 42, 1)');
        });
    });
});
