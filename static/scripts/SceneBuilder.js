/**
 * SceneBuilder.js
 * 
 * This module provides a set of functions and classes for building and managing celestial scenes 
 * in 3D space using the Three.js library. The primary focus is to create and manage celestial bodies, 
 * their orbits, and relevant visual elements such as orbital planes and axes arrows. 
 * It also offers utilities for adding lights, backgrounds, and other scene elements to enhance 
 * the visualization of celestial systems.
 * 
 * Key Features:
 * - **Celestial Body Representation**: A `CelestialBody` class that handles the creation of 3D celestial bodies, 
 *   including their geometry, textures, and orbital elements.
 * - **Orbit and Orbital Elements**: Functions to generate and visualize orbits based on semi-major axis, 
 *   eccentricity, and other orbital parameters.
 * - **Scene Utilities**: Factory functions for adding lights, background spheres, planes, and 3D axes arrows to the scene.
 * 
 * Dependencies:
 * - This module relies on the `THREE.js` library for rendering 3D graphics and performing vector and matrix operations.
 * - It also depends on additional modules like `OrbitalMechanics.js` for rotation calculations and `Resources.js` for scaling factors.
 * 
 * Usage:
 * - This module is designed for applications where 3D visualization of celestial bodies and orbital mechanics 
 *   is required, such as astronomy simulations, educational tools, or space mission planning software.
 * 
 * Exports:
 * - `CelestialBody`: A class for representing celestial bodies in 3D space.
 * - Factory functions like `createLight`, `createBackground`, `createPlane`, and `createArrow` for adding 3D elements to the scene.
 * - Utility functions like `addEclipticPlane` and `addAxesArrows` for visualizing coordinate systems and celestial planes.
 */


import { rotateOrbit } from './OrbitalMechanics.js';
import { spaceScale } from './Resources.js';

/**
 * Class representing a celestial body in the 3D scene.
 * The `CelestialBody` class initializes various properties of the celestial body, 
 * such as its name, radius, orbital elements, and more. It also creates the 3D mesh 
 * representing the celestial body and calculates its orbit based on the provided data.
 */
export class CelestialBody {
    
    /**
     * Create a celestial body.
     * The constructor initializes the body’s properties and adds it to the scene. 
     * It also handles the creation of orbital elements and visuals for artificial objects and planets.
     * 
     * @param {THREE.Scene} scene - The 3D scene where the celestial body will be added.
     * @param {Object} data - The data object containing properties like name, radius, and orbital elements.
     * @param {Object} [textures=null] - Optional texture paths for mapping textures to the celestial body.
     */
    constructor(scene, data, textures = null) {
        this.scene = scene;

        this.name = data.name || 'Unnamed';  // The name of the celestial body, default is 'Unnamed'
        this.radius = data.radius || 1;  // The radius of the celestial body, default is 1
        this.orbitalElements = data.orbitalElements || {};  // Orbital elements such as semi-major axis and eccentricity
        this.category = data.category || 'small body';  // Category of the body (e.g., planet, small body)
        this.subclass = data.subclass || 'NEO';  // Subclass (e.g., NEO, artificial)
        this.opacity = data.opacity || 1.0;  // Opacity of the body's material
        this.color = data.color || 0x404040;  // Color of the celestial body

        this.textures = textures || null;  // Optional textures for the body
        // Set texture path for the body if textures are provided
        if (textures) {
            this.texturesPath = this.textures[this.name.toUpperCase()];
        }
        
        this.container = new THREE.Object3D();  // Container for the body and related elements
        this.label = null;  // Placeholder for the label
        this.orbit = null;  // Placeholder for the orbit

        // Special handling for Mercury in the education module to represent orbital period (Kepler's 2nd Law)
        if (this.name === 'Mercury') {
            this.sweptAreaGroup = new THREE.Group();  // Group for swept areas
            this.sweptAreaGroup.visible = false;
        }

        // Create the body mesh and add it to the scene
        this.createBody();

        // If this is not the Sun, compute additional orbital elements
        if (this.name != 'Sun') {
            const { a, e } = this.orbitalElements;

            // Validate semi-major axis (a) and eccentricity (e) before computing further elements
            if (a && e && !isNaN(a) && !isNaN(e)) {
                this.period = Math.sqrt(a ** 3);  // Compute orbital period using Kepler's 3rd Law
                this.orbitalElements.q = a * (1 - e);  // Perihelion distance (closest approach to the Sun)
                this.orbitalElements.Q = a * (1 + e);  // Apohelion distance (farthest point from the Sun)
            } else {
                console.error(`Invalid orbital elements for ${this.name}: a = ${a} or e = ${e} is not a valid number`);
            }

            // If the object is an artificial satellite or asteroid, generate orbit and orbital plane
            if (this.subclass === 'artificial') {
                this.orbit = this.createOrbit(300, true);  // Create orbit with 300 points and visibility set to true
                this.orbitalPlane = this.addOrbitalPlane(this.orbitalElements.h_vec, true);  // Create orbital plane
                this.orbitalVectors = this.addOrbitalVectors(true);  // Create orbital vectors
                this.label.visible = true;
            } 
            // Otherwise, just create the orbit (default behavior for planets, moons, etc.)
            else { 
                this.orbit = this.createOrbit();
            }
        }
    }

    /**
     * Create the 3D body of the celestial object and add it to the scene.
     * This function generates the geometry and material for the object, applies texture if available,
     * and adds special features like rings for planets such as Saturn.
     * 
     * - For small bodies or objects without textures, a basic color is used.
     * - If the object is the Sun, emissive properties are applied to simulate self-illumination.
     * - If the object is Saturn, rings are added with specific dimensions.
     * 
     * @see https://threejs.org/docs/#api/en/geometries/SphereGeometry
     * @see https://threejs.org/docs/#api/en/materials/MeshStandardMaterial
     */
    createBody() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        let material;

        // Determine the material based on the object category and texture availability
        if (this.category === 'small body' || !this.texturesPath) {
            material = new THREE.MeshStandardMaterial({ color: this.color });
        } else {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(this.texturesPath);

            // Apply specific properties if the object is the Sun
            if (this.name === 'Sun') {
                material = new THREE.MeshStandardMaterial({
                    map: texture,               
                    roughness: 0,
                    metalness: 0,
                    emissive: 0xffff00,     // Self-illumination
                    emissiveIntensity: 1.0,     
                    emissiveMap: texture        
                });
            } else {
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0,
                    metalness: 0,
                    emissive: 0x000000  // No self-illumination
                });
            }
        }

        // Create the mesh and add it to the scene
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.container.add(mesh);
        this.scene.add(this.container);

        // If the object is Saturn, add rings
        if (this.name === 'Saturn') {
            this.createRing(1.24, 2.27, this.textures['SATURN_RING']);
        }

        // Add a label to the object
        this.label = this.addLabel(mesh, this.name);
    }

    /**
     * Add a label to the celestial object and attach it to the scene.
     * The label is created using HTML elements and placed in 3D space relative to the object.
     * It is initially invisible unless specified.
     * 
     * @param {THREE.Mesh} mesh - The 3D mesh object to which the label will be attached.
     * @param {string} name - The name of the celestial object to display on the label.
     * @param {boolean} [visible=false] - Whether the label should be initially visible.
     * @returns {THREE.CSS2DObject} - The label object that was created and added to the scene.
     * @see https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer
     */
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


    /**
     * Create a ring around the celestial object and add it to the scene.
     * This function generates a ring with specified inner and outer radii, applies a texture, and adds it
     * to the object (e.g., for Saturn, Jupiter, Uranus, or Neptune).
     * 
     * The ring's texture is loaded and applied to give it the realistic appearance of planetary rings.
     * 
     * @param {number} inner - The inner radius of the ring relative to the object's radius.
     * @param {number} outer - The outer radius of the ring relative to the object's radius.
     * @param {string} ringTexturePath - Path to the texture for the ring.
     * @see https://threejs.org/docs/#api/en/geometries/RingBufferGeometry
     */
    createRing(inner, outer, ringTexturePath) {
        const innerRadius = this.radius * inner;
        const outerRadius = this.radius * outer;

        const ringGeometry = new THREE.RingBufferGeometry(innerRadius, outerRadius, 64);
        var pos = ringGeometry.attributes.position;
        var v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++){
            v3.fromBufferAttribute(pos, i);
            ringGeometry.attributes.uv.setXY(i, v3.length() < (innerRadius + outerRadius) / 2 ? 0 : 1, 1);
        }

        const ringTexture = new THREE.TextureLoader().load(ringTexturePath);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,  // White color for transparency
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true,
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;  // Rotate the ring to lie flat
        this.container.add(ring);
    }


    /**
     * Create an orbit based on the object's orbital elements.
     * This function generates points along the orbit path (elliptical, parabolic, or hyperbolic)
     * and returns a 3D line representing the orbit.
     * 
     * @param {number} numPoints - The number of points to generate along the orbit.
     * @param {boolean} visible - Whether the orbit line is initially visible.
     * @returns {THREE.Object3D} — A container holding the orbit line.
     * @see https://en.wikipedia.org/wiki/Conic_section#Conic_parameters
     */
    createOrbit(numPoints = 100, visible = false) {
        const { a, e, i, om, w } = this.orbitalElements;
        const aScaled = a * spaceScale;
        
        let points = [];
        if (e >= 0 && e < 1) {
            // Circular or elliptical orbit
            this.orbitShape = (e === 0) ? 'circular' : 'elliptical';
            const b = aScaled * Math.sqrt(1 - e ** 2);  // Semi-minor axis (b)
            const ellipseCurve = new THREE.EllipseCurve(
                aScaled * e, 0, // Center offset for elliptical orbit
                aScaled, b,
                0, 2 * Math.PI,
                false,
                0
            );
            points = ellipseCurve.getPoints(numPoints);
        } else if (e === 1) { // Parabolic orbit
            this.orbitShape = 'parabolic';
            const p = aScaled * (1 + e);  // latus rectum
            for (let theta = -Math.PI / 2; theta <= Math.PI / 2; theta += Math.PI / numPoints) {
                const r = p / (1 + Math.cos(theta));
                points.push(new THREE.Vector3(-r * Math.cos(theta), 0, r * Math.sin(theta)));
            }
        } else if (e > 1) { // Hypebolic orbit
            this.orbitShape = 'hyperbolic';
            const b = aScaled * Math.sqrt(e ** 2 - 1);
            for (let theta = -Math.PI / 4; theta <= Math.PI / 4; theta += Math.PI / (2 * numPoints)) {
                const r = aScaled * (e ** 2 - 1) / (1 + e * Math.cos(theta));
                points.push(new THREE.Vector3(-r * Math.cos(theta), 0, r * Math.sin(theta)));
            }
        } else {
            alert('Invalid eccentricity!');
            this.orbitShape = null;
            return;
        }
    
        // Convert points to 3D space and apply transformations
        const transformedPoints = points.map(p => new THREE.Vector3(-p.x, 0, p.y));
    
        // Create a 3D line representing the orbit
        const geometry = new THREE.BufferGeometry().setFromPoints(transformedPoints);
        const material = new THREE.LineBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: this.opacity,
        });
        const orbitLine = new THREE.Line(geometry, material);
    
        // Place the orbit line into a container
        const orbitContainer = new THREE.Object3D();
        orbitContainer.add(orbitLine);
    
        // Apply orbital rotations to align the orbit in 3D space
        rotateOrbit(orbitContainer, i, om, w);
    
        orbitContainer.visible = visible;
        this.scene.add(orbitContainer);

        return orbitContainer;
    }


    /**
     * Create an orbital plane for the celestial object.
     * This function creates a semi-transparent plane that represents the orbital plane of the object
     * in 3D space, based on the provided normal vector.
     * 
     * @param {THREE.Vector3} normalVector - The normal vector to define the plane's orientation.
     * @param {boolean} [visible=false] - Whether the orbital plane should be initially visible.
     * @returns {THREE.Mesh} - The created orbital plane mesh added to the scene.
     */
    addOrbitalPlane(normalVector, visible = false) {
        const planeSize = this.orbitalElements.Q * 2.5 * spaceScale;  // Determine the size of the plane
        const plane = createPlane({
            normalVector: normalVector,  // Orientation of the plane
            width: planeSize,
            height: planeSize,
            color: this.color,  // Color of the plane
            opacity: 0.1,       // Make the plane semi-transparent
            transparent: true,
            visible: visible
        });

        this.scene.add(plane);  // Add the plane to the scene

        return plane;
    }


    /**
     * Create auxilary orbital vectors for the celestial object.
     * This function creates three vectors representing the specific angular momentum (h_vec),
     * eccentricity vector (e_vec), and the node vector (n_vec) for the object's orbit, with distinct colors.
     * 
     * @param {boolean} [visible=false] - Whether the orbital vectors should be initially visible.
     * @returns {THREE.ArrowHelper[]} - An array of arrow helpers representing the orbital vectors added to the scene.
     * @see https://en.wikipedia.org/wiki/Orbit_determination#Orbit_determination_from_a_state_vector
     */
    addOrbitalVectors(visible = false) {
        const orbitalVectors = [];
        const { h_vec, e_vec, n_vec } = this.orbitalElements;  // Destructure the vectors from orbital elements
        const vectorColors = [0xffff00, 0xee0000, 0x0000ff];  // Assign colors: yellow, red, blue

        // Create an arrow for each vector and add it to the scene
        [h_vec, e_vec, n_vec].forEach((vec, i) => {
            const orbitalVector = createArrow({
                dir: vec,  // Direction of the vector
                length: 1 * spaceScale,  // Scaled length of the vector
                color: vectorColors[i],  // Color of the vector
                visible: true
            });
            this.scene.add(orbitalVector);  // Add the vector to the scene
            orbitalVectors.push(orbitalVector);  // Store the vector in the array
        });

        return orbitalVectors;  // Return the array of vectors
    }
}


// --------------------------------------
// Factory Functions for Scene Elements
// --------------------------------------


/**
 * Add a light source to the scene based on the specified type.
 * This function creates either a point light (e.g., for the sun) or an ambient light,
 * and adds it to the 3D scene.
 * 
 * @param {THREE.Scene} scene - The scene to which the light will be added.
 * @param {string} [type='ambient'] - The type of light ('sun' for point light, 'ambient' for ambient light).
 * @param {Object} [options={}] - Options for customizing the light, such as intensity and range.
 * @see https://threejs.org/docs/#api/en/lights/PointLight
 * @see https://threejs.org/docs/#api/en/lights/AmbientLight
 */
export function createLight(scene, type = 'ambient', options = {}) {
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

    if (light) scene.add(light); // Add the light to the scene
}


/**
 * Create a spherical background with a texture or color and add it to the scene.
 * This function applies a galactic to ecliptic rotation to the background sphere.
 * 
 * @param {THREE.Scene} scene - The scene to which the background will be added.
 * @param {number} radius - The radius of the background sphere.
 * @param {string} [texturePath=null] - Path to the texture for the background (if any).
 * @see https://threejs.org/docs/#api/en/geometries/SphereGeometry
 */
export function createBackground(scene, radius, texturePath) {
    const textureLoader = new THREE.TextureLoader();
    const geometry = new THREE.SphereGeometry(radius, 60, 40);

    const params = texturePath ? { 
        map: textureLoader.load(texturePath), // Load the background texture
        side: THREE.BackSide 
    } : { 
        color: 0x000000, // Use black background if no texture is provided
        side: THREE.BackSide
    };

    const material = new THREE.MeshBasicMaterial(params);
    const backgroundSphere = new THREE.Mesh(geometry, material);

    // Apply galactic to ecliptic rotation
    const eulerAngles = new THREE.Euler(62.87 / 180 * Math.PI, 0, -282.86 / 180 * Math.PI);
    backgroundSphere.quaternion.setFromEuler(eulerAngles);

    scene.add(backgroundSphere);
}


/**
 * Create a plane in 3D space based on the provided parameters.
 * This function generates a plane with specific width, height, and orientation, and adds it to the scene.
 * 
 * @param {Object} options - The options for the plane creation, including width, height, and color.
 * @param {number} [options.width=1200] - The width of the plane.
 * @param {number} [options.height=1200] - The height of the plane.
 * @param {number} [options.color=0xffffff] - The color of the plane.
 * @param {number} [options.opacity=0.1] - The opacity of the plane (for transparency).
 * @param {THREE.Vector3} [options.normalVector=null] - The normal vector to define the plane's orientation.
 * @param {boolean} [options.transparent=true] - Whether the plane material is transparent.
 * @param {boolean} [options.visible=false] - Whether the plane is visible by default.
 * @returns {THREE.Mesh} - The created plane mesh.
 * @throws {Error} If neither rotation nor normalVector are provided.
 * @see https://threejs.org/docs/#api/en/geometries/PlaneGeometry
 */
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


/**
 * Create an arrow (vector) in 3D space and return it as a THREE.ArrowHelper object.
 * This function creates an arrow that can be used to represent vectors such as velocity or force.
 * 
 * @param {Object} options - Options for the arrow creation.
 * @param {THREE.Vector3} [options.dir=new THREE.Vector3(1, 0, 0)] - The direction of the arrow.
 * @param {THREE.Vector3} [options.origin=new THREE.Vector3(0, 0, 0)] - The origin of the arrow.
 * @param {number} [options.length=null] - The length of the arrow (default is the length of the direction vector).
 * @param {number} [options.color=0xffffff] - The color of the arrow.
 * @param {number} [options.headLength=4] - The length of the arrow head.
 * @param {number} [options.headWidth=2] - The width of the arrow head.
 * @param {boolean} [options.visible=false] - Whether the arrow is visible by default.
 * @returns {THREE.ArrowHelper} - The created arrow helper object.
 * @see https://threejs.org/docs/#api/en/helpers/ArrowHelper
 */
export function createArrow({ 
    dir = new THREE.Vector3(1, 0, 0), 
    origin = new THREE.Vector3(0, 0, 0),
    length = null, 
    color = 0xffffff, 
    headLength = 4,
    headWidth = 2,
    visible = false 
} = {}) {
    const arrowLength = length || (dir.length() * spaceScale);
    const unitVector = dir.clone().normalize();
    const arrowHelper = new THREE.ArrowHelper(
        unitVector, origin, arrowLength, color, headLength, headWidth
    );
    arrowHelper.visible = visible;
    return arrowHelper;
}


// --------------------------------------
// Helper Factory Functions for Scene Elements
// --------------------------------------


/**
 * Add the ecliptic plane to the scene.
 * This function creates a plane representing the ecliptic plane (xy-plane) with a 90-degree rotation
 * to align with the 3D scene's coordinate system, and adds it to the provided scene.
 * 
 * @param {THREE.Scene} scene - The scene to which the ecliptic plane will be added.
 * @param {boolean} [visible=false] - Whether the ecliptic plane should be initially visible.
 * @returns {THREE.Mesh} - The created ecliptic plane mesh added to the scene.
 * @see https://threejs.org/docs/#api/en/geometries/PlaneGeometry
 */
export function addEclipticPlane(scene, visible = false) {
    const eclipticPlane = createPlane({ 
        rotation: { x: Math.PI / 2 },  // Rotate the plane to align with the ecliptic plane
        visible: visible
    });
    scene.add(eclipticPlane);  // Add the plane to the scene
    return eclipticPlane;
}


/**
 * Add arrows representing the 3D axes (X, Y, Z) to the scene.
 * This function creates three arrows (red for X-axis, green for Y-axis, and blue for Z-axis)
 * and adds them to the scene to help visualize the 3D coordinate system.
 * 
 * @param {THREE.Scene} scene - The scene to which the axis arrows will be added.
 * @param {boolean} [visible=false] - Whether the axis arrows should be initially visible.
 * @returns {THREE.ArrowHelper[]} - An array of arrow helpers representing the 3D axes added to the scene.
 * @see https://threejs.org/docs/#api/en/helpers/ArrowHelper
 */
export function addAxesArrows(scene, visible = false) {
    let axesArrows = [];
    [
        { dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },  // X-axis: red
        { dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },  // Y-axis: green
        { dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff }   // Z-axis: blue
    ].forEach(({ dir, color }) => {
        const arrow = createArrow({
            dir: dir,  // Direction of the axis
            color: color  // Color of the arrow
        });
        arrow.visible = visible;  // Set visibility based on parameter
        scene.add(arrow);  // Add arrow to the scene
        axesArrows.push(arrow);  // Store arrow in the array
    });

    return axesArrows;
}