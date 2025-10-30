// ik.js - Inverse Kinematics system

class CustomIKSolver {
    constructor() {
        this.chains = [];
        this.maxIterations = 1; // Single pass for stability
        this.tolerance = 0.2; // Even higher tolerance
    }

    add(chain) {
        this.chains.push(chain);
    }

    solve() {
        for (const chain of this.chains) {
            if (chain.target && chain.joints.length > 1) {
                this.solveChain(chain);
            }
        }

        // Update the entire YBot object after solving all chains
        if (ybot) {
            ybot.updateMatrixWorld(true);
        }
    }

    solveChain(chain) {
        const target = chain.target;
        const joints = chain.joints;

        // Ultra-simple IK: just make each joint point towards the target
        // This is more stable than complex CCD algorithms
        for (let i = 0; i < joints.length - 1; i++) {
            const joint = joints[i];
            const nextJoint = joints[i + 1];

            // Get positions
            const jointPos = new THREE.Vector3();
            const nextPos = new THREE.Vector3();
            const targetPos = target.clone();

            joint.getWorldPosition(jointPos);
            nextJoint.getWorldPosition(nextPos);

            // Vector from joint to next joint (current bone direction)
            const currentDir = new THREE.Vector3().subVectors(nextPos, jointPos).normalize();

            // Vector from joint to target
            const targetDir = new THREE.Vector3().subVectors(targetPos, jointPos).normalize();

            // Calculate rotation needed
            const dot = Math.max(-1, Math.min(1, currentDir.dot(targetDir)));
            const angle = Math.acos(dot);

            if (angle > 0.01) {
                // Calculate rotation axis
                const axis = new THREE.Vector3().crossVectors(currentDir, targetDir).normalize();

                // Very small rotation for stability
                const maxAngle = Math.PI / 12; // 15 degrees max
                const clampedAngle = Math.min(angle * 0.05, maxAngle);

                if (clampedAngle > 0.001) {
                    // Apply rotation in world space, then convert to local
                    const worldQuat = new THREE.Quaternion();
                    joint.getWorldQuaternion(worldQuat);

                    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, clampedAngle);
                    worldQuat.multiply(rotation);

                    // Convert back to local quaternion
                    if (joint.parent) {
                        const parentWorldQuat = new THREE.Quaternion();
                        joint.parent.getWorldQuaternion(parentWorldQuat);
                        parentWorldQuat.invert();
                        joint.quaternion.copy(parentWorldQuat).multiply(worldQuat);
                    } else {
                        joint.quaternion.copy(worldQuat);
                    }

                    // Update matrices
                    joint.updateMatrix();
                }
            }
        }
    }
}

class CustomIKChain {
    constructor() {
        this.joints = [];
        this.target = null;
    }

    add(joint) {
        this.joints.push(joint);
    }

    setTarget(position) {
        this.target = position.clone();
    }
}