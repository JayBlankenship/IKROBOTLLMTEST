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
}

class FloorCollider {
    constructor(yLevel = 0) {
        this.yLevel = yLevel;
        this.normal = new THREE.Vector3(0, 1, 0); // Upward normal
    }

    checkCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return false;

        // Check if YBot's feet are below floor level
        if (ybot.getBone) {
            const leftFoot = ybot.getBone('mixamorigLeftFoot');
            const rightFoot = ybot.getBone('mixamorigRightFoot');

            if (leftFoot || rightFoot) {
                let lowestPoint = Infinity;
                if (leftFoot) {
                    const pos = new THREE.Vector3();
                    leftFoot.getWorldPosition(pos);
                    lowestPoint = Math.min(lowestPoint, pos.y);
                }
                if (rightFoot) {
                    const pos = new THREE.Vector3();
                    rightFoot.getWorldPosition(pos);
                    lowestPoint = Math.min(lowestPoint, pos.y);
                }
                return lowestPoint <= this.yLevel;
            }
        }

        // Fallback to object position
        return ybot.object3D.position.y <= this.yLevel;
    }

    resolveCollision(ybot) {
        // Safety check - ensure YBot is properly initialized
        if (!ybot || !ybot.object3D) return null;

        // Get the lowest foot position
        let lowestPoint = ybot.object3D.position.y;
        if (ybot.getBone) {
            const leftFoot = ybot.getBone('mixamorigLeftFoot');
            const rightFoot = ybot.getBone('mixamorigRightFoot');

            if (leftFoot || rightFoot) {
                if (leftFoot) {
                    const pos = new THREE.Vector3();
                    leftFoot.getWorldPosition(pos);
                    lowestPoint = Math.min(lowestPoint, pos.y);
                }
                if (rightFoot) {
                    const pos = new THREE.Vector3();
                    rightFoot.getWorldPosition(pos);
                    lowestPoint = Math.min(lowestPoint, pos.y);
                }
            }
        }

        // Calculate how much to push up
        const penetration = this.yLevel - lowestPoint;
        if (penetration > 0) {
            ybot.object3D.position.y += penetration;
        }

        return {
            normal: this.normal,
            penetration: penetration
        };
    }
}