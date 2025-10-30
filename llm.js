// llm.js - LLM integration and pose management

// Global variables for LLM
let conversationHistory = [];
let posePresets = {
    "wave": {
        leftHand: [0.6, 1.8, 0.4],
        rightHand: [-0.6, 1.8, 0.4],
        description: "Waving both hands"
    },
    "point": {
        leftHand: [0.8, 1.2, 0.6],
        rightHand: [-0.3, 1.0, 0.8],
        description: "Pointing with left hand"
    },
    "dance": {
        leftHand: [0.4, 1.6, 0.2],
        rightHand: [-0.4, 1.6, -0.2],
        description: "Dancing pose"
    },
    "idle": {
        leftHand: [0.2, 0.8, 0.1],
        rightHand: [-0.2, 0.8, 0.1],
        description: "Relaxed standing pose"
    }
};

function applyPosePreset(presetName) {
    const preset = posePresets[presetName];
    if (!preset) return;

    console.log('Applying pose:', preset.description);

    // Apply hand positions
    if (preset.leftHand) {
        moveIKTarget('leftHand', ...preset.leftHand);
    }
    if (preset.rightHand) {
        moveIKTarget('rightHand', ...preset.rightHand);
    }

    // Show targets briefly for visual feedback
    showTargetsTemporarily();
}

function showTargetsTemporarily() {
    // Make targets visible for 2 seconds
    Object.values(ikTargets).forEach(target => {
        target.visible = true;
    });

    setTimeout(() => {
        Object.values(ikTargets).forEach(target => {
            target.visible = false;
        });
    }, 2000);
}

function parseLLMPose(text) {
    // Simple LLM pose parser - can be enhanced
    const lowerText = text.toLowerCase();
    const responseDiv = document.getElementById('llmResponse');

    if (lowerText.includes('wave') || lowerText.includes('hello')) {
        applyPosePreset('wave');
        responseDiv.textContent = '🤖 Applied waving pose';
        return 'Applied waving pose';
    }
    if (lowerText.includes('point')) {
        applyPosePreset('point');
        responseDiv.textContent = '🤖 Applied pointing pose';
        return 'Applied pointing pose';
    }
    if (lowerText.includes('dance')) {
        applyPosePreset('dance');
        responseDiv.textContent = '🤖 Applied dancing pose';
        return 'Applied dancing pose';
    }
    if (lowerText.includes('relax') || lowerText.includes('idle')) {
        applyPosePreset('idle');
        responseDiv.textContent = '🤖 Applied relaxed pose';
        return 'Applied relaxed pose';
    }

    responseDiv.textContent = '🤖 Pose not recognized. Try: wave, point, dance, or relax';
    return 'Pose not recognized. Try: wave, point, dance, or relax';
}

async function generatePoseFromLLM(text) {
    const responseDiv = document.getElementById('llmResponse');
    responseDiv.textContent = '🤔 Thinking...';

    // Activate consciousness thinking mode
    startThinkingAnimation();

    try {
        let poseData;
        console.log('Using LLM provider:', llmProvider);

        switch(llmProvider) {
            case 'openai':
                console.log('Calling OpenAI...');
                poseData = await generateWithOpenAI(text);
                break;
            case 'anthropic':
                console.log('Calling Anthropic...');
                poseData = await generateWithAnthropic(text);
                break;
            case 'ollama':
                console.log('Calling Ollama...');
                poseData = await generateWithOllama(text);
                break;
            case 'lmstudio':
                console.log('Calling LM Studio...');
                poseData = await generateWithLMStudio(text);
                break;
            case 'together':
                console.log('Calling Together AI...');
                poseData = await generateWithTogether(text);
                break;
            default: // webllm
                console.log('WebLLM available:', !!llmEngine);
                if (llmEngine) {
                    poseData = await generateWithWebLLM(text);
                } else {
                    console.log('WebLLM not available, trying to load it...');
                    try {
                        // Try to load WebLLM on demand
                        await initWebLLM();
                        if (llmEngine) {
                            poseData = await generateWithWebLLM(text);
                        } else {
                            throw new Error('WebLLM still not available');
                        }
                    } catch (webllmError) {
                        console.log('WebLLM failed, switching to OpenAI...');
                        llmProvider = 'openai';
                        document.getElementById('llmProvider').value = 'openai';
                        document.getElementById('openaiConfig').style.display = 'block';
                        poseData = await generateWithOpenAI(text);
                    }
                }
        }

        if (poseData) {
            console.log('LLM generated pose data:', poseData);
            applyLLMPose(poseData);
            savePoseToHistory(poseData, poseData.description || 'LLM pose');
            responseDiv.textContent = `🤖 Applied: ${poseData.description || 'LLM pose'}`;
        } else {
            console.error('No pose data returned from LLM');
            throw new Error('No pose data generated');
        }

    } catch (error) {
        console.error('LLM generation failed:', error);
        responseDiv.textContent = '❌ LLM Error - using basic parser';
        // Force test with basic parser
        console.log('Testing with basic parser...');
        parseLLMPose(text); // Fallback
    }
}

function applyLLMPose(poseData) {
    console.log('Applying LLM pose:', poseData);

    // Apply hand positions if specified
    if (poseData.leftHand && Array.isArray(poseData.leftHand)) {
        console.log('Moving left hand to:', poseData.leftHand);
        moveIKTarget('leftHand', ...poseData.leftHand);
    }
    if (poseData.rightHand && Array.isArray(poseData.rightHand)) {
        console.log('Moving right hand to:', poseData.rightHand);
        moveIKTarget('rightHand', ...poseData.rightHand);
    }

    // Apply additional body parts if specified
    if (poseData.leftFoot && Array.isArray(poseData.leftFoot)) {
        moveIKTarget('leftFoot', ...poseData.leftFoot);
    }
    if (poseData.rightFoot && Array.isArray(poseData.rightFoot)) {
        moveIKTarget('rightFoot', ...poseData.rightFoot);
    }
    if (poseData.head && Array.isArray(poseData.head)) {
        moveIKTarget('head', ...poseData.head);
    }

    // Show targets briefly
    showTargetsTemporarily();
}

function testIKSystem() {
    console.log('Testing IK system...');
    // Test by moving left hand to a visible position
    moveIKTarget('leftHand', 0.8, 1.2, 0.6);
    document.getElementById('llmResponse').textContent = '🧪 IK Test: Moved left hand forward';
}

// LLM provider functions (simplified versions)
async function generateWithWebLLM(text) {
    const historyContext = conversationHistory.slice(-3).map(h => `User: ${h.input}\nAI: ${h.output}`).join('\n');
    const prompt = `${historyContext ? `Previous conversation:\n${historyContext}\n\n` : ''}Convert this pose description into specific IK target positions for a humanoid robot.
    Description: "${text}"

    Respond with JSON format like:
    {
        "leftHand": [x, y, z],
        "rightHand": [x, y, z],
        "description": "brief description"
    }

    Use coordinates relative to robot center, where:
    - Forward is +Z, Back is -Z
    - Right is +X, Left is -X
    - Up is +Y, Down is -Y
    - Normal reach distance is about 0.5-0.8 units

    Examples:
    "wave hello" -> {"leftHand": [0.6, 1.8, 0.4], "rightHand": [-0.6, 1.8, 0.4], "description": "waving both hands"}
    "point forward" -> {"leftHand": [0.8, 1.2, 0.6], "rightHand": [-0.2, 0.8, 0.1], "description": "pointing with left hand"}`;

    const reply = await llmEngine.generate(prompt, { max_gen_len: 300 });
    console.log('WebLLM raw response:', reply);

    // Try to parse JSON from response
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const poseData = JSON.parse(jsonMatch[0]);
        console.log('Parsed pose data:', poseData);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    }
    console.error('No JSON found in WebLLM response:', reply);
    throw new Error('No JSON found in WebLLM response');
}

async function generateWithOpenAI(text) {
    const apiKey = document.getElementById('openaiKey').value.trim();
    if (!apiKey) {
        throw new Error('OpenAI API key required');
    }

    const messages = [
        {
            role: 'system',
            content: `You are a pose generation AI for a humanoid robot. Convert natural language descriptions into specific 3D coordinates for inverse kinematics.

Use coordinates relative to robot center:
- Forward is +Z, Back is -Z
- Right is +X, Left is -X
- Up is +Y, Down is -Y
- Normal reach distance is about 0.5-0.8 units

Always respond with valid JSON in this exact format:
{
    "leftHand": [x, y, z],
    "rightHand": [x, y, z],
    "description": "brief description of the pose"
}`
        },
        {
            role: 'user',
            content: `Generate pose coordinates for: "${text}"`
        }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 200,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Try to parse JSON
    try {
        const poseData = JSON.parse(content);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    } catch (parseError) {
        // Try to extract JSON from text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const poseData = JSON.parse(jsonMatch[0]);
            conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
            return poseData;
        }
        throw new Error('Invalid JSON in OpenAI response');
    }
}

// Simplified versions of other LLM providers
async function generateWithAnthropic(text) {
    const apiKey = document.getElementById('anthropicKey').value.trim();
    if (!apiKey) {
        throw new Error('Anthropic API key required');
    }

    const messages = [{
        role: 'user',
        content: `Convert this pose description into specific IK target positions for a humanoid robot.
        Description: "${text}"

        Respond with JSON format like:
        {
            "leftHand": [x, y, z],
            "rightHand": [x, y, z],
            "description": "brief description"
        }

        Use coordinates relative to robot center, where:
        - Forward is +Z, Back is -Z
        - Right is +X, Left is -X
        - Up is +Y, Down is -Y
        - Normal reach distance is about 0.5-0.8 units`
    }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: messages,
            max_tokens: 300,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text.trim();

    // Try to parse JSON
    try {
        const poseData = JSON.parse(content);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const poseData = JSON.parse(jsonMatch[0]);
            conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
            return poseData;
        }
        throw new Error('Invalid JSON in Anthropic response');
    }
}

async function generateWithOllama(text) {
    const modelName = document.getElementById('ollamaModel').value.trim() || 'llama2:7b';

    const prompt = `Convert this pose description into specific IK target positions for a humanoid robot.
    Description: "${text}"

    Respond with JSON format like:
    {
        "leftHand": [x, y, z],
        "rightHand": [x, y, z],
        "description": "brief description"
    }

    Use coordinates relative to robot center, where:
    - Forward is +Z, Back is -Z
    - Right is +X, Left is -X
    - Up is +Y, Down is -Y
    - Normal reach distance is about 0.5-0.8 units`;

    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelName,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3,
                num_predict: 200
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.response.trim();

    try {
        const poseData = JSON.parse(content);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const poseData = JSON.parse(jsonMatch[0]);
            conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
            return poseData;
        }
        throw new Error('Invalid JSON in Ollama response');
    }
}

async function generateWithLMStudio(text) {
    const baseUrl = document.getElementById('lmstudioUrl').value.trim() || 'http://localhost:1234';

    const messages = [{
        role: 'user',
        content: `Convert this pose description into specific IK target positions for a humanoid robot.
        Description: "${text}"

        Respond with JSON format like:
        {
            "leftHand": [x, y, z],
            "rightHand": [x, y, z],
            "description": "brief description"
        }

        Use coordinates relative to robot center, where:
        - Forward is +Z, Back is -Z
        - Right is +X, Left is -X
        - Up is +Y, Down is -Y
        - Normal reach distance is about 0.5-0.8 units`
    }];

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,
            max_tokens: 300,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
        const poseData = JSON.parse(content);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const poseData = JSON.parse(jsonMatch[0]);
            conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
            return poseData;
        }
        throw new Error('Invalid JSON in LM Studio response');
    }
}

async function generateWithTogether(text) {
    const apiKey = document.getElementById('togetherKey').value.trim();
    if (!apiKey) {
        throw new Error('Together AI API key required');
    }

    const messages = [{
        role: 'user',
        content: `Convert this pose description into specific IK target positions for a humanoid robot.
        Description: "${text}"

        Respond with JSON format like:
        {
            "leftHand": [x, y, z],
            "rightHand": [x, y, z],
            "description": "brief description"
        }

        Use coordinates relative to robot center, where:
        - Forward is +Z, Back is -Z
        - Right is +X, Left is -X
        - Up is +Y, Down is -Y
        - Normal reach distance is about 0.5-0.8 units`
    }];

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'meta-llama/Llama-2-70b-chat-hf',
            messages: messages,
            max_tokens: 300,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`Together AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
        const poseData = JSON.parse(content);
        conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
        return poseData;
    } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const poseData = JSON.parse(jsonMatch[0]);
            conversationHistory.push({ input: text, output: JSON.stringify(poseData) });
            return poseData;
        }
        throw new Error('Invalid JSON in Together AI response');
    }
}