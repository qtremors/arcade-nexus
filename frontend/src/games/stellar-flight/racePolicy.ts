import * as THREE from "three";
import { ROUTES } from "./routes";
import { SectorStream, type Coordinates } from "./universe";
export function planRoute({
  position,
  rotationValue,
  seed,
  speed,
  style,
  maxSpeed,
  first,
}: {
  position: THREE.Vector3;
  rotationValue: THREE.Quaternion;
  seed: number;
  speed: number;
  style: number;
  maxSpeed: number;
  first: boolean;
}) {
  const yawAxis = new THREE.Vector3(0, 1, 0),
    pitchAxis = new THREE.Vector3(1, 0, 0);
  const gates: {
    position: Coordinates;
    rotation: [number, number, number, number];
  }[] = [];
  const point = position.clone();
  const rotation = rotationValue.clone();
  const routeSectors = new SectorStream();
  const spacing = Math.max(550, speed * 3);
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      rotation.multiply(
        new THREE.Quaternion().setFromAxisAngle(yawAxis, ROUTES[style].yaw[i]),
      );
      rotation.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          pitchAxis,
          ROUTES[style].pitch[i],
        ),
      );
    }
    const step = new THREE.Vector3(
      0,
      0,
      i === 0 && first ? 500 : spacing,
    ).applyQuaternion(rotation);
    point.add(step);
    // Rings sit outside solid bodies; their connecting flight path still requires piloting.
    for (const sector of routeSectors.nearby(
      point.toArray() as Coordinates,
      seed,
    )) {
      for (const body of [
        ...sector.asteroids,
        ...(sector.planet ? [sector.planet] : []),
      ]) {
        const away = point.clone().sub(new THREE.Vector3(...body.position));
        if (away.length() < body.radius + 100) {
          if (away.lengthSq() === 0) away.set(1, 0, 0);
          point.copy(
            new THREE.Vector3(...body.position).add(
              away.setLength(body.radius + 100),
            ),
          );
        }
      }
    }
    gates.push({
      position: point.toArray() as Coordinates,
      rotation: rotation.toArray() as [number, number, number, number],
    });
  }
  let length = 0,
    previous = position.clone();
  for (const gate of gates) {
    const next = new THREE.Vector3(...gate.position);
    length += previous.distanceTo(next);
    previous = next;
  }
  return { gates, length, par: length / (maxSpeed * 0.65) + 2 };
}
export function evaluateRace(
  passed: number,
  time: number,
  par: number,
  length: number,
) {
  const clean = passed === 5;
  const medal =
    clean && time <= par ? "gold" : passed >= 4 ? "silver" : "bronze";
  const points =
    (clean ? 3000 : 1000) + Math.max(0, Math.floor((par - time) * 80));
  return {
    clean,
    medal,
    points,
    pace: time / Math.max(0.1, length / 1000),
  } as const;
}
