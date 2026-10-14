import * as THREE from "three";

interface Rock {
  matrix: THREE.Matrix4;
  sphere: THREE.Sphere;
  color: THREE.Color;
}

/** One draw call, uploading only rocks whose full bounding sphere intersects the view. */
export class AsteroidField extends THREE.InstancedMesh {
  private rocks: Rock[] = [];
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private previousProjection = new THREE.Matrix4();
  private visibleRocks: Rock[] = [];
  private invalidated = true;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
  ) {
    super(geometry, material, capacity);
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.frustumCulled = false; // Individual spheres are culled below.
    this.count = 0;
  }

  setRocks(rocks: Rock[]): void {
    this.rocks = rocks;
    this.visibleRocks.length = 0;
    this.invalidated = true;
  }

  updateView(camera: THREE.Camera): void {
    this.updateMatrixWorld();
    // Transform the view into the field's local coordinates, avoiding per-rock allocations.
    this.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.projection.multiply(this.matrixWorld);
    if (!this.invalidated && this.projection.equals(this.previousProjection))
      return;
    this.previousProjection.copy(this.projection);
    this.invalidated = false;
    this.frustum.setFromProjectionMatrix(this.projection);
    let visible = 0,
      firstChanged = Infinity,
      lastChanged = -1;
    for (const rock of this.rocks) {
      if (!this.frustum.intersectsSphere(rock.sphere)) continue;
      if (this.visibleRocks[visible] !== rock) {
        this.setMatrixAt(visible, rock.matrix);
        this.setColorAt(visible, rock.color);
        this.visibleRocks[visible] = rock;
        firstChanged = Math.min(firstChanged, visible);
        lastChanged = visible;
      }
      visible++;
    }
    this.count = visible;
    this.visibleRocks.length = visible;
    if (lastChanged < 0) return;
    // Keep pending ranges until Three uploads them; multiple updates can precede a draw.
    const changed = lastChanged - firstChanged + 1;
    this.instanceMatrix.addUpdateRange(firstChanged * 16, changed * 16);
    this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) {
      this.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.instanceColor.addUpdateRange(firstChanged * 3, changed * 3);
      this.instanceColor.needsUpdate = true;
    }
  }
}
