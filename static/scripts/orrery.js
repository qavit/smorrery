import { spaceScale, SSS_TEXTURES, sunData, planetsData } from './Resources.js';
import { updateObjectPosition } from './OrbitalMechanics.js';
import { extractNameOrNumber } from './Tools.js';
import * as sb from './SceneBuilder.js';
import * as cl from './CelestialLab.js';

// ----------------------------------
// GLOBAL VARIABLES & CONSTANTS
// ----------------------------------

// Constants about Date and Time
const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2100, 11, 31);
const currentDate = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)); // Initila date: J2000.0

// Variables for Celestial Objects
let smallBodiesData = [];
export let celestialObjects = [];

// Variables/Constants for Scene Elements
export let scene;
let camera, renderer, labelRenderer, controls;
let backgroundSphere, axesArrows, eclipticPlane;
const TEXTURES = SSS_TEXTURES;

// Variables/Constants for UI & Time Controls
let isPlaying = true;
let timeScale = 1;          // Animation speed; 0.01~100
let timeDirection = 1;      // Forward or backward; -1 or 1
let showLabels = false;     // will be replaced by labelVisibility

// Label Selector for Future Update
const labelVisibility = {
    'Sun': true,
    'planets': true,
    'drawPlanets': true,
    'NEOs': false,
    'otherAsteroids': false,
    'otherComets': false
};

// Variables/Constants for Hover Detection 
const raycaster = new THREE.Raycaster();    // Raycaster for detecting intersections
const mouse = new THREE.Vector2();          // Stores mouse position
let lastMousePosition = { x: null, y: null };
let lastHoveredObject = null;

// Constants for Batch Position Updates
const frustum = new THREE.Frustum();
const cameraViewProjectionMatrix = new THREE.Matrix4();


// ------------------------
// INITIALIZATION FUNCTION
// ------------------------

async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 20, 50);

    // Setup WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Setup Label Renderer
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    document.body.appendChild(labelRenderer.domElement);

    // Setup Orbit Controls
    controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = spaceScale * 0.1;
    controls.maxDistance = spaceScale * 40;

    // Fetch Small Body Data
    await fetchSmallBodyData();

    // Setup Scene Elements
    backgroundSphere = sb.createBackground(scene, 1200, TEXTURES['MILKY_WAY']);
    axesArrows = sb.addAxesArrows(scene);
    eclipticPlane = sb.addEclipticPlane(scene);
    sb.createLight(scene, 'sun', { intensity: 1, range: 1000 });
    sb.createLight(scene, 'ambient', { intensity: 0.05 });

    // Create Celestial Objects
    const sun = new sb.CelestialBody(scene, sunData, TEXTURES);
    celestialObjects.push(sun);

    [...planetsData, ...smallBodiesData].forEach(data => {
        const celestialBody = new sb.CelestialBody(scene, data, TEXTURES);
        celestialObjects.push(celestialBody);
    });

    console.log(`Created ${celestialObjects.length} celestial objects.`);
    console.log(celestialObjects);

    // Setup UI & Time Controls
    cl.init(controls);
    setupUIControls(celestialObjects);
    setupTimeControls();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('click', onMouseClick, false);
    window.addEventListener('mousemove', onMouseMove, false);

    // Start Animation
    animate(); 

    // Time Control Interactions
    const timeControl = document.getElementById('timeControl');
    timeControl.addEventListener('mouseenter', () => { controls.enabled = false });
    timeControl.addEventListener('mouseleave', () => { controls.enabled = true });
}

// --------------------------------------------
// DATA IMPORTING & MANIPULATION FUNCTIONS
// --------------------------------------------

/**
 * Fetch small body data from the API endpoint and transform it into a usable structure.
 * The function fetches orbital data for small bodies, validates the numerical values,
 * and returns the data in a format consistent with `planetsData`.
 * 
 * @returns {Promise<void>} - The function does not return a value but updates the global `smallBodiesData` array.
 */
async function fetchSmallBodyData() {
    try {
        const response = await fetch('/api/sbdb_query');
        const data = await response.json();

        // Check if the response data has the expected structure
        if (data && data.data) {
            smallBodiesData = data.data.map(body => {
                // Fields: full_name, epoch, e, a, q, i, om, w, ma
                // Extract the name or identifier (first element) as a string
                const fullName = body[0];
                const extractedName = extractNameOrNumber(fullName);
            
                // Parse the remaining orbital parameters as floats
                const [ epoch, e, a, q, i, om, w, ma ] = body.slice(1).map(parseFloat);
            
                // Validate parsed orbital data and check for NaN values
                if ([epoch, e, a, q, i, om, w, ma ].some(isNaN)) {
                    console.warn(`Invalid data for object: ${fullName}`);
                    return null; // Return null if any orbital parameter is invalid
                }
            
                // Return valid celestial body data
                return {
                    name: extractedName,
                    orbitalElements: {
                        a: a,        // Semi-major axis (a), in AU
                        e: e,        // Eccentricity (e)
                        i: i,        // Inclination (i), in degrees
                        om: om,      // Ascending Node (Ω), in degrees
                        w: w,        // Perihelion (ϖ), in degrees
                        ma: ma,      // Mean Anomaly (M), in degrees
                        epoch        // Epoch, in Julian Date, e.g., 2460600.5
                    },
                    color: 0xffff00, // Custom color for small bodies
                    opacity: 0.3,    // Transparency level
                    radius: 0.2,     // Custom radius
                    category: 'small body',
                    subclass: 'NEO'  // Subclass for Near-Earth Objects (NEO)
                };
            }).filter(Boolean);      // Filter out any null entries

            console.log(`Fetched and validated ${smallBodiesData.length} small bodies.`);
            console.log(smallBodiesData);
        } else {
            console.error('Unexpected API response structure');
        }
    } catch (error) {
        console.error('Error fetching sbdb_data:', error);
    }
}

// -----------------------------
// EVENT HANDLING FUNCTIONS
// -----------------------------

/**
 * Detects which celestial object, if any, is being hovered over by the mouse.
 * This function calculates the mouse position, performs a raycasting operation to detect intersections
 * with celestial objects, and checks if the user is hovering over any object or its label. The function
 * optimizes performance by avoiding redundant collision detection when the mouse position has not changed.
 * 
 * @param {MouseEvent} event - The mouse event triggered by mouse movement.
 * @returns {Object|null} - The celestial object being hovered over, or `null` if none is detected.
 * 
 * Optimizations:
 * - Collision detection is skipped if the mouse has not moved.
 * - The result of the last hovered object is cached and returned if the mouse position is unchanged.
 */
function getHoveredObject(event) {
    // Calculate mouse position (Normalized Device Coordinates)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Check if the mouse has actually moved
    if (mouse.x === lastMousePosition.x && mouse.y === lastMousePosition.y) {
        // If mouse hasn't moved, return the last hovered object (if any)
        return lastHoveredObject;
    }

    // Update the last mouse position
    lastMousePosition = { x: mouse.x, y: mouse.y };

    // Cast a ray from the mouse position to the celestial objects and labels
    raycaster.setFromCamera(mouse, camera);
    
    // Collect all celestial objects' mesh elements
    const meshes = celestialObjects.map(obj => obj.container ? obj.container.children[0] : null).filter(Boolean);
    const intersects = raycaster.intersectObjects(meshes, true);

    // Check if any celestial object is being hovered over
    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;  // First intersected celestial object
        const intersectedContainer = intersectedObject.parent;  // Get the container of the intersected object
        const hoveredObj = celestialObjects.find(obj => obj.container === intersectedContainer);  // Find the corresponding celestial object
        
        // Check if the mouse is hovering over a label associated with the object
        if (hoveredObj && hoveredObj.label && hoveredObj.label.visible) {
            const labelBounds = hoveredObj.label.element.getBoundingClientRect();  // Get the bounding box of the label

            if (event.clientX >= labelBounds.left && event.clientX <= labelBounds.right &&
                event.clientY >= labelBounds.top && event.clientY <= labelBounds.bottom) {
                lastHoveredObject = hoveredObj;  // Update last hovered object
                return hoveredObj;  // Return the object if the mouse is over its label
            }
        }

        lastHoveredObject = hoveredObj;  // Update last hovered object
        return hoveredObj;  // Return the celestial object
    }

    // Reset last hovered object if no object or label is hovered
    lastHoveredObject = null;
    return null;
}

function onMouseMove(event) {
    // Reset emissive effect and hide labels for all celestial objects
    celestialObjects.forEach(obj => {
        if (obj.container && obj.container.children[0].material.emissive) {
            const originalEmissiveEffect = obj.name !== 'Sun' ? 0x000000 : 0xffff00;  // Use yellow for the Sun, no emissive for others
            obj.container.children[0].material.emissive.set(originalEmissiveEffect);  // Reset the original emissive effect
        }
        if (!showLabels && obj.label) {
            obj.label.visible = false;  // Hide all labels if they should not be shown
        }
    });

    // Get the currently hovered object, if any
    const hoveredObject = getHoveredObject(event);
    if (hoveredObject) {
        // Apply emissive effect to the hovered object
        const mesh = hoveredObject.container.children[0];
        if (mesh.material.emissive) {
            mesh.material.emissive.set(0x00ff00);  // Highlight the hovered object with green emissive effect
        }
        // Show the label of the hovered object if labels are hidden by default
        if (!showLabels && hoveredObject.label) {
            hoveredObject.label.visible = true;  // Make the label visible for the hovered object
        }
    }
}

function onMouseClick(event) {
    const selectedObject = getHoveredObject(event);
    if (selectedObject) {
        alertObjectInfo(selectedObject); 
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// ------------------------------
// POSITION UPDATE FUNCTIONS
// ------------------------------

/**
 * Update the frustum based on the current camera view.
 * This will be used to check if celestial objects are within the camera's view.
 * 
 * @param {THREE.Camera} camera - The camera used for rendering the scene.
 */
function updateFrustum(camera) {
    camera.updateMatrixWorld(); // Ensure the camera matrices are up to date
    cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);  // Set frustum from camera's view projection matrix
}

/**
 * Check if a celestial object is within the camera's frustum (view).
 * 
 * @param {THREE.Object3D} object - The 3D object representing the celestial body.
 * @returns {boolean} - True if the object is within the camera's view, false otherwise.
 */
function isInView(object) {
    const boundingBox = new THREE.Box3().setFromObject(object);  // Get the object's bounding box
    return frustum.intersectsBox(boundingBox);  // Check if the bounding box intersects with the frustum
}

/**
 * Update the positions of all celestial objects, but only if they are within the camera's view.
 * This optimizes the performance by avoiding unnecessary updates for off-screen objects.
 * 
 * @param {THREE.Camera} camera - The camera used for rendering the scene.
 */
function updatePositions(camera) {
    const currentJulianDate = calculateJulianDate(currentDate);
    
    // Update frustum to reflect the current camera view
    updateFrustum(camera);

    celestialObjects.forEach(object => {
        // Skip position updates for the Sun
        if (object.name === 'Sun') return;

        // Only update positions if the object is within the camera's view
        if (isInView(object.container)) {
            updateObjectPosition(object, currentJulianDate);
        }
    });
}

// -------------------------
// UI CONTROL FUNCTION 
// -------------------------

function setupUIControls(celestialObjects) {
    const showOrbitsCheckbox = document.getElementById('showOrbits');
    const showLabelsCheckbox = document.getElementById('showLabels');
    const showAxesCheckbox = document.getElementById('showAxes');
    const showEclipticCheckbox = document.getElementById('showEcliptic');
    const showSweptAreaCheckbox = document.getElementById('showSweptArea');

    // Toggle visibility of orbits
    showOrbitsCheckbox.addEventListener('change', (event) => {
        celestialObjects.forEach(object => {
            if (object.orbit) { object.orbit.visible = event.target.checked }
        });
    });

    // Toggle visibility of labels
    showLabelsCheckbox.addEventListener('change', (event) => {
        showLabels = event.target.checked;
        celestialObjects.forEach(object => {
            if (object.label) { object.label.visible = event.target.checked }
        });
    });

    // Toggle visibility of axes
    showAxesCheckbox.addEventListener('change', (event) => {
        axesArrows.forEach(axis => axis.visible = event.target.checked);
    });  

    // Toggle visibility of ecliptic plane
    showEclipticCheckbox.addEventListener('change', (event) => {
        eclipticPlane.visible = event.target.checked; 
    });

    // Toggle visibility of swept areas
    showSweptAreaCheckbox.addEventListener('change', (event) => {
        celestialObjects.forEach(obj => {
            if(obj.sweptAreaGroup) {
                obj.sweptAreaGroup.visible = event.target.checked;
            }
        });
    });

}

// ---------------------------
// TIME CONTROL FUNCTIONS  
// ---------------------------

function setupTimeControls() {
    const playPauseButton = document.getElementById('playPause');
    const goToJ2000Button = document.getElementById('goToJ2000');
    const goToTodayButton = document.getElementById('goToToday');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const setSpeedOneButton = document.getElementById('setSpeedOne');
    const reverseButton = document.getElementById('reverse');

    // Toggle play/pause state and update the button
    function togglePlayPause() {
        isPlaying = !isPlaying;
        updateButton(playPauseButton, isPlaying, "Pause", "Play", '<i class="fas fa-pause"></i>', '<i class="fas fa-play"></i>');
    }

    // Toggle reverse and update time acceleration
    function toggleReverse() {
        timeDirection *= -1;
        reverseButton.classList.toggle('reversed');
        updateSpeedDisplay();
        updateButton(reverseButton, timeDirection == 1, "Play backward", "Play forward");
    }

    // Handle general button events
    function handleButtonHover(button, title) {
        button.addEventListener('mouseenter', () => button.title = title);
    }

    // Setup controls
    playPauseButton.addEventListener('click', togglePlayPause);

    reverseButton.addEventListener('click', toggleReverse);

    goToJ2000Button.addEventListener('click', () => {
        currentDate.setTime(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
        console.log(currentDate);
        updateDateDisplay();
        updatePositions(camera);
    });

    goToTodayButton.addEventListener('click', () => {
        currentDate.setTime(new Date());
        console.log(currentDate);
        updateDateDisplay();
        updatePositions(camera);
    });

    speedSlider.addEventListener('input', () => {
        const sliderValue = parseFloat(speedSlider.value);
        timeScale = Math.pow(10, sliderValue);
        updateSpeedDisplay();
    });

    setSpeedOneButton.addEventListener('click', () => {
        timeScale = 1;
        speedSlider.value = 0; 
        updateSpeedDisplay();
    });

    // Set hover titles
    handleButtonHover(playPauseButton, isPlaying ? "Pause" : "Play");
    handleButtonHover(reverseButton, timeDirection ? "Play backward" : "Play forward");
    handleButtonHover(goToJ2000Button, "Go to J2000");
    handleButtonHover(goToTodayButton, "Go to today");
    handleButtonHover(setSpeedOneButton, "Set speed to 1.00x");

    // Update speed display
    function updateSpeedDisplay() {
        speedValue.textContent = timeScale.toFixed(2) + 'x';
    }
    
    updateDateDisplay();
}

function updateButton(button, condition, titleTrue, titleFalse, iconTrue, iconFalse) {
    button.title = condition ? titleTrue : titleFalse;
    if (iconTrue && iconFalse) {
        button.innerHTML = condition ? iconTrue : iconFalse;
    }
}

function updateDateDisplay() {
    const formattedDate = currentDate.toISOString().split('T')[0];
    const currentJulianDate = calculateJulianDate(currentDate).toFixed(2);

    document.getElementById('currentDateDisplay').textContent = formattedDate;
    document.getElementById('julianDateDisplay').textContent = `JD: ${currentJulianDate}`;
}

function calculateJulianDate(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

// --------------------------
// FUNCTION(S) FOR SCAFFOLDING
// --------------------------

function alertObjectInfo(object) {
    const additionalInfo = (object.name.toUpperCase() === 'SUN') ? '' : `
   Semi-major axis = ${object.orbitalElements.a.toFixed(2)} AU
   Perihelion = ${object.orbitalElements.q.toFixed(2)} AU
   Eccentricity = ${object.orbitalElements.e.toFixed(2)}
   Period = ${object.period.toFixed(2)} yr`;
    alert(`This is ${object.name}!` + additionalInfo);
}

// --------------------------------
// ANIMATION CONTROL FUNCTIONS 
// --------------------------------

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        const oneFrameInMilliseconds = timeScale * 24 * 60 * 60 * 1000;
    
        if (timeDirection > 0) {
            currentDate.setTime(currentDate.getTime() + oneFrameInMilliseconds);  
        } else {
            currentDate.setTime(currentDate.getTime() - oneFrameInMilliseconds);  
        }
    
        if (currentDate < MIN_DATE) {
            currentDate = new Date(MAX_DATE);
        } else if (currentDate > MAX_DATE) {
            currentDate = new Date(MIN_DATE);
        }
    
        updateDateDisplay();
        updatePositions(camera);
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

init();
