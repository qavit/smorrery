let color_flag = true;

export const EARTH_SIDEREAL_YEAR = 365.256363004 * 86400 * 1000; // https://hpiers.obspm.fr/eop-pc/models/constants.html
export const SWEPT_AREAS_AMOUNT = 6;

export function createSweptArea(scene, planet, points) {
  const material = new THREE.MeshBasicMaterial({
    color: color_flag ? 0xff0000 : 0x0000ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  color_flag = !color_flag;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  console.log(points)
  points.forEach(function (point) {
    shape.lineTo(point.x, point.z);
  });
  shape.lineTo(0, 0);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const sweptArea = new THREE.Mesh(geometry, material);
  const container = new THREE.Object3D();
  // const rotationMatrix = new THREE.Matrix4();
  // applyOrbitalRotations(rotationMatrix, planet.i, planet.om, planet.varpi);
  // container.applyMatrix4(rotationMatrix)
  container.visible = document.getElementById("showSweptArea").checked;
  container.add(sweptArea);
  scene.add(container);
  planet.sweptAreas.push(container);
  if (planet.sweptAreas.length >= SWEPT_AREAS_AMOUNT) {
    const item = planet.sweptAreas.shift();
    scene.remove(item);
  }
}
