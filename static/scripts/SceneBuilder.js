import { rotateOrbit } from './OrbitalMechanics.js';
import { spaceScale } from './Resources.js';

export class CelestialBody {
    constructor(scene, data, textures = null) {
        this.scene = scene;
        this.name = data.name || 'Unnamed';
        this.radius = data.radius || 1;
        this.category = data.category || 'small body';
        this.subclass = data.subclass || 'NEO';
        this.opacity = data.opacity || 1.0;
        this.color = data.color || 0x404040;
        this.textures = textures || null;
        this.orbitalElements = data.orbitalElements || {};  
        this.container = new THREE.Object3D();
        this.label = null;
        this.orbit = null;
        
        if (textures) {
          this.texturesPath = this.textures[this.name.toUpperCase()];
        }

        // For Education Module Orbital period (Kepler's 2rd Law)
        this.period = Math.sqrt(this.orbitalElements.a ** 3) || 1; 
        this.sweptAreas = [];
        this.lastTraceIndex = 0;
        this.lastSweptTimestamp = new Date(Date.UTC(2000, 0, 1, 12, 0, 0))
      
        this.createBody();

        // If this is not the Sun, calculate some more orbital elements.
        if (this.name != 'Sun') {
            const {a, e} = this.orbitalElements;
            if (a && e && !isNaN(a) && !isNaN(e)) {
                this.period = Math.sqrt(a ** 3); // Orbital period (Kepler's 3rd Law)
                this.orbitalElements.q = a * (1-e); // Perihelion 
                this.orbitalElements.Q = a * (1+e); // Apohelion
            } else {
                console.error(`Invalid orbital elements for ${this.name}: a = ${a}  or e = ${e} is not a valid number`);
            }
            
            // If this is an artificial asteroid, create the ortbit, orbital plane and orbital vectors.
            if (this.subclass === 'artificial') {
                this.orbit = this.createOrbit(300, true);
                this.orbitalPlane = this.createOrbitalPlane(this.orbitalElements.h_vec, true);
                this.orbitalVectors = this.createOrbitalVectors(true);
            } 
            // Otherwise, just create the orbit.
            else { 
                this.orbit = this.createOrbit();
            }
        }
    }

    createBody() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        let material;

        if (this.category === 'small body' || !this.texturesPath) {
            material = new THREE.MeshStandardMaterial({ color: this.color });
        } else {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(this.texturesPath);
            if (this.name === 'Sun') {
                material = new THREE.MeshStandardMaterial({
                    map: texture,               
                    roughness: 0,           // Roughness ≈ non-reflectiveness
                    metalness: 0,           // No metalness
                    emissive: 0xffff00,     // With self-illumination
                    emissiveIntensity: 1.0,     
                    emissiveMap: texture        
                });
            } else {
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0,       // Roughness ≈ non-reflectiveness
                    metalness: 0,       // No metalness
                    emissive: 0x000000  // No self-illumination
                });
            }
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.container.add(mesh);
        this.scene.add(this.container);

        /* 
        Add rings if the celestial body is Saturn.
          1.24 * Saturn's radius = inner radius of C-ring
          2.27 * Saturn's radius = outer radius of A-ring
        This method may apply to Jupiter, Uranus, and Neptune as well. 
        */
        if (this.name === 'Saturn') {
            this.createRing(1.24, 2.27, this.textures['SATURN_RING']);
        }

        // Add a label next to the celestial body's mesh.
        this.label = this.addLabel(mesh, this.name);
    }

    addLabel(mesh, name, visible = false) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label';
        labelDiv.textContent = name;

        const label = new THREE.CSS2DObject(labelDiv);
        label.position.set(0, this.radius + 0.5, 0);
        label.visible = visible;
        mesh.add(label);

        this.scene.add(label);

        return label;
    }

    createRing(inner, outer, ringTexturePath) {
        const innerRadius = this.radius * inner;
        const outerRadius = this.radius * outer;

        const ringGeometry = new THREE.RingBufferGeometry(innerRadius, outerRadius, 64);
        var pos = ringGeometry.attributes.position;
        var v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++){
          v3.fromBufferAttribute(pos, i);
          ringGeometry.attributes.uv.setXY(i, v3.length() < (innerRadius + outerRadius)/2 ? 0 : 1, 1);
        }

        const ringTexture = new THREE.TextureLoader().load(ringTexturePath);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,        // white, subsidary
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true,
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; 
        this.container.add(ring);
    }

    createOrbit(numPoints = 100, visible = false) {
        const { a, e, i, om, varpi } = this.orbitalElements;
        const aScaled = a * spaceScale;
        
        let points = [];
        if (e < 1) {
            // Elliptical orbit
            this.orbitShpae = (e === 0) ? 'circular' : 'elliptical';
            const b = aScaled * Math.sqrt(1 - e ** 2);
            const ellipseCurve = new THREE.EllipseCurve(
                aScaled * e, 0,
                aScaled, b,
                0, 2 * Math.PI,
                false,
                0
            );
            points = ellipseCurve.getPoints(numPoints);
    
        } else if (e === 1) {
            // Parabolic orbit
            this.orbitShpae = 'parabolic';
            const p = aScaled * (1 + e);  // latus rectum (正焦弦長)
            for (let theta = -Math.PI / 2; theta <= Math.PI / 2; theta += Math.PI / numPoints) {
                const r = p / (1 + Math.cos(theta)); 
                points.push(new THREE.Vector3(-r * Math.cos(theta), 0, r * Math.sin(theta)));
            }
            
    
        } else if (e > 1) {
            // Hyperbolic orbit
            this.orbitShpae = 'hyperbolic';
            const b = aScaled * Math.sqrt(e ** 2 - 1);
            for (let theta = -Math.PI / 4; theta <= Math.PI / 4; theta += Math.PI / (2 * numPoints)) {
                const r = aScaled * (e ** 2 - 1) / (1 + e * Math.cos(theta));
                points.push(new THREE.Vector3(-r * Math.cos(theta), 0, r * Math.sin(theta)));
            }
        } else {
            alert('Invalid eccentricity!');
            this.orbitShpae = null;
            return;
        }
    
        // Convert the points and THREE.Vector3 and 
        const transformedPoints = points.map(p => new THREE.Vector3(-p.x, 0, p.y));
    
        // Build the Line object
        const geometry = new THREE.BufferGeometry().setFromPoints(transformedPoints);
        const material = new THREE.LineBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: this.opacity,
        });
        const orbitLine = new THREE.Line(geometry, material);
    
        // Put the orbit in the container
        const orbitContainer = new THREE.Object3D();
        orbitContainer.add(orbitLine);
    
        // Apply orbital rotations to the orbit
        rotateOrbit(orbitContainer, i, om, varpi);
    
        orbitContainer.visible = visible;
        
        this.scene.add(orbitContainer);
        return orbitContainer;
    }

    createOrbitalPlane(normalVector, visible = false) {
        const planeSize = this.orbitalElements.Q * 2.5 * spaceScale;
        const plane = createPlane({
            normalVector: normalVector,
            width: planeSize,
            height: planeSize,
            color: this.color,
            opacity: 0.1,
            transparent: true,
            visible: visible
        });

        this.scene.add(plane);
        return plane;
    }

    createOrbitalVectors(visible = false) {
        const orbitalVectors = [];
        const { h_vec, e_vec, n_vec } = this.orbitalElements;
        const vectorColors = [0xffff00, 0xee0000, 0x0000ff];
    
        [h_vec, e_vec, n_vec].forEach((vec, i) => {
            const orbitalVector = createArrow({
                dir: vec,
                length: 1 * spaceScale,
                color: vectorColors[i],
                visible: true
            });
            this.scene.add(orbitalVector);
            orbitalVectors.push(orbitalVector);
        });

        return orbitalVectors;
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
            options.intensity || 0.5
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

export function createPlane({ 
    width = 1200, 
    height = 1200, 
    color = 0xffffff, 
    opacity = 0.1, 
    rotation = null, 
    normalVector = null,
    transparent = true,
    visible = false
} = {}) {
    if (!rotation && !normalVector) {
        throw new Error('Either rotation or normalVector must be provided');
    }

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: transparent,
            opacity: opacity
        })
    );

    // Apply either rotation or normalVector logic
    if (rotation) {
        plane.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    } else {
        plane.lookAt(normalVector.clone().normalize());
    }

    plane.visible = visible;

    return plane;
}

export function createArrow({ 
    dir = new THREE.Vector3(1, 0, 0), 
    origin = new THREE.Vector3(0, 0, 0),
    length = null, 
    color = 0xffffff, 
    headLength = 4,
    headWidth = 2,
    visible = false 
} = {}) {
    const arrowLength = length || (dir.length() * spaceScale)
    const unitVector = dir.clone().normalize();
    const arrowHelper = new THREE.ArrowHelper(
        unitVector, origin, arrowLength, color, headLength, headWidth
    );
    arrowHelper.visible = visible;
    return arrowHelper;
}

// ----------------------------------------------------

export function addEclipticPlane(scene, visible = false) {
    const eclipticPlane = createPlane({ 
        rotation: { x: Math.PI / 2 },
        visible: visible
      }, );
    scene.add(eclipticPlane);
    return eclipticPlane;
}


export function addAxesArrows(scene, visible = false) {
    let axesArrows = [];
    [
        { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },  // X-axis: red
        { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },  // Y-axis: green
        { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff }   // Z-axis: blue
    ].forEach(({ dir, color }) => {
        const arrow = createArrow({
            dir: dir,
            color: color
        });
        arrow.visible = visible;  // default: invisible
        scene.add(arrow);
        axesArrows.push(arrow);
    });

    return axesArrows;
}