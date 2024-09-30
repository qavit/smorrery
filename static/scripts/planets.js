const J2000 = 2451545.0;

// https://ssd.jpl.nasa.gov/planets/approx_pos.html

const planets = [
    {
        name: 'Mercury',
        a: 0.38709927,          // Semi-major Axis (a), AU
        e: 0.20563593,          // Eccentricity (e)
        i: 7.00497902,          // Inclination (i), deg
        om: 48.33076593,        // Longitude of Ascending Node (Ω), deg
        varpi: 77.45779628,     // Longitude of Perihelion (ϖ), deg
        ma: 174.796,            // Mean Anomaly (M), deg
        epoch: J2000,
        color: 0xD3D3D3, //LightGray
        radius: 0.383,           // Radius (R), of Earth radius
        category: 'planet'
    },
    {
        name: 'Venus',
        a: 0.72333566,
        e: 0.00677672,
        i: 3.39467605,
        om: 76.67984255,
        varpi: 131.60246718,
        ma: 50.115,
        epoch: J2000,
        color: 0xFFFFE0, // LightYellow
        radius: 0.949,
        category: 'planet'
    },
    {
        name: 'Earth',
        a: 1.00000261,
        e: 0.01671123,
        i: -0.00001531,
        om: 0.0,
        varpi: 102.93768193,
        ma: 100.464,
        epoch: J2000,
        color: 0x00BFFF, // DeepSkyBlue
        radius: 1,
        category: 'planet'
    },
    {
        name: 'Mars',
        a: 1.52371034,
        e: 0.09339410,
        i: 1.84969142,
        om: 49.55953891,
        varpi: -23.94362959,
        ma: 355.453,
        epoch: J2000,
        color: 0xCD5C5C, // IndianRed
        radius: 0.532,
        category: 'planet'
    },
    {
        name: 'Jupiter',
        a: 5.20288700,
        e: 0.04838624,
        i: 1.30439695,
        om: 100.47390909,
        varpi: 14.72847983,
        ma: 19.650,
        epoch: J2000,
        color: 0xCD853F, // Peru
        radius: 11.21,
        category: 'planet'
    },
    {
        name: 'Saturn',
        a: 9.53667594,
        e: 0.05386179,
        i: 2.48599187,
        om: 113.66242448,
        varpi: 92.59887831,
        ma: 317.020,
        epoch: J2000,
        color: 0xF0E68C, // Khaki
        radius: 9.45,
        category: 'planet'
    },
    {
        name: 'Uranus',
        a: 19.18916464,
        e: 0.04725744,
        i: 0.77263783,
        om: 74.01692503,
        varpi: 170.95427630,
        ma: 142.238,
        epoch: J2000,
        color: 0xE0FFFF, // LightCyan
        radius: 4.01,
        category: 'planet'
    },
    {
        name: 'Neptune',
        a: 30.06992276,
        e: 0.00859048,
        i: 1.77004347,
        om: 131.78422574,
        varpi: 44.96476227,
        ma: 256.228,
        epoch: J2000,
        color: 0x4169E1, // RoyalBlue
        radius: 3.88,
        category: 'planet'
    }
];

