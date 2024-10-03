import { sunData, spaceScale } from './Resources.js';
import { printQuantity } from './Tools.js';

const J2000 = 2451545.0;

const G = 39.478 // AU^3 yr^-2 EarthMass^-1
const sunMass = sunData.mass;  // Solar mass in Earth masses
const mu = 39.421 //G * sunMass; // Standard gravitational parameter

function updateMeanAnomaly(T, M, time) {
    const n = 2 * Math.PI / T;    // Mean motion (rad per unit time)
    const newM = M + n * time;    // New mean anomaly
    return newM % (2 * Math.PI);  // M ∈ [0, 2π)
}

function getTrueAnomaly(e, E) {
    return 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
    );
}

function solveKeplerEquation(e, M) {
    let E = M;  // Initial guess for eccentric anomaly (in radians)
    const tolerance = 1e-6;
    let delta = 1;
    
    // Newton-Raphson iteration to solve Kepler's equation: M = E - e * sin(E)
    while (Math.abs(delta) > tolerance) {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E = E - delta;
    }

    return E; // Eccentric Anomaly (in radians)
}

function getOrbitalRotationMatrix(i, Omega, varpi) {
    const rotationMatrix = new THREE.Matrix4();

    // Rotate by Ω (Longitude of Ascending Node) around Y axis
    rotationMatrix.makeRotationY(Omega * Math.PI / 180);

    // Rotate by i (Inclination) around X axis
    const iMatrix = new THREE.Matrix4();
    iMatrix.makeRotationX(i * Math.PI / 180);
    rotationMatrix.multiply(iMatrix);

    // Rotate by ω (Argument of Perihelion) around Y axis (within the orbital plane)
    const omega = varpi - Omega;  // Calculate ω from ϖ (Longitude of Perihelion)
    const omegaMatrix = new THREE.Matrix4();
    omegaMatrix.makeRotationY(omega * Math.PI / 180);
    rotationMatrix.multiply(omegaMatrix);

    return rotationMatrix;
}

export function rotateOrbit(orbitContainer, i, Omega, varpi) {
    const rotationMatrix = getOrbitalRotationMatrix(i, Omega, varpi);
    orbitContainer.applyMatrix4(rotationMatrix);
}

export function updateObjectPosition(object, currentJulianDate) {
    const yearSinceJ2000 = (currentJulianDate - J2000) / 365.25;
    const {radius, period, orbitalElements, container, label, trace} = object;
    const {a, e, i, om, varpi, ma} = orbitalElements;

    // Calculate Mean Anomaly (M), Eccentric Anomaly (E), True Anomaly (ν)
    const M = updateMeanAnomaly(period, ma, yearSinceJ2000);  
    const E = solveKeplerEquation(e, M);  
    const nu = getTrueAnomaly(e, E);  

    // Calculate radial distance (r)
    const r = spaceScale * a * (1 - e ** 2) / (1 + e * Math.cos(nu)); 

    // Calculate coordinates in the orbital plane
    const x = r * Math.cos(nu);
    const z = -r * Math.sin(nu);

    // Apply orbital rotations (Ω, i, ϖ) to a position vector
    const rotationMatrix = getOrbitalRotationMatrix(i, om, varpi);
    const position = new THREE.Vector3(x, 0, z);
    position.applyMatrix4(rotationMatrix);

    // Update the object's position
    container.position.set(position.x, position.y, position.z);
    container.updateMatrixWorld(true);  // Make sure the changes apply to the scene
    label.position.set(position.x, position.y + radius + 0.5, position.z);

    // Add a segment to the trace
    trace.push(new THREE.Vector3(position.x, position.y, position.z));
}

export function calcOrbitalElements(position, velocity, verbose = true) {
    // Calculate Specific Mechanical Energy (ε)
    const posMag = position.length();
    const velMag = velocity.length();
    const epsilon = velMag**2 / 2 - mu / posMag;

    // Calculate Semi-major Axis (a)
    const a = -mu / (2 * epsilon);

    // Calculate Specific Angular Momentum Vector (h)
    const h_vec = new THREE.Vector3().crossVectors(position, velocity);
    
    // Calculate Eccentricity Vector (e_vec) and Eccentricity (e)
    const vCrossHByMu = velocity.clone().cross(h_vec).divideScalar(mu)
    const e_vec = vCrossHByMu.sub(position.clone().normalize()).multiplyScalar(-1);
    const e = e_vec.length();

    // Calculate Inclination (i)
    const i = Math.acos(h_vec.y / h_vec.length()) * (180 / Math.PI);

    // Calculate Longitude of Ascending Node (Ω)
    let Omega = Math.atan2(h_vec.x, -h_vec.z) * (180 / Math.PI);
    if (Omega < 0) Omega += 360;

    // Calculate Argument of Perihelion (ω)
    const n_vec = new THREE.Vector3(h_vec.z, 0, -h_vec.x);  // Node vector
    const omega = Math.acos(n_vec.dot(e_vec) / (n_vec.length() * e)) * (180 / Math.PI);
    const varpi = omega + Omega

    if (verbose) {
        printQuantity(G, 'G', 'AU^3 yr^(-2) EarthMass^(-1)');
        printQuantity(sunMass, 'M', 'EarthMass');
        printQuantity(mu, 'µ', 'AU^3 yr^(-2)');
        // printQuantity(position, 'r', 'AU');
        printQuantity(posMag, '|r|', 'AU');
        // printQuantity(velocity, 'v', 'AU/yr');
        printQuantity(velMag, '|v|', 'AU/yr');
        printQuantity(epsilon, 'ε', 'EarthMass AU^2 yr^(-2)');
        printQuantity(a, 'a', 'AU');
        // printQuantity(h_vec, 'h');
        // printQuantity(e_vec, 'e');
        printQuantity(e, '|e|');
        printQuantity(i, 'i', '°');
        printQuantity(Omega, 'Ω', '°');
        printQuantity(omega, 'ω', '°');
    }

    return {
        a: a,
        e: e,
        i: i,
        om: Omega,
        varpi: varpi, 
        ma: 0, // to be calculated later
        q: a * (1 - e),
        Q: a * (1 + e),
        h_vec: h_vec,
        e_vec: e_vec, 
        n_vec: n_vec
    };
}


