import { applyOrbitalRotations } from './OrbitalMechanics.js';
import { spaceScale } from './orrery.js';

export class CelestialBody {
    constructor(scene, data, textures, radiusScale=0.5) {
        this.scene = scene;
        this.name = data.name || 'Unnamed';
        this.radius = data.radius || 1;
        this.radiusScaled = data.radius * radiusScale || 1 * radiusScale;
        this.category = data.category || 'small body';
        this.subclass = data.subclass || 'NEO';
        this.color = data.color || 0x404040;
        this.textures = textures || null;
        this.texturesPath = this.textures[this.name.toUpperCase()] || null;
        this.orbitalElements = data.orbitalElements || {};  
        this.container = new THREE.Object3D();
        this.label = null;
        this.orbit = null;
        this.trace = [];

        // Orbital period (Kepler's 3rd Law)
        this.period = Math.sqrt(this.orbitalElements.a ** 3) || 1; 
        this.sweptAreas = [];
        this.lastTraceIndex = 0;
        this.lastSweptTimestamp = new Date(Date.UTC(2000, 0, 1, 12, 0, 0))
        this.createBody();
    }

    createBody() {
        const geometry = new THREE.SphereGeometry(this.radiusScaled, 32, 32);
        let material;

        if (this.category === 'small body' || !this.texturesPath) {
            material = new THREE.MeshStandardMaterial({ color: this.color });
        } else {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(this.texturesPath);
            if (this.name === 'Sun') {
                material = new THREE.MeshStandardMaterial({
                    map: texture,               
                    roughness: 0.5,         // Roughness ≈ non-reflectiveness
                    metalness: 0,           // No metalness
                    emissive: 0xffff00,     // With self-illumination
                    emissiveIntensity: 1.0,     
                    emissiveMap: texture        
                });
            } else {
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.5,     // Roughness ≈ non-reflectiveness
                    metalness: 0,       // No metalness
                    emissive: 0x000000  // No self-illumination
                });
            }
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        this.container.add(mesh);
        this.scene.add(this.container);

        /* 
        Add rings if the celestial body is Saturn.
          1.24 * Saturn's radius = inner radius of C-ring
          2.27 * Saturn's radius = outer radius of A-ring
        This method may apply to Jupiter, Uranus, and Neptune as well. 
        */
        if (this.name.toUpperCase() === 'SATURN') {
            this.createRing(1.24, 2.27, this.textures['SATURN_RING']);
        }

        // Add a label next to the celestial body's mesh.
        this.label = this.addLabel(mesh, this.name);

        if (this.name.toUpperCase() != 'SUN') {
            this.orbit = this.createOrbitLine();
        }
        
    }

    addLabel(mesh, name) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label';
        labelDiv.textContent = name;

        const label = new THREE.CSS2DObject(labelDiv);
        label.position.set(0, this.radiusScaled + 0.5, 0);
        label.visible = false; // default: invisible
        mesh.add(label);

        this.scene.add(label);

        return label;
    }

    createRing(inner, outer, ringTexturePath) {
        const innerRadius = this.radius * inner;
        const outerRadius = this.radius * outer;

        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
        const textureLoader = new THREE.TextureLoader();
        const ringTexture = textureLoader.load(ringTexturePath);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,        // white, subsidary
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; 
        this.container.add(ring);
    }

    createOrbitLine() {
        const {a, e, i, Omega, varpi} = this.orbitalElements;

        const aScaled = a * spaceScale;              // semi-major axis (a)
        const b = (e < 1) ? aScaled * Math.sqrt(1 - e ** 2) : 0;   // semi-minor axis (b)
        const curve = new THREE.EllipseCurve(0, 0, aScaled, b, 0, 2 * Math.PI, false, 0);
        
        const points = curve.getPoints(100);
        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map(p => new THREE.Vector3(
                isNaN(p.x) ? 0 : p.x, 
                0, 
                isNaN(p.y) ? 0 : p.y
            ))
        );

        const orbitOpacity = (this.category === 'small body') ? 0.5 : 1.0;
        const material = new THREE.LineBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: orbitOpacity
        });

        const orbitLine = new THREE.Line(geometry, material);
        const orbitContainer = new THREE.Object3D();
        orbitContainer.add(orbitLine);

        const rotationMatrix = new THREE.Matrix4();
        applyOrbitalRotations(rotationMatrix, i, Omega, varpi);
        orbitContainer.applyMatrix4(rotationMatrix);

        orbitContainer.visible = false;

        this.scene.add(orbitContainer);

        return orbitContainer;
    }
}

export function addLight(scene, type = 'ambient', options = {}) {
    let light;

    if (type === 'sun') {
        light = new THREE.PointLight(
            0xffffff, 
            options.intensity || 1, 
            options.range || 1000
        );
        light.position.set(0, 0, 0);
        light.castShadow = options.castShadow || false;
    } else if (type === 'ambient') {
        light = new THREE.AmbientLight(
            0x404040, 
            options.intensity || 0.05
        );
    }

    if (light) scene.add(light); // 'Let there be light.' -- Genesis 1:3
}

export function createBackground(scene, radius, texturePath) {
    const textureLoader = new THREE.TextureLoader();
    const geometry = new THREE.SphereGeometry(radius, 60, 40);

    const params = texturePath ? { 
        map: textureLoader.load(texturePath), // Load the background texture
        side: THREE.BackSide 
    } : { 
        color: 0x000000, // Use black background
        side: THREE.BackSide
    };

    const material = new THREE.MeshBasicMaterial(params);
    const backgroundSphere = new THREE.Mesh(geometry, material);

    // Apply galactic to ecliptic rotation
    const eulerAngles = new THREE.Euler(62.87 / 180 * Math.PI, 0, -282.86 / 180 * Math.PI);
    backgroundSphere.quaternion.setFromEuler(eulerAngles);

    scene.add(backgroundSphere);
}

export function addAxesArrows(scene) {
    const directions = [
        { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },  // X-axis: red
        { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },  // Y-axis: green
        { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff }   // Z-axis: blue
    ];

    const arrowLength = spaceScale;
    const arrowHeadLength = 4;
    const arrowHeadWidth = 2;
    const origin = new THREE.Vector3(0, 0, 0);
    let axesArrows = [];

    directions.forEach(({ dir, color }) => {
        const arrow = new THREE.ArrowHelper(dir, origin, arrowLength, color, arrowHeadLength, arrowHeadWidth);
        arrow.visible = false;  // default: invisible
        scene.add(arrow);
        axesArrows.push(arrow);
    });

    return axesArrows;
}

export function addEclipticPlane(scene, width = 1200, height = 1200, color = 0xffffff, opacity = 0.1) {
    const planeGeometry = new THREE.PlaneGeometry(width, height); 
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: color, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: opacity 
    });

    const eclipticPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    eclipticPlane.rotation.x = Math.PI / 2;
    eclipticPlane.visible = false;  // default: invisible
    scene.add(eclipticPlane);

    return eclipticPlane; 
}