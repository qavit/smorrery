import { spaceScale, planetsData } from './Resources.js';
import { scene, celestialObjects } from './orrery.js';
import { determinOrbit } from './OrbitalMechanics.js';
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
        toggleAsteroidState();
    });

    labDrawButton.addEventListener('click', () => {
        if (!labDrawButton.disabled) {      // if enabled
            toggleDrawing();  
        }
    });

    // Add input event listeners to update vectors in real-time
    document.querySelectorAll('input[type="number"]').forEach(input => {
        //input.addEventListener('input', updateVectors);
    });
}

function toggleAsteroidState() {
    // Toggle the state of the asteroid, both for launch and draw/erase
    if (!isLaunched) {
        // Launch the asteroid if it hasn't been launched yet
        confirmAsteroidParams();
        isDrawn = true;
        console.log('Your artificial asteroid is launched.');
        labLaunchButton.textContent = "Remove";
        labDrawButton.textContent = "Erase";
        labDrawButton.disabled = false; // Enable drawing functionality
    } else {
        // Remove the asteroid and reset its state
        asteroidVisualObjects.forEach(obj => { obj.visible = false });
        asteroidVisualObjects = [];
        for (let i = celestialObjects.length - 1; i >= 0; i--) {
            if (celestialObjects[i].subclass === 'artificial') {
                celestialObjects.splice(i, 1);  // Remove from celestialObjects array
            }
        }
        asteroidCounter = 0;
        isDrawn = false;
        console.log('Your artificial asteroid is removed.');
        labLaunchButton.textContent = "Launch";
        labDrawButton.textContent = "Draw";
        labDrawButton.disabled = true; // Disable drawing functionality when no asteroid exists
    }
    isLaunched = !isLaunched;  // Toggle launch state
}

// Function to toggle drawing state
function toggleDrawing() {
    if (isLaunched) {
        isDrawn = !isDrawn;  // Toggle draw state
        asteroidVisualObjects.forEach(obj => { obj.visible = isDrawn });
        labDrawButton.textContent = isDrawn ? "Erase" : "Draw";
    }
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

    const orbitalElements = determinOrbit(initialPosition, initialVelocity);

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
