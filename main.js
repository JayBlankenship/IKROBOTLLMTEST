// main.js - Main application logic, initialization, and core functions

// Global variables
let scene, camera, renderer;
let ybot, ground;
let ybotInstance; // YBot class instance
let ikTargets = {}; // Keep for UI compatibility
let ikFrameCounter = 0; // For IK update damping
let lastTime = 0; // For physics delta time
let collisionSystem; // Collision detection system
let llmEngine;
let poseHistory = [];
let currentPoseIndex = -1;
let llmProvider = 'webllm'; // 'webllm' or 'openai'
let openaiApiKey = '';

// Debug visualization
let boneVisualizations = [];
let jointVisualizations = [];
let collisionVisualizations = [];
let showBones = false;
let showJoints = false;
let showCollision = false;

// Load visualization states from localStorage
function loadVisualizationStates() {
    showJoints = localStorage.getItem('ybot_showJoints') === 'true';
    showBones = localStorage.getItem('ybot_showBones') === 'true';
    showCollision = localStorage.getItem('ybot_showCollision') === 'true';

    // Update button states
    updateVisualizationButtons();
}

// Save visualization state to localStorage
function saveVisualizationState(key, value) {
    localStorage.setItem(key, value.toString());
}

// Update button text and states based on current values
function updateVisualizationButtons() {
    const jointBtn = document.getElementById('jointToggleBtn');
    const boneBtn = document.getElementById('boneToggleBtn');
    const collisionBtn = document.getElementById('collisionToggleBtn');
    const ybotVisibilityBtn = document.getElementById('ybotVisibilityBtn');

    if (jointBtn) {
        jointBtn.textContent = showJoints ? '🔴 Hide Joints' : '🔴 Show Joints';
    }
    if (boneBtn) {
        boneBtn.textContent = showBones ? '🦴 Hide Bones' : '🦴 Show Bones';
    }
    if (collisionBtn) {
        collisionBtn.textContent = showCollision ? '🔵 Hide Collision' : '🔵 Show Collision';
    }

    // Set YBot visibility button state
    if (ybotVisibilityBtn && ybotInstance) {
        const isVisible = ybotInstance.object3D.visible;
        ybotVisibilityBtn.textContent = isVisible ? '👤 Hide YBot' : '👤 Show YBot';
    }
}

function toggleJointVisualization() {
    showJoints = !showJoints;
    saveVisualizationState('ybot_showJoints', showJoints);
    const btn = document.getElementById('jointToggleBtn');
    btn.textContent = showJoints ? '🔴 Hide Joints' : '🔴 Show Joints';

    if (showJoints) {
        createJointVisualization();
    } else {
        clearJointVisualization();
    }
}

function toggleBoneVisualization() {
    showBones = !showBones;
    saveVisualizationState('ybot_showBones', showBones);
    const btn = document.getElementById('boneToggleBtn');
    btn.textContent = showBones ? '🦴 Hide Bones' : '🦴 Show Bones';

    if (showBones) {
        createBoneVisualization();
    } else {
        clearBoneVisualization();
    }
}

function toggleCollisionVisualization() {
    showCollision = !showCollision;
    saveVisualizationState('ybot_showCollision', showCollision);
    const btn = document.getElementById('collisionToggleBtn');
    btn.textContent = showCollision ? '🔵 Hide Collision' : '🔵 Show Collision';

    if (showCollision) {
        createCollisionVisualization();
    } else {
        clearCollisionVisualization();
    }
}

function toggleYBotVisibility() {
    if (!ybotInstance) return;

    const isVisible = ybotInstance.object3D.visible;
    ybotInstance.object3D.visible = !isVisible;
    saveVisualizationState('ybot_visible', !isVisible);

    const btn = document.getElementById('ybotVisibilityBtn');
    btn.textContent = !isVisible ? '👤 Show YBot' : '👤 Hide YBot';
}

function createJointVisualization() {
    clearJointVisualization(); // Clear any existing

    if (!ybotInstance || !ybotInstance.bones) {
        console.warn('No YBot instance or bones available for joint visualization');
        console.log('ybotInstance:', ybotInstance);
        console.log('ybotInstance.bones:', ybotInstance ? ybotInstance.bones : 'undefined');
        return;
    }

    // Ensure world matrices are up to date
    if (ybotInstance.object3D) {
        ybotInstance.object3D.updateMatrixWorld(true);
    }

    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
    const jointGeometry = new THREE.SphereGeometry(0.01, 8, 6);

    console.log('Creating joint visualizations for', ybotInstance.bones.length, 'bones');

    ybotInstance.bones.forEach((bone, index) => {
        const worldPos = new THREE.Vector3();
        bone.getWorldPosition(worldPos);
        console.log(`Bone ${index}: ${bone.name} at world position`, worldPos);
        // Create joint sphere at bone world position
        const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
        jointMesh.position.copy(worldPos);
        jointMesh.userData.bone = bone;
        scene.add(jointMesh);
        jointVisualizations.push(jointMesh);
    });

    console.log(`Created ${jointVisualizations.length} joint visualizations`);
}

function createBoneVisualization() {
    clearBoneVisualization(); // Clear any existing

    if (!ybotInstance || !ybotInstance.bones) {
        console.warn('No bones available for bone visualization');
        return;
    }

    // Ensure world matrices are up to date
    if (ybotInstance.object3D) {
        ybotInstance.object3D.updateMatrixWorld(true);
    }

    const boneMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    const boneGeometry = new THREE.CylinderGeometry(0.005, 0.005, 1, 8);

    console.log('Creating bone visualizations for', ybotInstance.bones.length, 'bones');

    ybotInstance.bones.forEach(bone => {
        // Create bone cylinder from parent to child
        if (bone.children && bone.children.length > 0) {
            bone.children.forEach(child => {
                if (child.isBone) {
                    const boneWorldPos = new THREE.Vector3();
                    const childWorldPos = new THREE.Vector3();
                    bone.getWorldPosition(boneWorldPos);
                    child.getWorldPosition(childWorldPos);

                    const direction = new THREE.Vector3().subVectors(childWorldPos, boneWorldPos);
                    const length = direction.length();

                    if (length > 0.001) { // Only create cylinders for meaningful distances
                        const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial);
                        boneMesh.position.copy(boneWorldPos).add(direction.clone().multiplyScalar(0.5));
                        boneMesh.scale.y = length;
                        boneMesh.lookAt(childWorldPos);
                        boneMesh.userData.bone = bone;
                        boneMesh.userData.child = child;
                        scene.add(boneMesh);
                        boneVisualizations.push(boneMesh);
                    }
                }
            });
        }
    });

    console.log(`Created ${boneVisualizations.length} bone visualizations`);
}

function clearJointVisualization() {
    jointVisualizations.forEach(mesh => {
        scene.remove(mesh);
    });
    jointVisualizations = [];
}

function clearBoneVisualization() {
    boneVisualizations.forEach(mesh => {
        scene.remove(mesh);
    });
    boneVisualizations = [];
}

function createCollisionVisualization() {
    clearCollisionVisualization(); // Clear any existing

    if (!ybotInstance || !collisionSystem) {
        console.warn('No YBot instance or collision system available for collision visualization');
        return;
    }

    // Find the capsule collider in the collision system
    let capsuleCollider = null;
    for (const collider of collisionSystem.colliders) {
        if (collider instanceof CapsuleCollider) {
            capsuleCollider = collider;
            break;
        }
    }

    if (!capsuleCollider) {
        console.warn('No CapsuleCollider found in collision system');
        return;
    }

    // Update capsules to ensure they have current positions
    capsuleCollider.updateCapsules();

    // Get visualization meshes
    const meshes = capsuleCollider.getVisualizationMeshes();
    meshes.forEach(mesh => {
        scene.add(mesh);
        collisionVisualizations.push(mesh);
    });

    console.log(`Created ${collisionVisualizations.length} collision capsule visualizations`);
}

function clearCollisionVisualization() {
    collisionVisualizations.forEach(mesh => {
        scene.remove(mesh);
    });
    collisionVisualizations = [];
}

function updateCollisionVisualization() {
    if (!showCollision || collisionVisualizations.length === 0) return;

    // Find the capsule collider
    let capsuleCollider = null;
    for (const collider of collisionSystem.colliders) {
        if (collider instanceof CapsuleCollider) {
            capsuleCollider = collider;
            break;
        }
    }

    if (!capsuleCollider) return;

    // Update capsule positions
    capsuleCollider.updateCapsules();

    // Update existing visualization meshes in place (much more efficient)
    capsuleCollider.capsules.forEach((capsule, index) => {
        if (index * 3 < collisionVisualizations.length) {
            const cylinderMesh = collisionVisualizations[index * 3];
            const startSphereMesh = collisionVisualizations[index * 3 + 1];
            const endSphereMesh = collisionVisualizations[index * 3 + 2];

            // Update cylinder position and orientation
            const midpoint = new THREE.Vector3()
                .addVectors(capsule.start, capsule.end)
                .multiplyScalar(0.5);
            cylinderMesh.position.copy(midpoint);

            const direction = new THREE.Vector3().subVectors(capsule.end, capsule.start);
            cylinderMesh.lookAt(capsule.end);
            cylinderMesh.rotateX(Math.PI / 2);

            // Update sphere positions
            startSphereMesh.position.copy(capsule.start);
            endSphereMesh.position.copy(capsule.end);
        }
    });
}

function updateJointVisualization() {
    if (!showJoints || jointVisualizations.length === 0) return;

    jointVisualizations.forEach(mesh => {
        if (mesh.userData.bone) {
            const worldPos = new THREE.Vector3();
            mesh.userData.bone.getWorldPosition(worldPos);
            mesh.position.copy(worldPos);
        }
    });
}

function updateBoneVisualization() {
    if (!showBones || boneVisualizations.length === 0) return;

    boneVisualizations.forEach(mesh => {
        if (mesh.userData.bone && mesh.userData.child) {
            const bone = mesh.userData.bone;
            const child = mesh.userData.child;
            const boneWorldPos = new THREE.Vector3();
            const childWorldPos = new THREE.Vector3();
            bone.getWorldPosition(boneWorldPos);
            child.getWorldPosition(childWorldPos);

            const direction = new THREE.Vector3().subVectors(childWorldPos, boneWorldPos);
            const length = direction.length();

            if (length > 0.001) {
                mesh.position.copy(boneWorldPos).add(direction.clone().multiplyScalar(0.5));
                mesh.scale.y = length;
                mesh.lookAt(childWorldPos);
            }
        }
    });
}

// Camera control variables
let cameraDistance = 5;
let cameraRotationX = 0;
let cameraRotationY = 0;
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Wait for THREE.js to load before initializing
function checkLibrariesLoaded() {
    if (typeof THREE !== 'undefined') {
        console.log('THREE.js loaded, initializing...');
        init();
        animate();
    } else {
        console.log('Waiting for THREE.js to load...');
        setTimeout(checkLibrariesLoaded, 100);
    }
}

function init() {
    // Load saved visualization states from localStorage
    loadVisualizationStates();

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    // Camera controls
    renderer.domElement.addEventListener('mousedown', function(event) {
        if (event.button === 0) { // Left mouse button
            isMouseDown = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        }
    });

    renderer.domElement.addEventListener('mousemove', function(event) {
        if (isMouseDown && event.button === 0) {
            const deltaX = event.clientX - lastMouseX;
            const deltaY = event.clientY - lastMouseY;

            cameraRotationY += deltaX * 0.01;
            cameraRotationX += deltaY * 0.01;

            // Clamp vertical rotation to prevent flipping
            cameraRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotationX));

            updateCameraPosition();

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        }
    });

    renderer.domElement.addEventListener('mouseup', function(event) {
        if (event.button === 0) {
            isMouseDown = false;
        }
    });

    // Zoom with mouse wheel
    renderer.domElement.addEventListener('wheel', function(event) {
        event.preventDefault();
        const zoomSpeed = 0.5;
        cameraDistance += event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
        cameraDistance = Math.max(1, Math.min(20, cameraDistance)); // Clamp distance
        updateCameraPosition();
    });

    // Initialize camera position
    updateCameraPosition();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Ground
    createGround();

    // Initialize collision system
    collisionSystem = new CollisionSystem();
    const floorCollider = new FloorCollider(0); // Floor at y=0
    collisionSystem.addCollider(floorCollider);

    // Add IK targets to scene
    createIKTargets();

    // Load YBot
    loadYBot();

    // Initialize WebLLM
    initWebLLM();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function updateCameraPosition() {
    const x = cameraDistance * Math.sin(cameraRotationY) * Math.cos(cameraRotationX);
    const y = cameraDistance * Math.sin(cameraRotationX);
    const z = cameraDistance * Math.cos(cameraRotationY) * Math.cos(cameraRotationX);

    camera.position.set(x, y + 2, z); // Add 2 to y for better viewing angle
    camera.lookAt(0, 1, 0); // Look at the center of the scene
}

function createGround() {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshLambertMaterial({
        color: 0x90EE90,
        transparent: true,
        opacity: 0.8
    });
    ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);
}

function createIKTargets() {
    // Create visual targets for different body parts
    const targetConfigs = {
        leftHand: { color: 0xff0000, position: [0.5, 1.2, 0.3] },
        rightHand: { color: 0x0000ff, position: [-0.5, 1.2, 0.3] },
        leftFoot: { color: 0xff8800, position: [0.15, 0.05, 0.1] }, // Lower for ground contact
        rightFoot: { color: 0x0088ff, position: [-0.15, 0.05, 0.1] }, // Lower for ground contact
        head: { color: 0x88ff00, position: [0, 1.6, 0] }
    };

    for (const [name, config] of Object.entries(targetConfigs)) {
        ikTargets[name] = new THREE.Mesh(
            new THREE.SphereGeometry(0.03),
            new THREE.MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.7 })
        );
        ikTargets[name].position.set(...config.position);
        ikTargets[name].visible = false; // Hidden by default
        scene.add(ikTargets[name]);
    }
}

function loadYBot() {
    const loader = new THREE.FBXLoader();

    loader.load(
        './assets/YBot.fbx',
        function (object) {
            ybot = object; // Keep for backward compatibility
            ybotInstance = new YBot();
            ybotInstance.setObject(object);

            // Scale and position
            ybot.scale.setScalar(0.01); // FBX models are often too large
            ybot.position.set(0, 0, 0);

            // Enable shadows
            ybot.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(ybot);
            console.log('YBot loaded successfully');
            console.log('YBot object:', ybot);
            console.log('YBot skeleton:', ybot.skeleton);
            console.log('Skeleton bones count:', ybot.skeleton ? ybot.skeleton.bones.length : 0);

            // Debug: Inspect mesh structure
            console.log('=== YBOT MESH STRUCTURE ===');
            let meshCount = 0;
            object.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    console.log(`Mesh #${meshCount}: ${child.name}`);
                    console.log(`  Type: ${child.type}`);
                    console.log(`  Geometry: ${child.geometry.type}`);
                    console.log(`  Vertices: ${child.geometry.attributes.position.count}`);
                    console.log(`  Material: ${child.material ? child.material.name : 'none'}`);
                    console.log(`  Parent: ${child.parent ? child.parent.name : 'none'}`);
                    console.log(`  Alpha_Surface?: ${child.name.includes('Alpha_Surface')}`);
                    console.log('---');
                }
            });
            console.log(`Total meshes found: ${meshCount}`);
            console.log('=== END MESH STRUCTURE ===');

            // Check if the model has a proper skeleton for IK
            // More thorough check for bones in FBX structure
            let hasBones = false;
            let boneCount = 0;

            if (ybot.skeleton && ybot.skeleton.bones && ybot.skeleton.bones.length > 0) {
                hasBones = true;
                boneCount = ybot.skeleton.bones.length;
            } else {
                // Check if bones are stored in children or animations
                ybot.traverse((child) => {
                    if (child.isBone) {
                        hasBones = true;
                        boneCount++;
                    }
                });
            }

            console.log('Has bones:', hasBones, 'Count:', boneCount);

            if (!hasBones) {
                console.error('YBot model has no skeleton - cannot perform IK operations');
                alert('Error: YBot model loaded but has no skeleton. IK features will not work.');
                return;
            }

            // Initialize IK after YBot loads
            setTimeout(() => {
                if (ybotInstance) {
                    ybotInstance.createIKChains();
                    // Set initial targets
                    ybotInstance.setIKTarget('leftHand', [0.5, 1.2, 0.3]);
                    ybotInstance.setIKTarget('rightHand', [-0.5, 1.2, 0.3]);
                    ybotInstance.setIKTarget('leftFoot', [0.15, 0.05, 0.1]);
                    ybotInstance.setIKTarget('rightFoot', [-0.15, 0.05, 0.1]);
                    ybotInstance.setIKTarget('head', [0, 1.6, 0]);

                    // Initialize capsule-based collision system
                    const capsuleCollider = new CapsuleCollider(ybotInstance, 1.0);
                    collisionSystem.addCollider(capsuleCollider);
                    console.log('Capsule-based collision system initialized');

                    // Apply saved visualization states
                    setTimeout(() => {
                        if (showJoints) createJointVisualization();
                        if (showBones) createBoneVisualization();
                        if (showCollision) createCollisionVisualization();

                        // Apply saved YBot visibility
                        const savedVisible = localStorage.getItem('ybot_visible');
                        if (savedVisible !== null && ybotInstance) {
                            const isVisible = savedVisible === 'true';
                            ybotInstance.object3D.visible = isVisible;
                            const btn = document.getElementById('ybotVisibilityBtn');
                            if (btn) {
                                btn.textContent = isVisible ? '👤 Hide YBot' : '👤 Show YBot';
                            }
                        }

                        console.log('Applied saved visualization states and YBot visibility');
                    }, 200); // Extra delay to ensure everything is ready
                }
            }, 100); // Small delay to ensure bones are ready
        },
        function (progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function (error) {
            console.error('Error loading YBot:', error);
            alert('Failed to load YBot model. Please check that assets/YBot.fbx exists and is valid.');
        }
    );
}

async function initWebLLM() {
    try {
        console.log('WebLLM disabled - using OpenAI fallback...');
        throw new Error('WebLLM disabled for stability');
    } catch (error) {
        console.log('Falling back to OpenAI API...');
        updateLLMStatus('Using OpenAI API');
        llmProvider = 'openai';
        document.getElementById('llmProvider').value = 'openai';
        document.getElementById('openaiConfig').style.display = 'block';
    }
}

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    // Calculate delta time for physics
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 1/30); // Cap at 30 FPS
    lastTime = currentTime;

    ikFrameCounter++;

    // Update physics every frame
    if (ybotInstance) {
        ybotInstance.updatePhysics(deltaTime, collisionSystem);
    }

    // Only update IK every 6 frames for maximum stability
    if (ikFrameCounter % 6 === 0) {
        // Use YBot IK system
        if (ybotInstance && ybotInstance.isInitialized) {
            // Enable physics mode (disable spine IK) when YBot has velocity or is not grounded
            const physicsMode = ybotInstance && (
                !ybotInstance.isGrounded ||
                Math.abs(ybotInstance.velocity.x) > 0.01 ||
                Math.abs(ybotInstance.velocity.y) > 0.01 ||
                Math.abs(ybotInstance.velocity.z) > 0.01
            );
            ybotInstance.updateIK(physicsMode);
        } else {
            // Simple IK system (no character loaded)
            applySimpleIK();
        }
    }

    // Update bone and joint visualizations if enabled
    updateJointVisualization();
    updateBoneVisualization();
    updateCollisionVisualization();

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Simple IK implementation for basic arm movement
function applySimpleIK() {
    if (!ybot) return;

    // Apply simple IK to arms if targets exist and are visible
    if (ikTargets.leftHand && ikTargets.leftHand.visible) {
        applyArmIK('left');
    }

    if (ikTargets.rightHand && ikTargets.rightHand.visible) {
        applyArmIK('right');
    }
}

function applyArmIK(side) {
    // Simple IK implementation - just point arms toward targets
    const target = ikTargets[side + 'Hand'];
    if (!target) return;

    // This is a placeholder - real IK would be more complex
    console.log(`Applying simple IK for ${side} arm toward target at`, target.position);
}

// Start the application
checkLibrariesLoaded();