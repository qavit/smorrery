import { spaceScale } from './orrery.js';

const J2000 = 2451545.0;
const radiusScale = 0.5;

function updateMeanAnomaly(T, M, time) {
    const n = 2 * Math.PI / T;    // Mean motion (rad per unit time)
    const newM = M + n * time;    // New Mean anomaly
    return newM % (2 * Math.PI);  // M ∈ [0, 2π)
}

function getTrueAnomaly(e, E) {
    return 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
    );
}

function solveKeplerEquation(e, M) {
    let E = M;  // Initial guess for Eccentric Anomaly (in radians)
    const tolerance = 1e-6;
    let delta = 1;
    
    // Newton-Raphson iteration to solve Kepler's Equation: M = E - e * sin(E)
    while (Math.abs(delta) > tolerance) {
        delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E = E - delta;
    }

    return E; // Eccentric Anomaly (in radians)
}

export function applyOrbitalRotations(rotationMatrix, i, Omega, varpi) {
    // Step 1: Rotate by Ω (Longitude of Ascending Node) around Y axis
    rotationMatrix.makeRotationY(Omega * Math.PI / 180);
    
    // Step 2: Rotate by i (Inclination) around X axis
    const iMatrix = new THREE.Matrix4();
    iMatrix.makeRotationX(i * Math.PI / 180);
    rotationMatrix.multiply(iMatrix);
    
    // Step 3: Rotate by ω (Argument of Perihelion) around Y axis (within the orbital plane)
    const omega =  varpi - Omega;  // Calculate ω from ϖ (Longitude of Perihelion)
    const omegaMatrix = new THREE.Matrix4();
    omegaMatrix.makeRotationY(omega * Math.PI / 180);
    rotationMatrix.multiply(omegaMatrix);
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
    
    // Apply orbital rotations (Ω, i, ϖ)
    const rotationMatrix = new THREE.Matrix4();
    applyOrbitalRotations(rotationMatrix, i, om, varpi);
    
    // Create a position vector and rotate it
    const positionVector = new THREE.Vector3(x, 0, z);
    positionVector.applyMatrix4(rotationMatrix);

    // Update the object's position
    container.position.set(positionVector.x, positionVector.y, positionVector.z);
    container.updateMatrixWorld(true);  // Make sure the changes apply to the scene
    label.position.set(positionVector.x, positionVector.y + radius * radiusScale + 0.5, positionVector.z);

    // Add a segment to the trace
    trace.push(new THREE.Vector3(positionVector.x, positionVector.y, positionVector.z));
}