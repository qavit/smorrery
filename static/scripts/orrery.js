import { SSS_TEXTURES, sunData, planetsData } from './Resources.js';
import { updateObjectPosition } from './OrbitalMechanics.js';
import * as sb from './SceneBuilder.js';

const J2000_DATE = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)); // 2000-01-01 12:00 UTC
const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2100, 11, 31);

export let scene;
let camera, renderer, labelRenderer, controls;
let sun;
let smallBodiesData = []; // 行星、小天體數據陣列
let orbitingObjects = [];
let celestialObjects = [];

let backgroundSphere, axesArrows, eclipticPlane;
let isPlaying = true;
let timeScale = 1;
let timeDirection = 1;
export let currentDate = J2000_DATE;
let showLabels = false;

export let spaceScale = 20;

let TEXTURES = SSS_TEXTURES;

const raycaster = new THREE.Raycaster(); // 射線檢測器
const mouse = new THREE.Vector2();  // 儲存滑鼠位置

// Fetch sbdb_data from the API endpoint
async function fetchSbdbData() {
    try {
        const response = await fetch('/api/sbdb_query');
        const data = await response.json();
        if (data && data.data) {
            smallBodiesData = data.data.map(smallBody => {
                // Parse data and ensure valid numerical values
                const extractedName = extractNameOrNumber(smallBody[0])
                const epoch = parseFloat(smallBody[1]);
                const e = parseFloat(smallBody[2]);
                const a = parseFloat(smallBody[3]);
                const q = parseFloat(smallBody[4]);
                const i = parseFloat(smallBody[5]);
                const om = parseFloat(smallBody[6]);
                const varpi = parseFloat(smallBody[7]);
                const ma = parseFloat(smallBody[8]);
                

                // Check for any NaN values in the orbital parameters
                if ([epoch, e, a, q, i, om, varpi, ma].some(isNaN)) {
                    console.warn(`Invalid orbital data for object: ${smallBody[0]}`);
                    return null; // Return null for invalid data
                }

                // Return the celestial body data in a structure consistent with planetsData
                return {
                    name: extractedName,
                    orbitalElements: {
                        a: a,          // Semi-major axis
                        e: e,          // Eccentricity
                        i: i,          // Inclination (i), degrees
                        om: om,        // Longitude of Ascending Node (Ω), degrees
                        varpi: varpi,  // Longitude of Perihelion (ϖ), degrees
                        ma: ma,        // Mean Anomaly (M), degrees
                        epoch: epoch   // Epoch, e.g. 2460600.5
                    },
                    color: 0xffff00,   // Custom color for small bodies
                    radius: 0.1,       // Custom radius for small bodies
                    category: 'small body'
                };
            }).filter(body => body !== null);  // Filter out any invalid bodies

            (smallBodiesData);  // Log the transformed small bodies data
        } else {
            console.error('API response does not contain expected data structure');
        }
    } catch (error) {
        console.error('Error fetching sbdb_data:', error);
    }
}
function getHoveredObject(event) {
    // Calculate mouse position (Normalized Device Coordinates)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cast a ray from the mouse position to the celestial objects
    raycaster.setFromCamera(mouse, camera);
    
    // Get all celestial objects' mesh elements
    const meshes = celestialObjects.map(obj => obj.container ? obj.container.children[0] : null).filter(Boolean);
    const intersects = raycaster.intersectObjects(meshes);

    // Check if any celestial object is being hovered over
    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;  // First intersected celestial object
        const intersectedContainer = intersectedObject.parent;  // Get the container of the intersected object
        return celestialObjects.find(obj => obj.container === intersectedContainer);  // Return the hovered celestial object
    } else {
        // If the mouse is not directly hovering over any object, check if it is within a proximity range
        for (let obj of celestialObjects) {
            const distance = calculateDistanceToMouse(obj.container);  // Calculate distance to the object
            const hoverRange = obj.radius * 1.2;  // Proximity range is 1.2 times the object's radius
            if (distance < hoverRange) {
                return obj;  // Return the object if the mouse is within the hover range
            }
        }
    }

    // Check if the mouse is hovering over a label
    for (let obj of celestialObjects) {
        if (obj.label && obj.label.visible) {  // If the label is visible
            const labelElement = obj.label.element;  // Get the DOM element of the label
            const labelBounds = labelElement.getBoundingClientRect();  // Get the bounding box of the label

            // Check if the mouse is inside the label's bounding box
            if (event.clientX >= labelBounds.left && event.clientX <= labelBounds.right &&
                event.clientY >= labelBounds.top && event.clientY <= labelBounds.bottom) {
                return obj;  // Return the celestial object if the mouse is over its label
            }
        }
    }

    return null;  // Return null if no object or label is hovered
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
        showObjectInfo(selectedObject); 
    }
}

function calculateDistanceToMouse(container) {
    // 獲取容器的世界座標
    const containerPosition = new THREE.Vector3();

    // 確保 container 被初始化
    if (container) {
        container.getWorldPosition(containerPosition);
    } else {
        console.error('Container is undefined or not initialized');
        return;
    }
    
    // 使用滑鼠位置創建一個射線
    raycaster.setFromCamera(mouse, camera);

    // 計算滑鼠射線到容器位置的距離
    const distance = raycaster.ray.distanceToPoint(containerPosition);
    return distance;
}

async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 20, 50);

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
    controls.minDistance = spaceScale * 0.1;
    controls.maxDistance = spaceScale * 40;

    // 等待 sbdbData 載入完成
    await fetchSbdbData(); 

    backgroundSphere = sb.createBackground(scene, 1200, TEXTURES['MILKY_WAY']);
    axesArrows = sb.addAxesArrows(scene);
    eclipticPlane = sb.addEclipticPlane(scene, 1200, 1200, 0xffffff, 0.1);

    sb.addLight(scene, 'sun', { intensity: 1, range: 1000 });
    sb.addLight(scene, 'ambient', { intensity: 0.05 });

    sun = new sb.CelestialBody(scene, sunData, TEXTURES);

    const orbitingObjectsData = [...planetsData, ...smallBodiesData]
    orbitingObjectsData.forEach(data => {
        const celestialBody = new sb.CelestialBody(scene, data, TEXTURES);
        orbitingObjects.push(celestialBody);
    });

    celestialObjects = [...orbitingObjects, ...[sun]];

    console.log('Number of celestial objects: ' + celestialObjects.length);

    celestialObjects.forEach(object => {
        console.log(object.name);
    })

    setupUIControls(celestialObjects);
    setupTimeControls();

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('click', onMouseClick, false);
    window.addEventListener('mousemove', onMouseMove, false);

    animate(); 

    const timeControl = document.getElementById('timeControl');
        timeControl.addEventListener('mouseenter', () => {
        controls.enabled = false;
    });
    timeControl.addEventListener('mouseleave', () => {
        controls.enabled = true;
    });
}

function showObjectInfo(intersectedObject) {
    console.log(`This is ${intersectedObject.name}.
    Semi-major axis = ${intersectedObject.orbitalElements.a} AU
    Eccentricity = ${intersectedObject.orbitalElements.e}
    Period = ${intersectedObject.period} yr`);
}


export function setupUIControls(celestialObjects) {
    const showOrbitsCheckbox = document.getElementById('showOrbits');
    const showLabelsCheckbox = document.getElementById('showLabels');
    const showAxesCheckbox = document.getElementById('showAxes');
    const showEclipticCheckbox = document.getElementById('showEcliptic');
    const clearTracesButton = document.getElementById('clearTraces');
    const showSweptAreaCheckbox = document.getElementById('showSweptArea');

    // Toggle visibility of orbits
    showOrbitsCheckbox.addEventListener('change', (event) => {
        celestialObjects.forEach(object => {
            if (object.orbit) {
                object.orbit.visible = event.target.checked; 
            }
        });
    });

    // Toggle visibility of labels
    showLabelsCheckbox.addEventListener('change', (event) => {
        showLabels = event.target.checked;
        celestialObjects.forEach(object => {
            if (object.label) {
                object.label.visible = event.target.checked; 
            }
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

    showSweptAreaCheckbox.addEventListener('change', (event) => {
        celestialObjects.forEach(obj => {
            if(obj.sweptAreas) {
                obj.sweptAreas.forEach(area => {
                    area.visible = event.target.checked;
                });
            }
        });
    });
    // Clear all traces
    clearTracesButton.addEventListener('click', clearTraces);
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
        clearTraces(celestialObjects);
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
        clearTraces(celestialObjects);
        updatePositions();
    });

    goToTodayButton.addEventListener('click', () => {
        currentDate = new Date();
        console.log(currentDate);
        updateDateDisplay();
        clearTraces(celestialObjects);
        updatePositions();
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

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

export function calculateJulianDate(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

export function updateDateDisplay() {
    document.getElementById('currentDateDisplay').textContent = formatDate(currentDate);
    document.getElementById('julianDateDisplay').textContent = `JD: ${calculateJulianDate(currentDate).toFixed(2)}`;
}

function extractNameOrNumber(input) {
    // 定義正則表達式
    const numberNameRegex = /^\s+(\d+\s+[A-Za-z]+)\s+\(.*\)$/;  // 用於匹配 '433 Eros (A898 PA)'，提取名稱
    const numberRegex = /^(\d+)/;  // 用於匹配數字編號

    // 先嘗試匹配名稱
    let match = input.match(numberNameRegex);
    if (match) {
        return match[1];  // 返回名稱
    }

    // 如果名稱匹配失敗，則匹配數字
    match = input.match(numberRegex);
    if (match) {
        return match[1];  // 返回數字編號
    }

    // 如果兩者都無法匹配，返回 null 或其他提示
    return null;
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
        updatePositions();
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function updatePositions() {
    const currentJulianDate = calculateJulianDate(currentDate);
    
    orbitingObjects.forEach(object => {
        updateObjectPosition(object, currentJulianDate);
        drawTrace(object);
    });
}

function drawTrace(object) {
   // 檢查 object.trace 是否包含有效的點
    if (!object.trace || object.trace.length === 0 || object.trace.some(point => isNaN(point.x) || isNaN(point.y) || isNaN(point.z))) {
        console.error(`Invalid trace data for object: ${object.name}`);
        return;  // 如果軌跡無效，直接返回
    }

    // 移除舊的軌跡線
    if (object.traceLine) {
        scene.remove(object.traceLine);
    }

    // 創建新的軌跡線
    const traceGeometry = new THREE.BufferGeometry().setFromPoints(object.trace);
    const traceMaterial = new THREE.LineBasicMaterial({
        color: object.color,
        transparent: true, // 允許透明
        opacity: object.category === 'small body' ? 0.3 : 1.0    // 初始不透明度
    });

    const traceLine = new THREE.Line(traceGeometry, traceMaterial);
    scene.add(traceLine);

    // 儲存新軌跡線
    object.traceLine = traceLine;
}

function clearTraces() {
    celestialObjects.forEach(object => {
        // Clear the path array
        object.trace = [];

        while (object.sweptAreas.length) {
            scene.remove(object.sweptAreas.shift())
        }

        object.lastTraceIndex = 0;
        object.lastSweptTimestamp = new Date(currentDate)

        // Remove the existing path line from the scene
        if (object.traceLine) {
            scene.remove(object.traceLine);
            object.traceLine = null; // Reset the path line reference
        }
    });
}

init();
