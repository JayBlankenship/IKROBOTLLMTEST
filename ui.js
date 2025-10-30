// ui.js - User interface controls and event handlers

function savePoseToHistory(poseData, description) {
    // Remove any poses after current index (for undo/redo)
    poseHistory = poseHistory.slice(0, currentPoseIndex + 1);

    // Save current pose state
    const currentPose = {
        leftHand: ikTargets.leftHand ? ikTargets.leftHand.position.toArray() : null,
        rightHand: ikTargets.rightHand ? ikTargets.rightHand.position.toArray() : null,
        description: description,
        timestamp: Date.now()
    };

    poseHistory.push(currentPose);
    currentPoseIndex = poseHistory.length - 1;

    // Limit history to 50 poses
    if (poseHistory.length > 50) {
        poseHistory.shift();
        currentPoseIndex--;
    }
}

function undoPose() {
    if (currentPoseIndex > 0) {
        currentPoseIndex--;
        const pose = poseHistory[currentPoseIndex];
        applySavedPose(pose);
        document.getElementById('llmResponse').textContent = `↶ Undid to: ${pose.description}`;
    } else {
        document.getElementById('llmResponse').textContent = '↶ Nothing to undo';
    }
}

function redoPose() {
    if (currentPoseIndex < poseHistory.length - 1) {
        currentPoseIndex++;
        const pose = poseHistory[currentPoseIndex];
        applySavedPose(pose);
        document.getElementById('llmResponse').textContent = `↷ Redid to: ${pose.description}`;
    } else {
        document.getElementById('llmResponse').textContent = '↷ Nothing to redo';
    }
}

function applySavedPose(pose) {
    if (pose.leftHand) {
        moveIKTarget('leftHand', ...pose.leftHand);
    }
    if (pose.rightHand) {
        moveIKTarget('rightHand', ...pose.rightHand);
    }
}

function switchLLMProvider(provider) {
    llmProvider = provider;

    // Hide all configs
    document.getElementById('openaiConfig').style.display = 'none';
    document.getElementById('anthropicConfig').style.display = 'none';
    document.getElementById('ollamaConfig').style.display = 'none';
    document.getElementById('lmstudioConfig').style.display = 'none';
    document.getElementById('togetherConfig').style.display = 'none';

    // Show selected config and update status
    switch(provider) {
        case 'openai':
            document.getElementById('openaiConfig').style.display = 'block';
            updateLLMStatus('🔑 Ready for OpenAI GPT-4');
            break;
        case 'anthropic':
            document.getElementById('anthropicConfig').style.display = 'block';
            updateLLMStatus('🧠 Ready for Anthropic Claude');
            break;
        case 'ollama':
            document.getElementById('ollamaConfig').style.display = 'block';
            updateLLMStatus('🐪 Ready for Ollama Local LLM');
            break;
        case 'lmstudio':
            document.getElementById('lmstudioConfig').style.display = 'block';
            updateLLMStatus('🎭 Ready for LM Studio Local LLM');
            break;
        case 'together':
            document.getElementById('togetherConfig').style.display = 'block';
            updateLLMStatus('🚀 Ready for Together AI');
            break;
        default: // webllm
            updateLLMStatus(llmEngine ? '🤖 WebLLM Ready' : '❌ WebLLM Offline');
    }
}

function updateLLMStatus(message) {
    document.getElementById('llmStatus').textContent = message;
}

function moveIKTarget(targetName, x, y, z) {
    console.log(`Moving IK target ${targetName} to:`, x, y, z);

    // Update visual target
    const target = ikTargets[targetName];
    if (target) {
        target.position.set(x, y, z);
        target.visible = true;
        console.log(`Target ${targetName} position set to:`, target.position);
    }

    // Update YBot IK chain target
    if (ybotInstance && ybotInstance.ikChains[targetName]) {
        try {
            ybotInstance.setIKTarget(targetName, [x, y, z]);
            console.log(`YBot IK chain ${targetName} target updated`);
        } catch (chainError) {
            console.warn(`Error updating YBot IK chain for ${targetName}:`, chainError);
        }
    } else {
        console.warn(`No YBot IK chain found for ${targetName}`);
    }
}

function toggleWireframe() {
    if (ybot) {
        ybot.traverse(function (child) {
            if (child.isMesh && child.material) {
                child.material.wireframe = !child.material.wireframe;
            }
        });
    }
}

function resetCamera() {
    cameraDistance = 5;
    cameraRotationX = 0;
    cameraRotationY = 0;
    updateCameraPosition();
}