// ybot.js - YBot character class with IK and physics

class YBot {
    constructor() {
        this.object3D = null;
        this.bones = [];
        this.ikSolver = new CustomIKSolver();
        this.ikChains = {};
        this.ikTargets = {};
        this.isInitialized = false;

        // Physics properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.gravity = -9.8;
        this.groundY = 0.05; // Match foot target height
        this.isGrounded = false;
        this.mass = 70; // kg
        this.damping = 0.95;

        // Collision properties
        this.collisionRadius = 0.3; // Approximate radius for collision
        this.collisionHeight = 1.8; // Approximate height
    }

    setObject(object3D) {
        this.object3D = object3D;
        this.findBones();
    }

    findBones() {
        this.bones = [];
        if (this.object3D) {
            this.object3D.traverse((child) => {
                if (child.isBone) {
                    this.bones.push(child);
                }
            });
        }
        console.log(`YBot: Found ${this.bones.length} bones`);
    }

    createIKChains() {
        if (!this.object3D || this.bones.length === 0) {
            console.warn('YBot: Cannot create IK chains - no object or bones');
            return false;
        }

        const findBone = (name) => {
            return this.bones.find(bone => bone.name === name);
        };

        // Create chains for different body parts
        const chainConfigs = [
            { name: 'leftHand', bones: ['mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand'] },
            { name: 'rightHand', bones: ['mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'] },
            { name: 'leftFoot', bones: ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot'] },
            { name: 'rightFoot', bones: ['mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot'] },
            { name: 'head', bones: ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigNeck', 'mixamorigHead'] }
        ];

        for (const config of chainConfigs) {
            const chainBones = config.bones.map(name => findBone(name)).filter(bone => bone);
            if (chainBones.length >= 2) {
                const chain = new CustomIKChain();
                chainBones.forEach(bone => chain.add(bone));
                this.ikSolver.add(chain);
                this.ikChains[config.name] = chain;
                console.log(`YBot: Created ${config.name} IK chain with ${chainBones.length} bones`);
            } else {
                console.warn(`YBot: Not enough bones for ${config.name} chain: ${chainBones.length} found`);
            }
        }

        this.isInitialized = Object.keys(this.ikChains).length > 0;
        console.log(`YBot: IK system initialized with ${Object.keys(this.ikChains).length} chains`);
        return this.isInitialized;
    }

    setIKTarget(chainName, position) {
        if (this.ikChains[chainName]) {
            const target = new THREE.Vector3().fromArray(position);
            this.ikChains[chainName].setTarget(target);
        }
    }

    updateIK() {
        if (this.isInitialized) {
            this.ikSolver.solve();
            if (this.object3D) {
                this.object3D.updateMatrixWorld(true);
            }
        }
    }

    updatePhysics(deltaTime, collisionSystem) {
        if (!this.object3D) return;

        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;

        // Apply damping
        this.velocity.multiplyScalar(this.damping);

        // Store previous position for collision resolution
        const prevPosition = this.object3D.position.clone();

        // Apply velocity to position
        this.object3D.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Check collisions
        this.isGrounded = false;
        if (collisionSystem) {
            const collision = collisionSystem.checkCollisions(this);
            if (collision) {
                // Resolve collision
                this.object3D.position.copy(prevPosition);

                // Handle floor collision
                if (collision.normal.y > 0) {
                    this.isGrounded = true;
                    this.velocity.y = Math.max(0, this.velocity.y);

                    // Apply ground friction
                    this.velocity.x *= 0.8;
                    this.velocity.z *= 0.8;
                }
            }
        }

        // If no collision system, fall back to simple ground check
        if (!collisionSystem) {
            // Get foot positions to check grounding
            const leftFoot = this.getBone('mixamorigLeftFoot');
            const rightFoot = this.getBone('mixamorigRightFoot');

            let lowestPoint = 0;
            if (leftFoot || rightFoot) {
                const positions = [];
                if (leftFoot) {
                    const pos = new THREE.Vector3();
                    leftFoot.getWorldPosition(pos);
                    positions.push(pos.y);
                }
                if (rightFoot) {
                    const pos = new THREE.Vector3();
                    rightFoot.getWorldPosition(pos);
                    positions.push(pos.y);
                }
                lowestPoint = Math.min(...positions);
            }

            // Ground collision
            if (lowestPoint <= this.groundY + 0.05) {
                this.velocity.y = Math.max(0, this.velocity.y); // Stop downward motion
                this.isGrounded = true;

                // Apply ground friction
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
            } else {
                this.isGrounded = false;
            }
        }
    }

    getBone(name) {
        return this.bones.find(bone => bone.name === name);
    }
}