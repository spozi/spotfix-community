import { describe, expect, it } from 'vitest';

import { haversineMeters, pointInRing } from '../src/v2/geo/geo.service';

// Fictional starter boundary (mirrors scripts/seed-geo.ts).
const EXAMPLE_CAMPUS_RING: Array<[number, number]> = [
    [101.681, 3.134],
    [101.692, 3.134],
    [101.692, 3.144],
    [101.681, 3.144]
];

describe('pointInRing', () => {
    it('classifies the example campus center as inside', () => {
        expect(pointInRing(3.139, 101.6869, EXAMPLE_CAMPUS_RING)).toBe(true);
    });

    it('classifies the library as inside', () => {
        expect(pointInRing(3.14, 101.687, EXAMPLE_CAMPUS_RING)).toBe(true);
    });

    it('classifies a point north of campus as outside', () => {
        expect(pointInRing(3.2, 101.7, EXAMPLE_CAMPUS_RING)).toBe(false);
    });

    it('classifies a point south of campus as outside', () => {
        expect(pointInRing(3.1, 101.65, EXAMPLE_CAMPUS_RING)).toBe(false);
    });

    it('returns false for degenerate rings', () => {
        expect(pointInRing(3.139, 101.6869, [])).toBe(false);
        expect(
            pointInRing(3.139, 101.6869, [
                [101.68, 3.13],
                [101.69, 3.14]
            ])
        ).toBe(false);
    });
});

describe('haversineMeters', () => {
    it('is zero for identical points', () => {
        expect(haversineMeters(3.139, 101.6869, 3.139, 101.6869)).toBe(0);
    });

    it('measures ~111km per degree of latitude', () => {
        const d = haversineMeters(3.0, 101.5, 4.0, 101.5);
        expect(d).toBeGreaterThan(110_000);
        expect(d).toBeLessThan(112_000);
    });

    it('measures short campus distances sensibly', () => {
        // Library -> administration building: several hundred meters.
        const d = haversineMeters(3.14, 101.687, 3.1425, 101.6874);
        expect(d).toBeGreaterThan(250);
        expect(d).toBeLessThan(400);
    });
});
