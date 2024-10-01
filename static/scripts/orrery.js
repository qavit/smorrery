const J2000_DATE = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)); // 2000-01-01 12:00 UTC
const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2100, 11, 31);
const EARTH_SIDEREAL_YEAR = 365.256363004 * 86400 * 1000; // https://hpiers.obspm.fr/eop-pc/models/constants.html
const SWEPT_AREAS_AMOUNT = 6;


let scene, camera, renderer, labelRenderer, controls;
let xArrow, yArrow, zArrow, eclipticPlane; 

let sun = {
    name: 'Sun',
    radius: 2,
    container: null,
    label: null,
    color: 0xffff00,  // 自定義太陽的顏色，備用
};

let smallBodies = []; // 行星、小天體物件陣列
let orbitingObjects = []; // 行星、小天體物件陣列

let objectContainers = []; // 行星、小天體容器陣列
let objectOrbits = []; // 行星、小天體軌道陣列（預先計算）
let objectTraces = []; // 行星、小天體軌跡陣列
let objectLabels = []; // 行星、小天體標籤陣列

let sunArray, celestialObjects;

let radiusScale = 0.5;
let isPlaying = true;
let timeScale = 1;
let timeDirection = 1;
let spaceScale = 20;
let currentDate = J2000_DATE; 
let showLabels = false;  // 默認為不顯示 label

const raycaster = new THREE.Raycaster(); // 射線檢測器
const mouse = new THREE.Vector2();  // 儲存滑鼠位置

const SSS_TEXTURES = {
    SUN: "static/textures/2k_sun.jpg",
    MERCURY: "static/textures/2k_mercury.jpg",
    VENUS: "static/textures/2k_venus_surface.jpg",
    EARTH: "static/textures/2k_earth_daymap.jpg",
    MOON: "static/textures/2k_moon.jpg",
    MARS: "static/textures/2k_mars.jpg",
    JUPITER: "static/textures/2k_jupiter.jpg",
    SATURN: "static/textures/2k_saturn.jpg",
    SATURN_RING: "static/textures/2k_saturn_ring_alpha.png",
    URANUS: "static/textures/2k_uranus.jpg",
    NEPTUNE: "static/textures/2k_neptune.jpg",
    MILKY_WAY: "static/textures/2k_stars_milky_way.jpg",
};

// Fetch sbdb_data from the API endpoint
async function fetchSbdbData() {
    try {
        const response = await fetch('/api/sbdb_query');
        const data = await response.json();
        if (data && data.data) {
            console.log(data);
            smallBodies = data.data.map(smallBody => {
                // 取出 API 返回的小天體數據，並轉換成與 planets 一致的結構
                const fullName = smallBody[0];         // 小天體名稱
                const a = parseFloat(smallBody[3]);    // 半長軸
                const e = parseFloat(smallBody[2]);    // 離心率
                const i = parseFloat(smallBody[5]);    // 軌道傾角
                const om = parseFloat(smallBody[6]);   // 升交點經度
                const w = parseFloat(smallBody[7]);    // 近日點幅角
                const ma = parseFloat(smallBody[8]);   // 平近點角

                // 自定義小天體的顏色與大小
                const color = 0xffff00;  // 你可以根據需要調整小天體的顏色
                const radius = 0.1;      // 為小天體設置一個小的半徑（可以根據小天體的實際大小調整）

                // 將小天體轉換為與行星相同的結構
                return {
                    name: extractNameOrNumber(fullName),
                    a: a,           // 半長軸，單位：AU
                    e: e,           // 離心率
                    i: i,           // 軌道傾角，單位：度
                    om: om,         // 升交點經度，單位：度
                    varpi: w,       // 近日點幅角，單位：度
                    ma: ma,         // 平近點角，單位：度
                    epoch: J2000,   // 使用 J2000 曆元
                    color: color,   // 自定義顏色
                    radius: radius,  // 半徑
                    category: 'small body'
                };
            });
            console.log(smallBodies);  // 印出轉換後的小天體數據
        } else {
            console.error('API response does not contain expected data structure');
        }
    } catch (error) {
        console.error('Error fetching sbdb_data:', error);
    }
}

function getHoveredObject(event) {
    // 計算滑鼠位置（標準化設備座標）
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 將射線從滑鼠位置投射到行星
    raycaster.setFromCamera(mouse, camera);
    
    // 獲取所有行星的 mesh 物件
    const meshes = celestialObjects.map(obj => obj.container ? obj.container.children[0] : null).filter(Boolean);
    const intersects = raycaster.intersectObjects(meshes);

    // 檢查是否 hover 到行星
    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;  // 第一個相交的行星球體
        const intersectedContainer = intersectedObject.parent;
        return celestialObjects.find(obj => obj.container === intersectedContainer);
    } else {
        // 如果滑鼠沒有直接 hover 到容器上，檢查是否在接近範圍內
        for (let obj of celestialObjects) {
            const distance = calculateDistanceToMouse(obj.container);
            const hoverRange = obj.radius * 1.2;  // 容器半徑的 1.2 倍
            if (distance < hoverRange) {
                return obj;  // 返回 hover 到的天體
            }
        }
    }

    // 檢查是否 hover 到標籤
    for (let obj of celestialObjects) {
        if (obj.label && obj.label.visible) {  // 如果 label 可見
            const labelElement = obj.label.element;  // 取得 DOM 元素
            const labelBounds = labelElement.getBoundingClientRect();  // 取得標籤的邊界範圍

            // 檢查滑鼠是否在標籤的範圍內
            if (event.clientX >= labelBounds.left && event.clientX <= labelBounds.right &&
                event.clientY >= labelBounds.top && event.clientY <= labelBounds.bottom) {
                return obj;  // 如果 hover 到標籤，也算選到該天體
            }
        }
    }

    return null;  // 沒有 hover 到任何物體或標籤
}

function onMouseMove(event) {
    celestialObjects.forEach(obj => {
        if (obj.container && obj.container.children[0].material.emissive) {
            const originalEmissiveEffect = obj.name !== 'Sun' ? 0x000000 : 0xffff00 
            obj.container.children[0].material.emissive.set(originalEmissiveEffect);  // 回覆原本光膜效果
        }
        if (!showLabels && obj.label) {
            obj.label.visible = false;  // 隱藏所有 label
        }
    });

    const hoveredObject = getHoveredObject(event);
    if (hoveredObject) {
        // 光膜效果
        const mesh = hoveredObject.container.children[0];
        if (mesh.material.emissive) {
            mesh.material.emissive.set(0x00ff00);  // 添加光膜效果
        }
        if (!showLabels && hoveredObject.label) {
            hoveredObject.label.visible = true;  // 顯示 label
        }
    }
}

function onMouseClick(event) {
    const selectedObject = getHoveredObject(event);
    if (selectedObject) {
        console.log(selectedObject);  // 印出該天體的所有資料
    }
}

function calculateDistanceToMouse(container) {
    // 獲取容器的世界座標
    const containerPosition = new THREE.Vector3();
    container.getWorldPosition(containerPosition);
    
    // 使用滑鼠位置創建一個射線
    raycaster.setFromCamera(mouse, camera);

    // 計算滑鼠射線到容器位置的距離
    const distance = raycaster.ray.distanceToPoint(containerPosition);
    return distance;
}


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

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add starry background
    function createBackgroundSphere() {
        const loader = new THREE.TextureLoader();
        
        // 加載星空背景材質
        loader.load(SSS_TEXTURES['MILKY_WAY'], function(texture) {
            const geometry = new THREE.SphereGeometry(1200, 60, 40);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });

            const backgroundSphere = new THREE.Mesh(geometry, material);
            scene.add(backgroundSphere);
        });
    }

    // 等待 sbdbData 載入完成
    await fetchSbdbData(); 

    addAxesArrows(); // initially invisible
    addEclipticPlane(); // initially invisible
    createBackgroundSphere();
    createSun();
    
    orbitingObjects = [...planets, ...smallBodies];

    orbitingObjects.forEach(obj => {
        createOrbitingObject(obj);
    });

    sunArray = [sun];
    celestialObjects = [...planets, ...smallBodies, ...sunArray];

    console.log(orbitingObjects);
    // console.log(scene.children);

    addSunLight();
    addAmbientLight();
    setupControls();
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

function createSun() {
    const geometry = new THREE.SphereGeometry(sun.radius, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(SSS_TEXTURES['SUN']);
    material = new THREE.MeshStandardMaterial({
        // color: 0xffff00,
        map: texture,               
        roughness: 0.5,             // Roughness -> non-reflective
        metalness: 0,               // No metalness
        emissive: 0xffff00,         // With self-illumination
        emissiveIntensity: 1.0,     
        emissiveMap: texture        
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;   
    mesh.receiveShadow = true; 

    const container = new THREE.Object3D();
    container.add(mesh);
    scene.add(container);

    const label = addLabel(mesh, 'Sun');
    scene.add(label);
    label.visible = false;

    objectContainers.push(container);
    objectLabels.push(label);

    sun.container = container;
    sun.label = label;

    console.log('Created Sun');
}

function createOrbitingObject(obj) {
    let material;
    const textureLoader = new THREE.TextureLoader();
    const geometry = new THREE.SphereGeometry(obj.radius * radiusScale, 32, 32);
    
    if (obj.category === 'small body') {
        material = new THREE.MeshStandardMaterial({ 
            color: 0x404040
        });
    } else {
        const texturePath = SSS_TEXTURES[obj.name.toUpperCase()];
        const texture = textureLoader.load(texturePath);
        material = new THREE.MeshStandardMaterial({
            //color: obj.color,
            map: texture,
            roughness: 0.5,             // Roughness -> non-reflective
            metalness: 0,               // No metalness 
            emissive: 0x000000          // No self-illumination
        }); 
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;   
    mesh.receiveShadow = true; 
    
    const container = new THREE.Object3D();
    container.add(mesh);
    // const randomNumberX = Math.floor(Math.random() * 51); // for test
    // const randomNumberZ = Math.floor(Math.random() * 51); // for test

    scene.add(container);

    createOrbitLine(obj);
    
    if (obj.name.toUpperCase() === 'SATURN') {
        createRing(obj.radius, 1.24, 2.27, container);
    }

    const label = addLabel(mesh, obj.name);
    obj.label = label;
    scene.add(label);
    label.visible = false;

    objectLabels.push(label);
    objectContainers.push(container);

    obj.container = container;
    obj.trace = [];
    obj.T = Math.sqrt(obj.a ** 3);  // Orbital period; using Kepler's 3rd Law

    obj.sweptAreas = [];
    obj.lastTraceIndex = 0;
    obj.lastSweptTimestamp = new Date(currentDate);

    console.log('Created ' + obj.name);
}

function createRing (radius, innerScale, outerScale, container) {
    // 創建土星環的幾何體
    const innerRadius = radius * innerScale * radiusScale; 
    const outerRadius = radius * outerScale * radiusScale; 
    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const textureLoader = new THREE.TextureLoader();
    
    const ringTexture = textureLoader.load(SSS_TEXTURES['SATURN_RING']); 
    
    // 創建土星環材質
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff, // 暫時用白色
        //map: ringTexture,
        side: THREE.DoubleSide,  // 讓土星環的正反面都可見
        transparent: true        // 使用透明材質
    });

    // 創建土星環 Mesh
    const saturnRing = new THREE.Mesh(ringGeometry, ringMaterial);

    // 將土星環繞著 X 軸旋轉 90 度，放在行星赤道平面上
    saturnRing.rotation.x = Math.PI / 2;

    // 將土星環添加到行星容器中
    container.add(saturnRing);
}

function createOrbitLine(obj) {
    const a = obj.a
    const b = a * Math.sqrt(1 - obj.e ** 2);  // Calculate semi-minor axis
    const curve = new THREE.EllipseCurve(
        0, 0,           // ax, aY 
        a, b,   // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false,          // aClockwise
        0               // aRotation
    );

    const points = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, 0, p.y))
    );
    
    const orbitOpacity = obj.category === 'small body' ? 0.5 : 1.0;
    const material = new THREE.LineBasicMaterial({
        color: obj.color,
        transparent: true, // 允許透明
        opacity: orbitOpacity,      // 初始不透明
    });

    const orbit = new THREE.Line(geometry, material);
    
    const orbitContainer = new THREE.Object3D();
    orbitContainer.add(orbit);
    
    const rotationMatrix = new THREE.Matrix4();
    applyOrbitalRotations(rotationMatrix, obj.i, obj.Omega, obj.varpi);
    orbitContainer.applyMatrix4(rotationMatrix);
    
    orbitContainer.visible = false;
    scene.add(orbitContainer);
    objectOrbits.push(orbitContainer);
}

let color_flag = true;
function createSweptArea(planet, points) {
  const material = new THREE.MeshBasicMaterial({
    color: color_flag ? 0xff0000 : 0x0000ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  color_flag = !color_flag;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  points.forEach(function (point) {
    shape.lineTo(point.x, point.z);
  });
  shape.lineTo(0, 0);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const sweptArea = new THREE.Mesh(geometry, material);
  const container = new THREE.Object3D();
  const rotationMatrix = new THREE.Matrix4();
  applyOrbitalRotations(rotationMatrix, planet.i, planet.om, planet.varpi);
  // container.applyMatrix4(rotationMatrix)
  container.visible = document.getElementById("showSweptArea").checked;
  scene.add(container);

  container.add(sweptArea);
  planet.sweptAreas.push(container);
  if (planet.sweptAreas.length >= SWEPT_AREAS_AMOUNT) {
    const item = planet.sweptAreas.shift();
    scene.remove(item);
  }
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

function showObjectInfo(intersectedObject) {
    const planetName = intersectedObject.parent.name;  // 根據容器名稱或 Mesh 名稱找到行星
    console.log(`Clicked on planet: ${planetName}`);
    // 可以顯示行星的更多屬性
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

function setupControls() {
    const showOrbitsCheckbox = document.getElementById('showOrbits');
    const showLabelsCheckbox = document.getElementById('showLabels');
    const showAxesCheckbox = document.getElementById('showAxes');
    const showEclipticCheckbox = document.getElementById('showEcliptic');
    const showSweptAreaCheckbox = document.getElementById('showSweptArea');
    const clearTracesButton = document.getElementById('clearTraces');

    // Toggle visibility of orbits
    showOrbitsCheckbox.addEventListener('change', (event) => {
        objectOrbits.forEach(orbit => orbit.visible = event.target.checked);
    });

    // Toggle visibility of labels
    showLabelsCheckbox.addEventListener('change', (event) => {
        showLabels = event.target.checked;  // 更新 showLabels 狀態
        celestialObjects.forEach(obj => {
            if (obj.label) {
                obj.label.visible = showLabels;  // 根據狀態顯示或隱藏 label
            }
        });
    });

    // Toggle visibility of axes
    showAxesCheckbox.addEventListener('change', (event) => {
        toggleAxes(event.target.checked);
    });  

    // Toggle visibility of ecliptic plane
    showEclipticCheckbox.addEventListener('change', (event) => {
        toggleEclipticPlane(event.target.checked); 
    });

    // Toggle visibility of swept areas
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
    clearTracesButton.addEventListener('click', () => {
        clearTraces(); 
    });
}

function addSunLight() {
    // Create a directional light to represent the Sun
    const sunLight = new THREE.PointLight(0xffffff, 1, 1000);  // White light with intensity 1, range 1000 units
    sunLight.position.set(0, 0, 0);  // Position the light at the origin
    sunLight.castShadow = true;  // Enable shadows if needed

    scene.add(sunLight);
}

function updateSunLightDirection(objPosition) {
    // Assuming sun is at infinite distance, the direction remains constant
    // If the object moves, the relative position of the sun can be adjusted if needed
    sunLight.position.set(objPosition.x + 1, objPosition.y, objPosition.z);  // Adjust light direction
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
        clearTraces();
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
        clearTraces();
        updatePositions();
    });

    goToTodayButton.addEventListener('click', () => {
        currentDate = new Date();
        console.log(currentDate);
        updateDateDisplay();
        clearTraces();
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
        updatePositions();
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function getAngle(point) {
  if (point.z > 0)
    return Math.PI * 2 - point.angleTo(new THREE.Vector3(1, 0, 0));
  return point.angleTo(new THREE.Vector3(1, 0, 0));
}
function updatePositions() {
    const currentJulianDate = calculateJulianDate(currentDate);
    const yearSinceJ2000 = (currentJulianDate - J2000) / 365.25;
    
    orbitingObjects.forEach(obj => {
        // Calculate Mean Anomaly (M), Eccentric Anomaly (E), True Anomaly (ν)
        const M = updateMeanAnomaly(obj.T, obj.ma, yearSinceJ2000);  
        const E = solveKeplerEquation(obj.e, M);  
        const nu = getTrueAnomaly(obj.e, E);  

        // Calculate radial distance (r)
        const r = spaceScale * obj.a * (1 - obj.e ** 2) / (1 + obj.e * Math.cos(nu)); 

        // Calculate coordinates in the orbital plane
        const x = r * Math.cos(nu);
        const z = -r * Math.sin(nu);
        
        // Apply orbital rotations (Ω, i, ϖ)
        const rotationMatrix = new THREE.Matrix4();
        applyOrbitalRotations(rotationMatrix, obj.i, obj.om, obj.varpi);
        
        // Create a position vector and rotate it
        const positionVector = new THREE.Vector3(x, 0, z);
        positionVector.applyMatrix4(rotationMatrix);
        
        obj.container.position.set(positionVector.x, positionVector.y, positionVector.z);
        obj.container.updateMatrixWorld(true);  // 確保更新應用到場景
        obj.label.position.set(positionVector.x, positionVector.y + obj.radius + 0.5, positionVector.z);

        if (
          currentDate - obj.lastSweptTimestamp >=
          (EARTH_SIDEREAL_YEAR * obj.T) / SWEPT_AREAS_AMOUNT
        ) {
          if (obj.name == "Mercury") {
            obj.lastSweptTimestamp = new Date(currentDate);
            let points = obj.trace.slice(
              obj.lastTraceIndex,
              obj.trace.length
            );
            // const path = new THREE.Path()
            // path.absellipse(
            //     0,
            //     0,
            //     obj.a * spaceScale,
            //     obj.a * Math.sqrt(1 - obj.e ** 2) * spaceScale,
            //     getAngle(points.at(0)),
            //     getAngle(points.at(-1)),
            //     false,
            //     0
            //   );
            // createSweptArea(obj, path.getPoints());
            createSweptArea(obj, points);
    
            obj.lastTraceIndex = obj.trace.length - 1;
          }
        }
        // Add a segment to the trace
        obj.trace.push(new THREE.Vector3(positionVector.x, positionVector.y, positionVector.z));
        drawTrace(obj);
    });
}

function drawTrace(obj) {
    // 移除舊的軌跡線
    if (obj.traceLine) {
        scene.remove(obj.traceLine);
    }

    // 創建新的軌跡線
    const traceGeometry = new THREE.BufferGeometry().setFromPoints(obj.trace);
    const traceMaterial = new THREE.LineBasicMaterial({
        color: obj.color,
        transparent: true, // 允許透明
        opacity: obj.category === 'small body' ? 0.3 : 1.0    // 初始不透明度
    });

    const traceLine = new THREE.Line(traceGeometry, traceMaterial);
    scene.add(traceLine);

    // 儲存新軌跡線
    obj.traceLine = traceLine;
}

function clearTraces() {
    orbitingObjects.forEach(obj => {
        // Clear the path array
        obj.trace = [];

        // Remove the existing path line from the scene
        if (obj.traceLine) {
            scene.remove(obj.traceLine);
            obj.traceLine = null; // Reset the path line reference
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
