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

    // Check if a point collides with any cylinder colliders
    checkPointCollision(point) {
        for (const collider of this.colliders) {
            if (collider instanceof CylinderCollider) {
                if (collider.checkCollision(point)) {
                    return collider.resolveCollision(point);
                }
            }
        }
        return null;
    }
}

class CylinderCollider {
    constructor(ybot, radiusMultiplier = 1.0) {
        this.ybot = ybot;
        this.radiusMultiplier = radiusMultiplier;
        this.cylinders = [];
        this.createBoneCylinders();
    }

    calculateBoneRadius(bone, child, length) {
        const boneName = bone.name.toLowerCase();
        let baseRadius;

        // Different radius calculations based on bone type
        if (boneName.includes('spine') || boneName.includes('neck') || boneName.includes('head')) {
            // Torso bones - thicker for stability
            baseRadius = Math.max(0.03, length * 0.15);
        } else if (boneName.includes('arm') || boneName.includes('forearm') || boneName.includes('hand')) {
            // Arm bones - medium thickness
            baseRadius = Math.max(0.025, length * 0.12);
        } else if (boneName.includes('leg') || boneName.includes('upleg') || boneName.includes('foot')) {
            // Leg bones - thicker for weight-bearing
            baseRadius = Math.max(0.035, length * 0.18);
        } else if (boneName.includes('shoulder') || boneName.includes('clavicle')) {
            // Shoulder bones - wider joints
            baseRadius = Math.max(0.04, length * 0.2);
        } else if (boneName.includes('hips') || boneName.includes('pelvis')) {
            // Hip bones - thickest for core stability
            baseRadius = Math.max(0.05, length * 0.25);
        } else {
            // Default for unknown bones
            baseRadius = Math.max(0.02, length * 0.1);
        }

        // Consider bone scale if available
        if (bone.scale) {
            const avgScale = (bone.scale.x + bone.scale.y + bone.scale.z) / 3;
            baseRadius *= Math.max(0.5, Math.min(2.0, avgScale)); // Scale radius by bone scale, clamped
        }

        // Consider distance to sibling bones for more realistic proportions
        const siblingRadius = this.estimateRadiusFromSiblings(bone, length);
        if (siblingRadius > 0) {
            baseRadius = Math.min(baseRadius, siblingRadius * 1.2); // Don't exceed sibling-based estimate too much
        }

        return baseRadius * this.radiusMultiplier;
    }

    estimateRadiusFromSiblings(bone, length) {
        if (!bone.parent || !bone.parent.children) return 0;

        let totalRadius = 0;
        let siblingCount = 0;

        // Check sibling bones at the same level
        bone.parent.children.forEach(sibling => {
            if (sibling !== bone && sibling.isBone && sibling.children && sibling.children.length > 0) {
                sibling.children.forEach(child => {
                    if (child.isBone) {
                        const siblingLength = sibling.position.distanceTo(child.position);
                        if (siblingLength > 0.01) {
                            // Estimate radius based on sibling bone proportions
                            const siblingRadius = Math.max(0.02, siblingLength * 0.08);
                            totalRadius += siblingRadius;
                            siblingCount++;
                        }
                    }
                });
            }
        });

        return siblingCount > 0 ? totalRadius / siblingCount : 0;
    }

    createBoneCylinders() {
        this.cylinders = [];
        if (!this.ybot || !this.ybot.bones) return;

        // Ensure world matrices are up to date
        if (this.ybot.object3D) {
            this.ybot.object3D.updateMatrixWorld(true);
        }

        console.log('CylinderCollider: Creating cylinders for', this.ybot.bones.length, 'bones');

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

                            this.cylinders.push({
                                start: boneWorldPos.clone(),
                                end: childWorldPos.clone(),
                                radius: radius,
                                length: length,
                                bone: bone,
                                child: child
                            });

                            console.log(`Cylinder: ${bone.name} -> ${child.name}, length: ${length.toFixed(3)}, radius: ${radius.toFixed(3)}`);
                        }
                    }
                });
            } else {
                console.log(`No cylinder for ${bone.name} (no bone children)`);
            }
        });

        console.log(`CylinderCollider: Created ${this.cylinders.length} collision cylinders`);
    }

    updateCylinders() {
        if (!this.ybot || !this.ybot.object3D) return;

        // Ensure world matrices are up to date
        this.ybot.object3D.updateMatrixWorld(true);

        this.cylinders.forEach(cylinder => {
            const boneWorldPos = new THREE.Vector3();
            const childWorldPos = new THREE.Vector3();
            cylinder.bone.getWorldPosition(boneWorldPos);
            cylinder.child.getWorldPosition(childWorldPos);

            cylinder.start.copy(boneWorldPos);
            cylinder.end.copy(childWorldPos);

            const direction = new THREE.Vector3().subVectors(childWorldPos, boneWorldPos);
            cylinder.length = direction.length();
        });
    }

    checkCollision(object) {
        // Handle point collision (Vector3) - for external objects colliding with YBot
        if (object instanceof THREE.Vector3) {
            return this.pointToCylinderDistance(object, this.cylinders[0]) <= this.cylinders[0].radius;
        }

        // For YBot object, cylinder collision is handled separately
        // (we don't want YBot colliding with its own cylinders)
        if (object && object.bones) {
            return false; // Don't collide YBot with its own cylinders
        }

        return false;
    }

    pointToCylinderDistance(point, cylinder) {
        const { start, end, radius } = cylinder;

        // Vector from start to end
        const axis = new THREE.Vector3().subVectors(end, start);
        const axisLength = axis.length();

        if (axisLength === 0) {
            // Degenerate cylinder, check distance to start point
            return point.distanceTo(start) <= radius ? 0 : point.distanceTo(start) - radius;
        }

        axis.normalize();

        // Vector from start to point
        const startToPoint = new THREE.Vector3().subVectors(point, start);

        // Project point onto cylinder axis
        const projection = startToPoint.dot(axis);

        // Clamp projection to cylinder length
        const clampedProjection = Math.max(0, Math.min(axisLength, projection));

        // Find closest point on cylinder axis
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
        // Find the closest cylinder and calculate resolution
        let closestCylinder = null;
        let minDistance = Infinity;

        for (const cylinder of this.cylinders) {
            const distance = this.pointToCylinderDistance(point, cylinder);
            if (distance < minDistance) {
                minDistance = distance;
                closestCylinder = cylinder;
            }
        }

        if (closestCylinder) {
            const { start, end, radius } = closestCylinder;

            // Vector from start to end
            const axis = new THREE.Vector3().subVectors(end, start);
            axis.normalize();

            // Vector from start to point
            const startToPoint = new THREE.Vector3().subVectors(point, start);

            // Project point onto cylinder axis
            const projection = startToPoint.dot(axis);
            const clampedProjection = Math.max(0, Math.min(axis.length(), projection));

            // Find closest point on cylinder axis
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
        // For YBot collision, we want to push it away from cylinders
        // This is more complex - for now, use a simple approach
        let totalPush = new THREE.Vector3();
        let collisionCount = 0;

        for (const bone of ybot.bones) {
            const bonePos = new THREE.Vector3();
            bone.getWorldPosition(bonePos);

            const collision = this.resolvePointCollision(bonePos);
            if (collision) {
                totalPush.add(collision.normal.clone().multiplyScalar(collision.penetration));
                collisionCount++;
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

    getVisualizationMeshes() {
        const meshes = [];
        const material = new THREE.MeshBasicMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });

        this.cylinders.forEach(cylinder => {
            const geometry = new THREE.CylinderGeometry(cylinder.radius, cylinder.radius, cylinder.length, 8);
            const mesh = new THREE.Mesh(geometry, material);

            // Position and orient the cylinder
            const midpoint = new THREE.Vector3()
                .addVectors(cylinder.start, cylinder.end)
                .multiplyScalar(0.5);
            mesh.position.copy(midpoint);

            const direction = new THREE.Vector3().subVectors(cylinder.end, cylinder.start);
            mesh.lookAt(cylinder.end);
            mesh.rotateX(Math.PI / 2); // Align cylinder along Y axis

            mesh.userData.cylinder = cylinder;
            meshes.push(mesh);
        });

        return meshes;
    }
}

class FloorCollider {
    constructor(yLevel = 0) {
        this.yLevel = yLevel;
        this.normal = new THREE.Vector3(0, 1, 0); // Upward normal
    }

    checkCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return false;

        // Check ground-contacting bones (legs, feet, hips) but not arms/head
        const groundBones = [
            'mixamorigLeftFoot', 'mixamorigRightFoot',
            'mixamorigLeftLeg', 'mixamorigRightLeg',
            'mixamorigLeftUpLeg', 'mixamorigRightUpLeg',
            'mixamorigHips'
        ];

        let lowestPoint = Infinity;
        let hasGroundContact = false;

        for (const boneName of groundBones) {
            const bone = ybot.getBone ? ybot.getBone(boneName) : ybot.bones?.find(b => b.name === boneName);
            if (bone) {
                const bonePos = new THREE.Vector3();
                bone.getWorldPosition(bonePos);
                lowestPoint = Math.min(lowestPoint, bonePos.y);
                hasGroundContact = true;
            }
        }

        if (hasGroundContact) {
            const tolerance = 0.01; // Small tolerance to prevent floating
            const isColliding = lowestPoint <= this.yLevel + tolerance;
            if (isColliding) {
                console.log(`FloorCollider: Ground contact bone at y=${lowestPoint.toFixed(3)}, floor at y=${this.yLevel}`);
            }
            return isColliding;
        }

        // Fallback to object position
        return ybot.object3D.position.y <= this.yLevel;
    }

    resolveCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return null;

        // Find the lowest ground-contacting bone position
        const groundBones = [
            'mixamorigLeftFoot', 'mixamorigRightFoot',
            'mixamorigLeftLeg', 'mixamorigRightLeg',
            'mixamorigLeftUpLeg', 'mixamorigRightUpLeg',
            'mixamorigHips'
        ];

        let lowestPoint = ybot.object3D.position.y;
        let lowestBone = null;

        for (const boneName of groundBones) {
            const bone = ybot.getBone ? ybot.getBone(boneName) : ybot.bones?.find(b => b.name === boneName);
            if (bone) {
                const bonePos = new THREE.Vector3();
                bone.getWorldPosition(bonePos);
                if (bonePos.y < lowestPoint) {
                    lowestPoint = bonePos.y;
                    lowestBone = bone;
                }
            }
        }

        // Calculate how much to push up (with minimum threshold)
        const penetration = this.yLevel - lowestPoint;
        if (penetration > 0.001) { // Only push up if penetration is significant
            ybot.object3D.position.y += penetration;
            console.log(`FloorCollider: Pushed up by ${penetration.toFixed(3)} due to bone ${lowestBone?.name || 'unknown'} at y=${lowestPoint.toFixed(3)}`);
        }

        return {
            normal: this.normal,
            penetration: penetration > 0.001 ? penetration : 0
        };
    }
}