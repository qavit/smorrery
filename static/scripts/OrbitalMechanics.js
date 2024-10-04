/**
 * OrbitalMechanics.js
 * 
 * This module provides a set of functions for calculating and updating the orbital mechanics 
 * of celestial bodies, including their positions, velocities, and orbital elements such as 
 * semi-major axis, eccentricity, inclination, and more. It includes both numerical methods 
 * for solving orbital anomalies and functions for rotating and positioning objects in 3D space 
 * using the Three.js library.
 * 
 * Key Features:
 * - **Kepler's Equation**: Solving Kepler's equation using the Newton-Raphson method to calculate the eccentric anomaly.
 * - **Orbital Elements**: Calculation of semi-major axis, eccentricity, inclination, and other key orbital parameters.
 * - **Orbital Transformations**: Providing 3D transformation matrices for orbital coordinate systems to 3D space.
 * - **Mean and True Anomaly**: Computing the mean anomaly over time and the true anomaly from the eccentric anomaly.
 * - **Object Position Updates**: Updating celestial body positions based on their orbital elements and Julian dates.
 * 
 * Dependencies:
 * - This module relies on Three.js for 3D vector and matrix operations, and requires external constants and tools 
 *   provided by other modules (such as `Resources.js` and `Tools.js`).
 * 
 * Usage:
 * - This module is designed for simulations involving orbital dynamics, where precise calculations of object positions 
 *   and orbital elements are necessary, particularly in 3D visualization frameworks like Three.js.
 */

import { J2000, mu, spaceScale } from './Resources.js';
import { printQuantity } from './Tools.js';
import { createSweptArea } from './Education.js';

let previousSweptAreaPhase = null 
const phaseNumber = 8; // how many phases in one cycle

/**
 * Update the mean anomaly over time based on the mean motion and the given period.
 * 
 * @param {number} T - Orbital period (in the same units as time).
 * @param {number} M - Initial mean anomaly (in radians).
 * @param {number} time - Elapsed time since the initial mean anomaly (in the same units as T).
 * @returns {number} - Updated mean anomaly, constrained to the range [0, 2π).
 * @see https://en.wikipedia.org/wiki/Mean_anomaly
 * @see https://en.wikipedia.org/wiki/Mean_motion
 */
function updateMeanAnomaly(T, M, time) {
    const n = 2 * Math.PI / T;  // Mean motion (rad per unit time)
    const newM = M + n * time;  // Updated mean anomaly
    return newM % (2 * Math.PI);  // Ensure M is within [0, 2π)
}

/**
 * Calculate the true anomaly from the eccentricity and eccentric anomaly.
 * The true anomaly represents the angle between the direction of periapsis and the current position of the body on its orbit.
 * 
 * @param {number} e - Eccentricity of the orbit (must be in the range [0, 1]).
 * @param {number} E - Eccentric anomaly (in radians).
 * @returns {number} - True anomaly (in radians).
 * @see https://duncaneddy.github.io/rastro/user_guide/orbits/anomalies/
 * @see https://en.wikipedia.org/wiki/True_anomaly
 */
function calcTrueAnomaly(e, E) {
    return 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
    );
}

/**
 * Solve Kepler's equation using the Newton-Raphson method.
 * Kepler's equation is: M = E - e * sin(E), where M is the mean anomaly and E is the eccentric anomaly.
 * 
 * @param {number} e - Eccentricity of the orbit (must be in the range [0, 1]).
 * @param {number} M - Mean anomaly (in radians).
 * @returns {number} - Eccentric anomaly (in radians).
 * @see https://en.wikipedia.org/wiki/Kepler%27s_equation
 * @see https://en.wikipedia.org/wiki/Newton%27s_method
 */
function solveKeplerEquation(e, M) {
    let E = M;  // Initial guess for eccentric anomaly
    const tolerance = 1e-6;
    let delta;

    // Newton-Raphson iteration
    do {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= delta;
    } while (Math.abs(delta) > tolerance);

    return E;  // Return the computed eccentric anomaly
}

/**
 * Get the orbital rotation matrix for transforming orbital coordinates to 3D space.
 * This matrix applies a series of rotations based on the inclination (i), 
 * longitude of ascending node (Ω), and argument of perihelion (ω).
 * 
 * @param {number} i - Inclination (in degrees).
 * @param {number} Omega - Longitude of the ascending node (in degrees).
 * @param {number} w - Longitude of perihelion (in degrees).
 * @returns {THREE.Matrix4} - A 4✕4 rotation matrix that applies the orbital transformations.
 */
function getOrbitalRotationMatrix(i, Omega, w) {
    const rotationMatrix = new THREE.Matrix4();

    // Rotate by Ω (Longitude of Ascending Node) around the Y axis
    rotationMatrix.makeRotationY(Omega * Math.PI / 180);

    // Rotate by i (Inclination) around the X axis
    const iMatrix = new THREE.Matrix4();
    iMatrix.makeRotationX(i * Math.PI / 180);
    rotationMatrix.multiply(iMatrix);

    // Rotate by ω (Argument of Perihelion) around the Y axis
    const omega = w - Omega;  // Argument of perihelion
    const omegaMatrix = new THREE.Matrix4();
    omegaMatrix.makeRotationY(omega * Math.PI / 180);
    rotationMatrix.multiply(omegaMatrix);

    return rotationMatrix;
}

/**
 * Apply an orbital rotation to the orbit container.
 * This function transforms the orbit container based on the inclination (i), 
 * longitude of ascending node (Ω), and argument of perihelion (ω).
 * 
 * @param {THREE.Object3D} orbitContainer - The container representing the orbit.
 * @param {number} i - Inclination (in degrees).
 * @param {number} Omega - Longitude of the ascending node (in degrees).
 * @param {number} w - Longitude of perihelion (in degrees).
 */
export function rotateOrbit(orbitContainer, i, Omega, w) {
    const rotationMatrix = getOrbitalRotationMatrix(i, Omega, w);
    orbitContainer.applyMatrix4(rotationMatrix);
}

/**
 * Update the position of the celestial object based on its orbital elements.
 * This function calculates the position of the object in the 3D scene at the given Julian date.
 * 
 * @param {Object} object - The celestial object whose position will be updated.
 * @param {number} currentJulianDate - The current Julian date to calculate the object's position.
 */
export function updateObjectPosition(object, currentJulianDate) {
    const yearSinceJ2000 = (currentJulianDate - J2000) / 365.25;
    const {radius, period, orbitalElements, container, label} = object;
    const {a, e, i, om, w, ma} = orbitalElements;

    // Calculate Mean Anomaly (M), Eccentric Anomaly (E), True Anomaly (ν)
    const M = updateMeanAnomaly(period, ma, yearSinceJ2000);  
    const E = solveKeplerEquation(e, M);  
    const nu = calcTrueAnomaly(e, E);  

    // Calculate radial distance (r)
    const r = spaceScale * a * (1 - e ** 2) / (1 + e * Math.cos(nu)); 

    // Calculate coordinates in the orbital plane
    const x = r * Math.cos(nu);
    const z = -r * Math.sin(nu);

    // Apply orbital rotations (Ω, i, ϖ) to a position vector
    const rotationMatrix = getOrbitalRotationMatrix(i, om, w);
    const position = new THREE.Vector3(x, 0, z);
    position.applyMatrix4(rotationMatrix);

    // Update the object's position in the 3D scene
    container.position.set(position.x, position.y, position.z);
    container.updateMatrixWorld(true);  // Make sure the changes apply to the scene
    label.position.set(position.x, position.y + radius + 0.5, position.z);

    if (object.name === 'Mercury') {
        // Calculate the swept area phase
        let sweptAreaPhase = Math.floor(phaseNumber * yearSinceJ2000 / period) % phaseNumber;

        // If sweptAreaPhase is 0, clear all swept areas (after a full cycle)
        if (previousSweptAreaPhase === (phaseNumber - 1)  && sweptAreaPhase === 0) {
            object.sweptAreaGroup.clear();
            // console.log('New cycle');
        }
        
        // Create swept area for the current phase
        createSweptArea(object, position, sweptAreaPhase);
        previousSweptAreaPhase = sweptAreaPhase;
    }
}

/**
 * Determine orbital elements based on orbital state vectors (position and velocity.)
 * This function computes the semi-major axis, eccentricity, inclination, and other orbital elements 
 * for a celestial body based on its position and velocity vectors in 3D space.
 * 
 * @param {THREE.Vector3} position - The position vector of the celestial body (in AU).
 * @param {THREE.Vector3} velocity - The velocity vector of the celestial body (in AU/yr).
 * @param {boolean} [verbose=true] - Whether to print detailed results for the orbital elements.
 * @returns {Object} - An object containing the computed orbital elements such as semi-major axis (a), 
 *                     eccentricity (e), inclination (i), and others.
 * @see https://en.wikipedia.org/wiki/Orbit_determination#Orbit_determination_from_a_state_vector
 */
export function determinOrbit(position, velocity, verbose = true) {
    // Compute magnitudes of position and velocity vectors
    const posMag = position.length();
    const velMag = velocity.length();

    // Calculate Specific Mechanical Energy (ε)
    const epsilon = velMag ** 2 / 2 - mu / posMag;

    // Calculate Semi-major Axis (a)
    const a = -mu / (2 * epsilon);

    // Calculate Specific Angular Momentum Vector (h_vec)
    const h_vec = new THREE.Vector3().crossVectors(position, velocity);

    // Calculate Eccentricity Vector (e_vec) and Eccentricity (e)
    const e_vec = velocity.clone()
        .cross(h_vec).divideScalar(mu)  // Compute v x h / µ
        .sub(position.clone().normalize())  // Subtract normalized position
        .multiplyScalar(-1);  // Adjust sign
    const e = e_vec.length();  // Magnitude of the eccentricity vector

    // Calculate Inclination (i)
    const i = Math.acos(h_vec.y / h_vec.length()) * (180 / Math.PI);  // Inclination

    // Calculate Longitude of Ascending Node (Ω)
    let Omega = Math.atan2(h_vec.x, -h_vec.z) * (180 / Math.PI);  // Longitude of Ascending Node (Ω)
    if (Omega < 0) Omega += 360;  // Ensure Ω is in the range [0, 360)

    // Calculate Argument of Perihelion (ω)
    const n_vec = new THREE.Vector3(h_vec.z, 0, -h_vec.x);  // Node vector (n)
    let omega = Math.acos(n_vec.dot(e_vec) / (n_vec.length() * e)) * (180 / Math.PI);  // Argument of perihelion (ω)
    if (e_vec.y < 0) omega = 360 - omega;   // Adjust ω based on e_vec orientation

    // Compute Longitude of Perihelion (w)
    const w = omega + Omega;

    // Verbose output for detailed orbital element values
    if (verbose) {
        printQuantity(posMag, '|r|', 'AU');
        printQuantity(velMag, '|v|', 'AU/yr');
        printQuantity(epsilon, 'ε', 'EarthMass AU^2 yr^(-2)');
        printQuantity(a, 'a', 'AU');
        printQuantity(e, '|e|');
        printQuantity(i, 'i', '°');
        printQuantity(Omega, 'Ω', '°');
        printQuantity(omega, 'ω', '°');
    }

    // Return calculated orbital elements
    return {
        a: a,  // Semi-major axis in AU
        e: e,  // Eccentricity
        i: i,  // Inclination in degrees
        om: Omega,  // Longitude of ascending node in degrees
        w: w,  // Longitude of perihelion in degrees
        ma: 0,  // Mean anomaly (to be calculated later)
        q: a * (1 - e),  // Perihelion distance in AU
        Q: a * (1 + e),  // Apohelion distance in AU
        h_vec: h_vec,  // Specific angular momentum vector
        e_vec: e_vec,  // Eccentricity vector
        n_vec: n_vec  // Node vector
    };
}
