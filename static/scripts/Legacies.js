
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
 
         // Remove the existing path line from the scene
         if (object.traceLine) {
             scene.remove(object.traceLine);
             object.traceLine = null; // Reset the path line reference
         }
     });
 }

 function calculateDistanceToMouse(container) {
    // Get world position of the container
    const containerPosition = new THREE.Vector3();

    // Ensure the container is initialized
    if (container) {
        container.getWorldPosition(containerPosition);
    } else {
        console.error('Container not initialized');
        return;
    }
    
    // Create ray from mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate distance from mouse ray to container position
    return raycaster.ray.distanceToPoint(containerPosition);
}
