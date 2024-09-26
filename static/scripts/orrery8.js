let scene, camera, renderer, labelRenderer, controls;
let xArrow, yArrow, zArrow, eclipticPlane; 
let sun, sunLabel;
let planetOrbits = [];
let planetLabels = [];
let isPlaying = true;
let timeScale = 1;
let timeDirection = 1;
let stopWatch = 0;
let spaceScale = 20;

const J2000_DATE = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)); // 2000-01-01 12:00 UTC
const maxTimeAcceleration = 2;
const textureLoader = new THREE.TextureLoader();
const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2100, 11, 31);

let currentDate = J2000_DATE; 

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function calculateJulianDate(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

function updateDateDisplay() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);
    document.getElementById('julianDate').textContent = `JD: ${calculateJulianDate(currentDate).toFixed(2)}`;
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.x = 0;
    camera.position.y = 20;
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    document.body.appendChild(labelRenderer.domElement);

    controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = spaceScale;
    controls.maxDistance = spaceScale * 40;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    addAxesArrows(); // initially invisible
    addEclipticPlane(); // initially invisible
    createCelestialBodies();
    addSunLight();
    addAmbientLight();
    setupControls();
    setupTimeControls();

    animate(); 

    window.addEventListener('resize', onWindowResize, false);

    const timeControl = document.getElementById('timeControl');
        timeControl.addEventListener('mouseenter', () => {
        controls.enabled = false;
    });
    timeControl.addEventListener('mouseleave', () => {
        controls.enabled = true;
    });
}


function addAxesArrows() {
    const arrowLength = spaceScale;
    const arrowHeadLength = 4;
    const arrowHeadWidth = 2;

    const origin = new THREE.Vector3(0, 0, 0);

    xArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, arrowLength, 0xff0000, arrowHeadLength, arrowHeadWidth);
    yArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, arrowLength, 0x00ff00, arrowHeadLength, arrowHeadWidth);
    zArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, arrowLength, 0x0000ff, arrowHeadLength, arrowHeadWidth);

    // Set initial visibility to false
    xArrow.visible = false;
    yArrow.visible = false;
    zArrow.visible = false;

    scene.add(xArrow);
    scene.add(yArrow);
    scene.add(zArrow);
}

function toggleAxes(show) {
    if (xArrow && yArrow && zArrow) {
        xArrow.visible = show;
        yArrow.visible = show;
        zArrow.visible = show;
    }
}

function addEclipticPlane() {
    const planeGeometry = new THREE.PlaneGeometry(1200, 1200); 
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.1 
    });

    eclipticPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    eclipticPlane.rotation.x = Math.PI / 2;

    eclipticPlane.visible = false;
    scene.add(eclipticPlane);
}

function toggleEclipticPlane(show) {
    if (eclipticPlane) {
        eclipticPlane.visible = show;
    }
}

function createCelestialBodies() {
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
    sunLabel = addLabel(sun, "Sun");
    sunLabel.visible = false;

    planets.forEach(planet => {
        const planetMesh = createPlanet(
            planet.name, 
            planet.radius * 0.5,          // Radius
            planet.a * spaceScale,  // Semi-major Axis (a); scaled
            planet.e,               // Eccentricity (e)
            planet.i,               // Inclination (i)
            planet.om,              // Longitude of Ascending Node (Ω)
            planet.varpi,           // Longitude of Perihelion (ϖ)
            planet.ma,              // Mean Anomaly (M)
            planet.color);
        planet.mesh = planetMesh;
        planet.path = [];
        planet.T = Math.sqrt(planet.a ** 3);  // Orbital period; using Kepler's 3rd Law
    });
}

function applyOrbitalRotations(rotationMatrix, i, Omega, varpi, activated=true) {
    // Step 1: Rotate by Ω (Longitude of Ascending Node) around Y axis
    rotationMatrix.makeRotationY(Omega * Math.PI / 180 * activated);
    
    // Step 2: Rotate by i (Inclination) around X axis
    const iMatrix = new THREE.Matrix4();
    iMatrix.makeRotationX(i * Math.PI / 180 * activated);
    rotationMatrix.multiply(iMatrix);
    
    // Step 3: Rotate by ω (Argument of Perihelion) around Y axis (within the orbital plane)
    const omega =  varpi - Omega;  // Calculate ω from ϖ (Longitude of Perihelion)
    const omegaMatrix = new THREE.Matrix4();
    omegaMatrix.makeRotationY(omega * Math.PI / 180 * activated);
    rotationMatrix.multiply(omegaMatrix);
}

function createPlanet(name, radius, a, e, i, Omega, varpi, M, color) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,  // Make the planet surface non-reflective
        metalness: 0,   // No metalness for a natural surface
        emissive: 0x000000  // No self-illumination
    });

    const planet = new THREE.Mesh(geometry, material);
    planet.castShadow = false;   
    planet.receiveShadow = true; 

    const planetContainer = new THREE.Object3D();
    planetContainer.add(planet);

    // Set the planet's initial position in the orbital plane (can be origin for now)
    planet.position.set(0, 0, 0);  

    // Apply the initial rotations for Ω, i, ϖ
    const rotationMatrix = new THREE.Matrix4();
    applyOrbitalRotations(rotationMatrix, i, Omega, varpi);
    planetContainer.applyMatrix4(rotationMatrix);
    
    scene.add(planetContainer);
    createOrbitLine(a, e, i, Omega, varpi, color);
    
    const label = addLabel(planet, name);
    label.visible = false;
    planetLabels.push(label);

    return planetContainer;
}

function createOrbitLine(a, e, i, Omega, varpi, color) {
    const b = a * Math.sqrt(1 - e ** 2);  // Calculate semi-minor axis
    const curve = new THREE.EllipseCurve(
        0, 0,           // ax, aY 
        a, b,           // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false,          // aClockwise
        0               // aRotation
    );

    const points = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, 0, p.y))
    );
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
    const orbit = new THREE.Line(geometry, material);
    
    const orbitContainer = new THREE.Object3D();
    orbitContainer.add(orbit);
    
    const rotationMatrix = new THREE.Matrix4();
    applyOrbitalRotations(rotationMatrix, i, Omega, varpi);
    orbitContainer.applyMatrix4(rotationMatrix);
    
    orbitContainer.visible = false;
    scene.add(orbitContainer);
    planetOrbits.push(orbitContainer);
}

function addLabel(object, name) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.textContent = name;
    const label = new THREE.CSS2DObject(labelDiv);
    label.position.set(0, object.geometry.parameters.radius + 0.5, 0);
    object.add(label);
    return label;
}

function setupControls() {
    const showOrbitsCheckbox = document.getElementById('showOrbits');
    const showLabelsCheckbox = document.getElementById('showLabels');
    const showAxesCheckbox = document.getElementById('showAxes');
    const showEclipticCheckbox = document.getElementById('showEcliptic');
    const clearTracesButton = document.getElementById('clearTraces');

    // Toggle visibility of orbits
    showOrbitsCheckbox.addEventListener('change', (event) => {
        planetOrbits.forEach(orbit => orbit.visible = event.target.checked);
    });

    // Toggle visibility of labels
    showLabelsCheckbox.addEventListener('change', (event) => {
        planetLabels.forEach(label => label.visible = event.target.checked);
        sunLabel.visible = event.target.checked;
    });

    // Toggle visibility of axes
    showAxesCheckbox.addEventListener('change', (event) => {
        toggleAxes(event.target.checked);
    });  

    // Toggle visibility of ecliptic plane
    showEclipticCheckbox.addEventListener('change', (event) => {
        toggleEclipticPlane(event.target.checked); 
    });

    // Clear all traces
    clearTracesButton.addEventListener('click', () => {
        clearPaths(); 
    });
}

function addSunLight() {
    // Create a directional light to represent the Sun
    const sunLight = new THREE.PointLight(0xffffff, 1, 1000);  // White light with intensity 1, range 1000 units
    sunLight.position.set(0, 0, 0);  // Position the light at the origin
    sunLight.castShadow = true;  // Enable shadows if needed

    scene.add(sunLight);
}

function updateSunLightDirection(planetPosition) {
    // Assuming sun is at infinite distance, the direction remains constant
    // If the planet moves, the relative position of the sun can be adjusted if needed
    sunLight.position.set(planetPosition.x + 1, planetPosition.y, planetPosition.z);  // Adjust light direction
}

function addAmbientLight() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.05);  // Soft white light with lower intensity
    scene.add(ambientLight);
}

function setupTimeControls() {
    const playPauseButton = document.getElementById('playPause');
    const goToJ2000Button = document.getElementById('goToJ2000');
    const goToTodayButton = document.getElementById('goToToday');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const setSpeedOneButton = document.getElementById('setSpeedOne');
    const reverseButton = document.getElementById('reverse');

    // Update button icon and title
    function updateButton(button, condition, titleTrue, titleFalse, iconTrue, iconFalse) {
        button.title = condition ? titleTrue : titleFalse;
        if (iconTrue && iconFalse) {
            button.innerHTML = condition ? iconTrue : iconFalse;
        }
    }

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
        clearPaths();
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
        currentDate = new Date(J2000_DATE.getTime());
        console.log(currentDate);
        updateDateDisplay();
        clearPaths();
        updatePlanetPositions();
    });

    goToTodayButton.addEventListener('click', () => {
        currentDate = new Date();
        console.log(currentDate);
        updateDateDisplay();
        clearPaths();
        updatePlanetPositions();
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
    updateButton(playPauseButton, isPlaying, "Pause", "Play", '<i class="fas fa-pause"></i>', '<i class="fas fa-play"></i>');
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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

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
        updatePlanetPositions();
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function updatePlanetPositions() {
    const currentJulianDate = calculateJulianDate(currentDate);
    const yearSinceJ2000 = (currentJulianDate - J2000) / 365.25;
    
    planets.forEach(planet => {
        // Calculate Mean Anomaly (M), Eccentric Anomaly (E), True Anomaly (ν)
        const M = updateMeanAnomaly(planet.T, planet.ma, yearSinceJ2000);  
        const E = solveKeplerEquation(planet.e, M);  
        const nu = getTrueAnomaly(planet.e, E);  

        // Calculate radial distance (r)
        const r = spaceScale * planet.a * (1 - planet.e ** 2) / (1 + planet.e * Math.cos(nu)); 

        // Calculate coordinates in the orbital plane
        const x = r * Math.cos(nu);
        const z = -r * Math.sin(nu);
        
        // Apply orbital rotations (Ω, i, ϖ)
        const rotationMatrix = new THREE.Matrix4();
        applyOrbitalRotations(rotationMatrix, planet.i, planet.om, planet.varpi);
        
        // Create a position vector and rotate it
        const positionVector = new THREE.Vector3(x, 0, z);
        positionVector.applyMatrix4(rotationMatrix);
        
        planet.mesh.position.set(positionVector.x, positionVector.y, positionVector.z);

        // Add a segment to the path
        planet.path.push(new THREE.Vector3(positionVector.x, positionVector.y, positionVector.z));
        drawPath(planet);
    });
}

function drawPath(planet) {
    // Remove old path if exists
    if (planet.pathLine) {
        scene.remove(planet.pathLine);
    }
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(planet.path);
    const pathMaterial = new THREE.LineBasicMaterial({ color: planet.color });
    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
    scene.add(pathLine);
    planet.pathLine = pathLine;
}

function clearPaths() {
    planets.forEach(planet => {
        // Clear the path array
        planet.path = [];

        // Remove the existing path line from the scene
        if (planet.pathLine) {
            scene.remove(planet.pathLine);
            planet.pathLine = null; // Reset the path line reference
        }
    });
}

function updateMeanAnomaly(T, M, time) {
    const n = 2 * Math.PI / T;  // Mean motion (rad per unit time)
    const newM = M + n * time;     // New Mean anomaly
    return newM % (2 * Math.PI);  // Ensure it stays within 0 to 2π
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

init();
animate();