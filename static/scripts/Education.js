let previousPoint = null; // Global variable to store the previous point

export function createSweptArea(object, point, sweptAreaPhase) {
    // Return early if this is the first point (no previous point available)
    if (!previousPoint) {
        previousPoint = point.clone(); // Store the first point and wait for the next call
        return;
    }

    // Material for the swept area (same color logic: magenta for even, cyan for odd)
    const material = new THREE.MeshBasicMaterial({
        color: sweptAreaPhase % 2 === 0 ? 0xff00ff : 0x00ffff, // Even = magenta, Odd = cyan
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
    });

    // Define vertices for the triangle in 3D space: (0, 0, 0), previousPoint, and current point
    const vertices = new Float32Array([
        0, 0, 0,                      // Origin (Sun) at (0, 0, 0)
        previousPoint.x, previousPoint.y, previousPoint.z,  // Previous point in 3D space
        point.x, point.y, point.z      // Current point in 3D space
    ]);

    // Create BufferGeometry and add the vertices
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Define the indices for the triangle (0, 1, 2 correspond to the vertex positions)
    const indices = [0, 1, 2];
    geometry.setIndex(indices);

    const sweptArea = new THREE.Mesh(geometry, material);
    object.sweptAreaGroup.add(sweptArea);

    // Add the group to the scene if it's not already there
    if (!object.scene.children.includes(object.sweptAreaGroup)) {
        object.scene.add(object.sweptAreaGroup);
    }

    // Update the previous point to the current point for the next call
    previousPoint = point.clone();
}
