// Initialize planets and NEOs data together
let celestialBodiesData = planets;  // Combine planets and NEOs data
let orbitLines = [];  // Initialize the orbitLines array

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 50);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    scene.add(pointLight);

    createCelestialBodies();
    createGUI();

    window.addEventListener('resize', onWindowResize, false);
}

function createGUI() {
    const gui = new dat.GUI();
    const params = { showOrbits: true };

    gui.add(params, 'showOrbits').name('Show Orbits').onChange((value) => {
        orbitLines.forEach(orbit => orbit.visible = value);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function createCelestialBodies() {
    const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    celestialBodiesData.forEach(body => {
        createOrbit(body, body.color);
        
        const geometry = new THREE.SphereGeometry(body.radius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: body.color });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Store the sphere for position updates
        body.sphere = sphere;
        scene.add(sphere);
    });
}

function createOrbit(body, color) {
    const a = body.a * 20;  // Scale up the semi-major axis
    const e = body.e;
    const b = a * Math.sqrt(1 - e * e); // semi-minor axis

    const curve = new THREE.EllipseCurve(
        -a * e, 0,  // x center (focus), y center
        a, b,       // x radius, y radius
        0, 2 * Math.PI,  // start angle, end angle
        false, 0    // clockwise, rotation
    );

    const points = curve.getPoints(200);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Make the orbit line semi-transparent
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });

    const ellipse = new THREE.Line(geometry, material);

    // Rotate the orbit into the correct orientation
    ellipse.rotation.set(Math.PI / 2, body.I * Math.PI / 180, body.Omega * Math.PI / 180);

    scene.add(ellipse);
    orbitLines.push(ellipse);
}

function animate() {
    requestAnimationFrame(animate);
    const currentTime = Date.now() * 0.001;

    // Update positions for all celestial bodies (planets + NEOs)
    celestialBodiesData.forEach(body => {
        const newPosition = updatePosition(body, currentTime);
        body.sphere.position.set(newPosition.x, 0, newPosition.y);
    });

    controls.update();
    renderer.render(scene, camera);
}

// Function to calculate the Mean Anomaly at a given time
function getMeanAnomaly(body, currentTime) {
    const T = Math.sqrt(Math.pow(body.a, 3) / 1.327e11);  // Orbital period (in seconds)
    const n = 2 * Math.PI / T;  // Mean motion (rad/s)
    const M0 = body.ma * (Math.PI / 180);  // Convert Mean Anomaly to radians
    const t0 = body.epoch;  // The epoch of the orbital elements
    const deltaT = currentTime - t0;  // Time since the epoch

    // Calculate the updated Mean Anomaly
    const M = M0 + n * deltaT;  
    return M % (2 * Math.PI);  // Keep it in the range [0, 2π]
}

// Function to compute the Eccentric Anomaly (E) given the Eccentricity (e) and Mean Anomaly (M)
// Uses iterative Newton-Raphson method to solve Kepler's equation: M = E - e * sin(E)
function keplerSolve(e, M) {
    const tolerance = 1e-6;  // Convergence tolerance
    let E = M;  // Initial guess for E is M
    let deltaE = 1;  // Difference between two successive E values

    // Iterate until the difference is smaller than the tolerance
    while (Math.abs(deltaE) > tolerance) {
        // Kepler's equation: E - e * sin(E) = M
        deltaE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E = E - deltaE;
    }
    return E;
}

// Function to update the position of a celestial body based on its orbital parameters
function updatePosition(body, currentTime) {
    const M = getMeanAnomaly(body, currentTime);  // Calculate Mean Anomaly
    const E = keplerSolve(body.e, M);  // Solve for Eccentric Anomaly
    const r = body.a * (1 - body.e * Math.cos(E));  // Calculate the radius (distance from the focus)

    // Calculate x and y coordinates in the orbital plane
    const x = r * Math.cos(E);
    const y = r * Math.sin(E);

    return { x: x, y: y };
}


init();
// animate();