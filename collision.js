// collision.js - Collision detection system

class CollisionSystem {
    constructor() {
        this.colliders = [];
    }

    addCollider(collider) {
        this.colliders.push(collider);
    }

    checkCollisions(object) {
        for (const collider of this.colliders) {
            if (collider.checkCollision(object)) {
                return collider.resolveCollision(object);
            }
        }
        return null;
    }

    // Check if a point collides with any capsule colliders
    checkPointCollision(point) {
        for (const collider of this.colliders) {
            if (collider instanceof CapsuleCollider) {
                if (collider.checkCollision(point)) {
                    return collider.resolveCollision(point);
                }
            }
        }
        return null;
    }
}

class CapsuleCollider {
    constructor(ybot, radiusMultiplier = 1.0) {
        this.ybot = ybot;
        this.radiusMultiplier = radiusMultiplier;
        this.capsules = [];
        this.createBoneCapsules();
    }

    calculateBoneRadius(bone, child, length) {
        const boneName = bone.name.toLowerCase();
        let baseRadius;

        // Different radius calculations based on bone type for capsules
        if (boneName.includes('spine') || boneName.includes('neck') || boneName.includes('head')) {
            // Torso bones - medium thickness
            baseRadius = Math.max(0.03, length * 0.12);
        } else if (boneName.includes('arm') || boneName.includes('forearm') || boneName.includes('hand')) {
            // Arm bones - thinner
            baseRadius = Math.max(0.025, length * 0.08);
        } else if (boneName.includes('leg') || boneName.includes('upleg') || boneName.includes('foot')) {
            // Leg bones - thicker for weight-bearing
            baseRadius = Math.max(0.035, length * 0.15);
        } else if (boneName.includes('shoulder') || boneName.includes('clavicle')) {
            // Shoulder bones - medium joints
            baseRadius = Math.max(0.03, length * 0.18);
        } else if (boneName.includes('hips') || boneName.includes('pelvis')) {
            // Hip bones - thickest for core stability
            baseRadius = Math.max(0.05, length * 0.20);
        } else {
            // Default for unknown bones
            baseRadius = Math.max(0.02, length * 0.08);
        }

        // Consider bone scale if available
        if (bone.scale) {
            const avgScale = (bone.scale.x + bone.scale.y + bone.scale.z) / 3;
            baseRadius *= Math.max(0.5, Math.min(2.0, avgScale)); // Scale radius by bone scale, clamped
        }

        return baseRadius * this.radiusMultiplier;
    }

    createBoneCapsules() {
        this.capsules = [];
        if (!this.ybot || !this.ybot.bones) return;

        // Ensure world matrices are up to date
        if (this.ybot.object3D) {
            this.ybot.object3D.updateMatrixWorld(true);
        }

        console.log('CapsuleCollider: Creating capsules for', this.ybot.bones.length, 'bones');

        // Debug: Show some key bone positions
        const keyBones = ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
        keyBones.forEach(boneName => {
            const bone = this.ybot.bones.find(b => b.name === boneName);
            if (bone) {
                const pos = new THREE.Vector3();
                bone.getWorldPosition(pos);
                console.log(`Bone ${boneName}: y=${pos.y.toFixed(3)}`);
            }
        });

        this.ybot.bones.forEach(bone => {
            if (bone.children && bone.children.length > 0) {
                bone.children.forEach(child => {
                    if (child.isBone) {
                        const boneWorldPos = new THREE.Vector3();
                        const childWorldPos = new THREE.Vector3();
                        bone.getWorldPosition(boneWorldPos);
                        child.getWorldPosition(childWorldPos);

                        const direction = new THREE.Vector3().subVectors(childWorldPos, boneWorldPos);
                        const length = direction.length();

                        if (length > 0.001) {
                            // Calculate radius based on bone type and characteristics
                            const radius = this.calculateBoneRadius(bone, child, length);

                            this.capsules.push({
                                start: boneWorldPos.clone(),
                                end: childWorldPos.clone(),
                                radius: radius,
                                length: length,
                                bone: bone,
                                child: child
                            });

                            console.log(`Capsule: ${bone.name} -> ${child.name}, length: ${length.toFixed(3)}, radius: ${radius.toFixed(3)}`);
                        }
                    }
                });
            } else {
                console.log(`No capsule for ${bone.name} (no bone children)`);
            }
        });

        console.log(`CapsuleCollider: Created ${this.capsules.length} collision capsules`);
    }

    updateCapsules() {
        if (!this.ybot || !this.ybot.object3D) return;

        // Ensure world matrices are up to date
        this.ybot.object3D.updateMatrixWorld(true);

        this.capsules.forEach(capsule => {
            const boneWorldPos = new THREE.Vector3();
            const childWorldPos = new THREE.Vector3();
            capsule.bone.getWorldPosition(boneWorldPos);
            capsule.child.getWorldPosition(childWorldPos);

            capsule.start.copy(boneWorldPos);
            capsule.end.copy(childWorldPos);

            const direction = new THREE.Vector3().subVectors(childWorldPos, boneWorldPos);
            capsule.length = direction.length();
        });
    }

    checkCollision(object) {
        // Handle point collision (Vector3) - for external objects colliding with YBot
        if (object instanceof THREE.Vector3) {
            return this.pointToCapsuleDistance(object, this.capsules[0]) <= this.capsules[0].radius;
        }

        // For YBot object, capsule collision is handled separately
        // (we don't want YBot colliding with its own capsules)
        if (object && object.bones) {
            return false; // Don't collide YBot with its own capsules
        }

        return false;
    }

    pointToCapsuleDistance(point, capsule) {
        const { start, end, radius } = capsule;

        // Vector from start to end
        const axis = new THREE.Vector3().subVectors(end, start);
        const axisLength = axis.length();

        if (axisLength === 0) {
            // Degenerate capsule, check distance to start point
            return point.distanceTo(start) <= radius ? 0 : point.distanceTo(start) - radius;
        }

        axis.normalize();

        // Vector from start to point
        const startToPoint = new THREE.Vector3().subVectors(point, start);

        // Project point onto capsule axis
        const projection = startToPoint.dot(axis);

        // Clamp projection to capsule length (including the spherical caps)
        const clampedProjection = Math.max(0, Math.min(axisLength, projection));

        // Find closest point on capsule axis
        const closestPoint = new THREE.Vector3()
            .copy(axis)
            .multiplyScalar(clampedProjection)
            .add(start);

        // Distance from point to closest point on axis
        const distance = point.distanceTo(closestPoint);

        return distance <= radius ? 0 : distance - radius;
    }

    resolveCollision(object) {
        // Handle point collision (Vector3)
        if (object instanceof THREE.Vector3) {
            return this.resolvePointCollision(object);
        }

        // Handle YBot collision
        if (object && object.bones) {
            return this.resolveYBotCollision(object);
        }

        return null;
    }

    resolvePointCollision(point) {
        // Find the closest capsule and calculate resolution
        let closestCapsule = null;
        let minDistance = Infinity;

        for (const capsule of this.capsules) {
            const distance = this.pointToCapsuleDistance(point, capsule);
            if (distance < minDistance) {
                minDistance = distance;
                closestCapsule = capsule;
            }
        }

        if (closestCapsule) {
            const { start, end, radius } = closestCapsule;

            // Vector from start to end
            const axis = new THREE.Vector3().subVectors(end, start);
            axis.normalize();

            // Vector from start to point
            const startToPoint = new THREE.Vector3().subVectors(point, start);

            // Project point onto capsule axis
            const projection = startToPoint.dot(axis);
            const clampedProjection = Math.max(0, Math.min(axis.length(), projection));

            // Find closest point on capsule axis
            const closestPoint = new THREE.Vector3()
                .copy(axis)
                .multiplyScalar(clampedProjection)
                .add(start);

            // Calculate push direction
            const pushDirection = new THREE.Vector3().subVectors(point, closestPoint);
            const pushDistance = radius - pushDirection.length();

            if (pushDistance > 0) {
                pushDirection.normalize();
                pushDirection.multiplyScalar(pushDistance);

                return {
                    normal: pushDirection.clone().normalize(),
                    penetration: pushDistance,
                    point: closestPoint
                };
            }
        }

        return null;
    }

    resolveYBotCollision(ybot) {
        // Create capsules for YBot bones and check against environment capsules
        let totalPush = new THREE.Vector3();
        let collisionCount = 0;

        // Create YBot capsules from its bone hierarchy
        const ybotCapsules = this.createBoneCapsules(ybot.bones);

        // Check capsule-to-capsule collisions
        for (const ybotCapsule of ybotCapsules) {
            for (const envCapsule of this.capsules) {
                const collision = this.resolveCapsuleCollision(ybotCapsule, envCapsule);
                if (collision) {
                    totalPush.add(collision.normal.clone().multiplyScalar(collision.penetration));
                    collisionCount++;
                }
            }
        }

        if (collisionCount > 0) {
            totalPush.divideScalar(collisionCount);
            return {
                normal: totalPush.clone().normalize(),
                penetration: totalPush.length()
            };
        }

        return null;
    }

    resolveCapsuleCollision(capsuleA, capsuleB) {
        // Calculate closest points between two capsule axes
        const axisA = new THREE.Vector3().subVectors(capsuleA.end, capsuleA.start);
        const axisB = new THREE.Vector3().subVectors(capsuleB.end, capsuleB.start);

        const axisALength = axisA.length();
        const axisBLength = axisB.length();

        if (axisALength < 0.001) axisA.set(0, 1, 0);
        else axisA.divideScalar(axisALength);

        if (axisBLength < 0.001) axisB.set(0, 1, 0);
        else axisB.divideScalar(axisBLength);

        // Find closest points on both capsule axes
        const closestPoints = this.closestPointsBetweenLines(
            capsuleA.start, axisA, axisALength,
            capsuleB.start, axisB, axisBLength
        );

        const pointA = closestPoints.pointA;
        const pointB = closestPoints.pointB;

        // Calculate distance and direction
        const direction = new THREE.Vector3().subVectors(pointB, pointA);
        const distance = direction.length();
        const combinedRadius = capsuleA.radius + capsuleB.radius;

        if (distance >= combinedRadius) {
            return null; // No collision
        }

        // Calculate collision normal and penetration
        const penetration = combinedRadius - distance;

        if (distance < 0.001) {
            // Capsules are at the same point, use arbitrary normal
            direction.set(0, 1, 0);
        } else {
            direction.divideScalar(distance);
        }

        return {
            normal: direction,
            penetration: penetration
        };
    }

    closestPointsBetweenLines(startA, dirA, lengthA, startB, dirB, lengthB) {
        // Calculate closest points between two line segments
        const diff = new THREE.Vector3().subVectors(startB, startA);

        const a = dirA.dot(dirA); // Always 1 since normalized
        const b = dirA.dot(dirB);
        const c = dirB.dot(dirB); // Always 1 since normalized
        const d = dirA.dot(diff);
        const e = dirB.dot(diff);

        let s = 0, t = 0;

        if (a > 0.001 && c > 0.001) {
            const denom = a * c - b * b;
            if (Math.abs(denom) > 0.001) {
                s = Math.max(0, Math.min(lengthA, (b * e - c * d) / denom));
                t = Math.max(0, Math.min(lengthB, (a * e - b * d) / denom));
            }
        }

        const pointA = new THREE.Vector3()
            .copy(dirA)
            .multiplyScalar(s)
            .add(startA);

        const pointB = new THREE.Vector3()
            .copy(dirB)
            .multiplyScalar(t)
            .add(startB);

        return { pointA, pointB };
    }

    getVisualizationMeshes() {
        const meshes = [];
        const material = new THREE.MeshBasicMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });

        this.capsules.forEach(capsule => {
            // Create cylinder part of capsule
            const cylinderGeometry = new THREE.CylinderGeometry(capsule.radius, capsule.radius, capsule.length, 8);
            const cylinderMesh = new THREE.Mesh(cylinderGeometry, material);

            // Position and orient the cylinder
            const midpoint = new THREE.Vector3()
                .addVectors(capsule.start, capsule.end)
                .multiplyScalar(0.5);
            cylinderMesh.position.copy(midpoint);

            const direction = new THREE.Vector3().subVectors(capsule.end, capsule.start);
            cylinderMesh.lookAt(capsule.end);
            cylinderMesh.rotateX(Math.PI / 2); // Align cylinder along Y axis

            cylinderMesh.userData.capsule = capsule;
            meshes.push(cylinderMesh);

            // Create sphere at start
            const startSphereGeometry = new THREE.SphereGeometry(capsule.radius, 8, 6);
            const startSphereMesh = new THREE.Mesh(startSphereGeometry, material);
            startSphereMesh.position.copy(capsule.start);
            startSphereMesh.userData.capsule = capsule;
            meshes.push(startSphereMesh);

            // Create sphere at end
            const endSphereGeometry = new THREE.SphereGeometry(capsule.radius, 8, 6);
            const endSphereMesh = new THREE.Mesh(endSphereGeometry, material);
            endSphereMesh.position.copy(capsule.end);
            endSphereMesh.userData.capsule = capsule;
            meshes.push(endSphereMesh);
        });

        return meshes;
    }
}

class FloorCollider {
    constructor(yLevel = 0) {
        this.yLevel = yLevel;
        this.normal = new THREE.Vector3(0, 1, 0); // Upward normal
        this.radiusMultiplier = 1.0; // For capsule radius calculation
    }

    checkCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return false;

        // Create YBot capsules and check collision with ground plane
        const ybotCapsules = this.createBoneCapsules(ybot.bones);

        for (const capsule of ybotCapsules) {
            if (this.capsuleIntersectsGround(capsule)) {
                return true;
            }
        }

        return false;
    }

    capsuleIntersectsGround(capsule) {
        // Check if capsule intersects with ground plane (y = this.yLevel)
        const { start, end, radius } = capsule;

        // Find the lowest point on the capsule
        const lowestY = Math.min(start.y, end.y) - radius;

        // If the lowest point is below ground level, there's intersection
        return lowestY <= this.yLevel;
    }

    resolveCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return null;

        // Create YBot capsules and find collision with ground plane
        const ybotCapsules = this.createBoneCapsules(ybot.bones);

        let maxPenetration = 0;
        let hasCollision = false;

        for (const capsule of ybotCapsules) {
            if (this.capsuleIntersectsGround(capsule)) {
                const penetration = this.calculateCapsuleGroundPenetration(capsule);
                if (penetration > maxPenetration) {
                    maxPenetration = penetration;
                    hasCollision = true;
                }
            }
        }

        if (hasCollision && maxPenetration > 0.001) {
            // Push the entire YBot up by the maximum penetration
            ybot.object3D.position.y += maxPenetration;
            console.log(`FloorCollider: Pushed YBot up by ${maxPenetration.toFixed(3)} due to capsule collision`);
        }

        return {
            normal: this.normal,
            penetration: hasCollision ? maxPenetration : 0
        };
    }

    calculateCapsuleGroundPenetration(capsule) {
        const { start, end, radius } = capsule;

        // Find the lowest point on the capsule
        const lowestY = Math.min(start.y, end.y) - radius;

        // Calculate penetration (how far below ground level)
        const penetration = this.yLevel - lowestY;

        return Math.max(0, penetration);
    }

    createBoneCapsules(bones) {
        const capsules = [];

        // Create a map of bones for quick lookup
        const boneMap = new Map();
        bones.forEach(bone => boneMap.set(bone.name, bone));

        bones.forEach(bone => {
            // Find child bones (bones this bone connects to)
            const childBones = bone.children ? bone.children.filter(child => child.isBone) : [];

            childBones.forEach(child => {
                const start = new THREE.Vector3();
                const end = new THREE.Vector3();

                bone.getWorldPosition(start);
                child.getWorldPosition(end);

                const length = start.distanceTo(end);
                if (length > 0.001) { // Only create capsules for meaningful connections
                    const radius = this.calculateBoneRadius(bone, child, length);

                    capsules.push({
                        start: start,
                        end: end,
                        radius: radius,
                        length: length,
                        boneA: bone,
                        boneB: child
                    });
                }
            });
        });

        return capsules;
    }

    calculateBoneRadius(bone, child, length) {
        const boneName = bone.name.toLowerCase();
        let baseRadius;

        // Different radius calculations based on bone type for capsules
        if (boneName.includes('spine') || boneName.includes('neck') || boneName.includes('head')) {
            // Torso bones - medium thickness
            baseRadius = Math.max(0.03, length * 0.12);
        } else if (boneName.includes('arm') || boneName.includes('forearm') || boneName.includes('hand')) {
            // Arm bones - thinner
            baseRadius = Math.max(0.02, length * 0.08);
        } else if (boneName.includes('leg') || boneName.includes('upleg') || boneName.includes('foot')) {
            // Leg bones - thicker for stability
            baseRadius = Math.max(0.025, length * 0.15);
        } else if (boneName.includes('shoulder')) {
            // Shoulder bones - medium
            baseRadius = Math.max(0.025, length * 0.10);
        } else {
            // Default for other bones
            baseRadius = Math.max(0.02, length * 0.10);
        }

        return baseRadius * this.radiusMultiplier;
    }
}