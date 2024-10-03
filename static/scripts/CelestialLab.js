import { spaceScale, planetsData } from './Resources.js';
import { scene, celestialObjects } from './orrery.js';
import { calcOrbitalElements } from './OrbitalMechanics.js';
import * as sb from './SceneBuilder.js';

const toggleLabButton = document.getElementById('lab-toggle-panel');
const labInputPanel = document.getElementById('lab-input-panel');
const labLaunchButton = document.getElementById('labLaunchButton');
const labDrawButton = document.getElementById('labDrawButton');

let myName = document.getElementById('objectName').value;
let myMass = parseFloat(document.getElementById('objectMass').value);

let asteroidCounter = 0;  // Global counter for asteroid numbering
let posArrow, velArrow;
let isDrawn = false;
let isLaunched = false;

let asteroidVisualObjects = [];

export function init(controls) {
    toggleLabButton.addEventListener('mouseenter', () => {
        toggleLabButton.title = "Create your own asteroid!"
    });

    toggleLabButton.addEventListener('click', () => {
        labInputPanel.classList.toggle('open');
        const icon = toggleLabButton.querySelector('.material-icons');
        icon.textContent = labInputPanel.classList.contains('open') ? 'close' : 'add';
    });

    labInputPanel.addEventListener('mouseenter', () => { controls.enabled = false });
    labInputPanel.addEventListener('mouseleave', () => { controls.enabled = true });

    labDrawButton.disabled = true

    labLaunchButton.addEventListener('click', () => {
        toggleLabLaunchRemove();
        if (isLaunched) {
            labDrawButton.disabled = false; // enable labDrawButton
        } else {
            labDrawButton.disabled = true;  // disable labDrawButton
        }
    });

    labDrawButton.addEventListener('click', () => {
        if (!labDrawButton.disabled) {      // if enabled
            toggleLabDrawClear();  
        }
    });

    // Add input event listeners to update vectors in real-time
    document.querySelectorAll('input[type="number"]').forEach(input => {
        //input.addEventListener('input', updateVectors);
    });
}

function toggleLabLaunchRemove() {
    if (!isLaunched) {
        confirmAsteroidParams();
        isDrawn = true;
        console.log('Your artificial asteroid is launched.');
        console.log('Number of celestial objects :', celestialObjects.length);
        labLaunchButton.textContent = "Remove";
        labDrawButton.textContent = 'Erase';
        
    } else {
        asteroidVisualObjects.forEach(obj => {obj.visible = false});
        asteroidVisualObjects = [];
        for (let i = celestialObjects.length - 1; i >= 0; i--) {
            if (celestialObjects[i].subclass === 'artificial') {
                celestialObjects.splice(i, 1);  // Remove the item from the array
            }
        }
        asteroidCounter = 0;
        isDrawn = false;
        console.log('Your artificial asteroid is removed.');
        console.log('Number of celestial objects :', celestialObjects.length);
        labLaunchButton.textContent = 'Launch';
        labDrawButton.textContent = "Draw";
    }
    
    isLaunched = !isLaunched;
}

function toggleLabDrawClear() {
    isDrawn = !isDrawn;
    asteroidVisualObjects.forEach(obj => {obj.visible = isDrawn});
    labDrawButton.textContent = isDrawn ? "Erase" : "Draw";
}

function confirmAsteroidParams() {
    myName = document.getElementById('objectName').value;
    myMass = parseFloat(document.getElementById('objectMass').value);

    const initialPosition = new THREE.Vector3(...['posX', 'posY', 'posZ']
        .map(id => parseFloat(document.getElementById(id).value))); // AU
        
    const initialVelocity = new THREE.Vector3(...['velX', 'velY', 'velZ']
        .map(id => parseFloat(document.getElementById(id).value))); // km/s

    // updateVectors(initialPosition, initialVelocity);

    initialVelocity.multiplyScalar(0.2109); // km/s to AU/yr 

    const massLimit = planetsData[0].mass / 1000;
    if (myMass > massLimit) {
        alert('The mass of the asteroid is too large!');
        return;
    }

    // If name is not provided, generate a custom name with numbering
    // e.g. My Asteroid 001, 002, etc.
    if (!myName) {
        asteroidCounter++;
        myName = `My Asteroid ${asteroidCounter.toString().padStart(3, '0')}`;  
    }

    const orbitalElements = calcOrbitalElements(initialPosition, initialVelocity);

    const asteroidData = {
        name: myName,
        mass: myMass,
        orbitalElements: orbitalElements,
        color: 0xff00ff,
        radius: 0.5,
        category: 'small body',
        subclass: 'artificial'
    };

    const asteroid = new sb.CelestialBody(scene, asteroidData);
    asteroidCounter++;
    console.log(asteroid);

    asteroidVisualObjects.push(asteroid.container);
    asteroidVisualObjects.push(asteroid.label);
    asteroidVisualObjects.push(asteroid.orbit);
    asteroidVisualObjects.push(asteroid.orbitalPlane);
    asteroidVisualObjects.push(...asteroid.orbitalVectors);
    
    celestialObjects.push(asteroid);
}

// Temporarily disabled
function updateVectors(positionVector, velocityVector) {
    const velocityVectorScaled = velocityVector.clone().divideScalar(60);

    if (posArrow) scene.remove(posArrow);
    if (velArrow) scene.remove(velArrow);

    posArrow = sb.createArrow({ 
        dir: positionVector, 
        color: 0x00FFFF,
        visible: true
    }); 

    velArrow = sb.createArrow({
        dir: velocityVectorScaled,
        color: 0xFF00FF,
        origin: positionVector.multiplyScalar(spaceScale),
        visible: true
    });
}
