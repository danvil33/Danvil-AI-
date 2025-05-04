// Initialize variables
let currentModel = 'danvil-pro';
let chatHistory = JSON.parse(localStorage.getItem('danvilChatHistory')) || [];
let isTyping = false;
let isLoading = false;
let isPaused = false;
let typingInterval = null;
const cache = new Map();
const MAX_INPUT_LENGTH = 1000;

// Replace with your Google Apps Script Web app URL
const API_KEY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz-H9atJ9NSHrF_4FN5yyUYTDKi4_PxQQdz-yoiyN9obS_vy8MQciosXAD4zMGftZea/exec'; // Update with your actual URL

// DOM elements
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const modelBtn = document.getElementById('model-btn');
const modelSelector = document.getElementById('model-selector');
const resultsContainer = document.querySelector('.results-container');
const historyBtn = document.getElementById('history-btn');
const historyPanel = document.getElementById('chat-history');
const historyClose = document.getElementById('history-close');
const historyItems = document.querySelector('.history-items');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const voiceToggle = document.getElementById('voice-toggle');
const scrollToggle = document.getElementById('scroll-toggle');
const clearHistoryBtn = document.getElementById('clear-history');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

// Auto-resize textarea and validate length
function autoResizeTextarea() {
    userInput.style.height = '40px';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
    if (userInput.value.length > MAX_INPUT_LENGTH) {
        userInput.value = userInput.value.slice(0, MAX_INPUT_LENGTH);
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
    }
}

userInput.addEventListener('input', autoResizeTextarea);

// Model selector toggle
modelBtn.addEventListener('click', () => {
    modelSelector.classList.toggle('active');
});

// Model selection
document.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', function() {
        currentModel = this.getAttribute('data-model');
        modelSelector.classList.remove('active');

        const notification = document.createElement('div');
        notification.className = 'result-box user';
        notification.innerHTML = `
            <div class="message-content">
                <p>Mode Changed: Now using ${this.querySelector('.model-name').textContent}</p>
            </div>
        `;
        resultsContainer.appendChild(notification);
        notification.scrollIntoView({ behavior: 'smooth' });

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    });
});

// Close model selector when clicking outside
document.addEventListener('click', (e) => {
    if (!modelBtn.contains(e.target) && !modelSelector.contains(e.target)) {
        modelSelector.classList.remove('active');
    }
});

// Chat history panel
historyBtn.addEventListener('click', () => {
    renderHistory();
    historyPanel.classList.add('active');
});

historyClose.addEventListener('click', () => {
    historyPanel.classList.remove('active');
});

// Settings panel
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('active');
});

settingsClose.addEventListener('click', () => {
    settingsPanel.classList.remove('active');
});

// Clear history
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
        chatHistory = [];
        localStorage.setItem('danvilChatHistory', JSON.stringify(chatHistory));
        resultsContainer.innerHTML = '';
        renderHistory();
    }
});

// Allow pressing Enter to submit
userInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey && !isTyping) {
        event.preventDefault();
        sendMessage();
    }
});

// Click send button to send message
sendBtn.addEventListener('click', sendMessage);

// Function to send message
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    if (message.length > MAX_INPUT_LENGTH) {
        errorMessage.style.display = 'block';
        return;
    }

    document.querySelector('.welcome-message').style.display = 'none';

    addMessageToChat('You', message, 'user');
    userInput.value = '';
    autoResizeTextarea();

    showTypingIndicator();
    showLoadingSpinner();

    try {
        let response = await generateAIResponse(message);
        hideTypingIndicator();
        hideLoadingSpinner();

        if (message.toLowerCase().includes('who created you') || message.toLowerCase().includes('who made you')) {
            response = `### Creator\n\nI am Danvil AI, created by Danvil, a student at MUST University.`;
        }

        typeResponse(response);
    } catch (error) {
        hideTypingIndicator();
        hideLoadingSpinner();
        addMessageToChat('Danvil', `### Error\n\n${error.message}. Try again.`, 'ai');
    }
}

// Function to add message to chat
function addMessageToChat(sender, message, type) {
    const messageId = 'msg-' + Date.now();
    const messageBox = document.createElement('div');
    messageBox.className = `result-box ${type}`;
    messageBox.id = messageId;

    if (type === 'user') {
        messageBox.innerHTML = `
            <div class="message-content">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    } else if (type === 'ai') {
        const processedMessage = marked.parse(message);
        messageBox.innerHTML = `
            <img src="https://raw.githubusercontent.com/danvil33/Danvil-AI-/refs/heads/main/images%20(9).jpeg" alt="Danvil AI Logo" class="ai-logo">
            <div class="message-content">
                <div class="ai-response">${processedMessage}</div>
                <div class="action-icons">
                    <i class="fas fa-copy copy-btn" title="Copy Response"></i>
                    <i class="fas fa-thumbs-up like-btn" title="Like"></i>
                    <i class="fas fa-thumbs-down dislike-btn" title="Dislike"></i>
                    <i class="fas fa-pause pause-btn" title="Pause/Resume"></i>
                </div>
            </div>
        `;
        const copyBtn = messageBox.querySelector('.copy-btn');
        const likeBtn = messageBox.querySelector('.like-btn');
        const dislikeBtn = messageBox.querySelector('.dislike-btn');
        const pauseBtn = messageBox.querySelector('.pause-btn');

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(message).then(() => {
                copyBtn.classList.add('copied');
                copyBtn.classList.remove('fa-copy');
                copyBtn.classList.add('fa-check');
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.classList.remove('fa-check');
                    copyBtn.classList.add('fa-copy');
                }, 2000);
            });
        });

        likeBtn.addEventListener('click', () => {
            likeBtn.classList.toggle('liked');
            if (likeBtn.classList.contains('liked')) {
                dislikeBtn.classList.remove('disliked');
            }
        });

        dislikeBtn.addEventListener('click', () => {
            dislikeBtn.classList.toggle('disliked');
            if (dislikeBtn.classList.contains('disliked')) {
                likeBtn.classList.remove('liked');
            }
        });

        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseBtn.classList.toggle('paused', isPaused);
            pauseBtn.classList.toggle('fa-pause', !isPaused);
            pauseBtn.classList.toggle('fa-play', isPaused);
            pauseBtn.title = isPaused ? 'Resume' : 'Pause';
        });

        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    resultsContainer.appendChild(messageBox);

    if (scrollToggle.checked) {
        messageBox.scrollIntoView({ behavior: 'smooth' });
    }

    if (type !== 'typing') {
        chatHistory.push({
            id: messageId,
            sender,
            message,
            type,
            timestamp: new Date().toISOString(),
            model: type === 'ai' ? currentModel : null
        });

        localStorage.setItem('danvilChatHistory', JSON.stringify(chatHistory));
    }

    return messageBox;
}

// Function to show typing indicator
function showTypingIndicator() {
    isTyping = true;
    const typingBox = document.createElement('div');
    typingBox.className = 'result-box ai';
    typingBox.id = 'typing-indicator';
    typingBox.innerHTML = `
        <img src="https://raw.githubusercontent.com/danvil33/Danvil-AI-/refs/heads/main/images%20(9).jpeg" alt="Danvil AI Logo" class="ai-logo">
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    resultsContainer.appendChild(typingBox);

    if (scrollToggle.checked) {
        typingBox.scrollIntoView({ behavior: 'smooth' });
    }

    chatHistory.push({
        id: 'typing-indicator',
        sender: 'Danvil',
        message: '...',
        type: 'typing',
        timestamp: new Date().toISOString()
    });
}

// Function to hide typing indicator
function hideTypingIndicator() {
    isTyping = false;
    const typingBox = document.getElementById('typing-indicator');
    if (typingBox) typingBox.remove();

    chatHistory = chatHistory.filter(item => item.id !== 'typing-indicator');
    localStorage.setItem('danvilChatHistory', JSON.stringify(chatHistory));
}

// Function to show loading spinner
function showLoadingSpinner() {
    isLoading = true;
    loadingSpinner.classList.add('active');
}

// Function to hide loading spinner
function hideLoadingSpinner() {
    isLoading = false;
    loadingSpinner.classList.remove('active');
}

// Function to simulate typing effect with pause/resume
function typeResponse(response) {
    const messageBox = addMessageToChat('Danvil', '', 'ai');
    const responseDiv = messageBox.querySelector('.ai-response');
    let index = 0;
    const chars = response.split('');

    function typeChar() {
        if (isPaused) {
            typingInterval = setTimeout(typeChar, 100);
            return;
        }

        if (index < chars.length) {
            responseDiv.innerHTML = marked.parse(chars.slice(0, index + 1).join(''));
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            index++;
            typingInterval = setTimeout(typeChar, 10); // Character-by-character, 10ms delay
        } else {
            clearTimeout(typingInterval);
            if (voiceToggle.checked) {
                speakResponse(response);
            }
        }
    }

    typeChar();
}

// Function to get conversation history context
function getConversationContext() {
    const relevantHistory = chatHistory
        .filter(item => item.type !== 'typing')
        .slice(-5); // Limit to last 5 messages
    let context = '';
    relevantHistory.forEach(item => {
        const role = item.sender === 'You' ? 'User' : 'Danvil';
        const truncatedMessage = item.message.length > 200 
            ? item.message.slice(0, 197) + '...' 
            : item.message;
        context += `${role}: ${truncatedMessage}\n`;
    });
    return context;
}

// Function to fetch API key from Google Apps Script
async function fetchApiKey() {
    try {
        const response = await fetch(API_KEY_ENDPOINT);
        if (!response.ok) {
            throw new Error('Failed to fetch API key');
        }
        return await response.text();
    } catch (error) {
        console.error('Error fetching API key:', error);
        throw new Error('Unable to retrieve API key. Please try again later.');
    }
}

// Function to generate AI response using Google Gemini API
async function generateAIResponse(prompt) {
    if (prompt.length > MAX_INPUT_LENGTH) {
        throw new Error('Input exceeds 1000 characters. Please shorten it.');
    }

    const cacheKey = `ai_${prompt}_${currentModel}`;
    if (cache.has(cacheKey)) {
        console.log('Returning cached response for:', cacheKey);
        return cache.get(cacheKey);
    }

    try {
        const geminiModel = 'gemini-1.5-flash';
        const apiKey = await fetchApiKey();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

        // Build prompt based on mode
        let systemPrompt = `You are Danvil AI, an AI assistant created by Danvil, a student from MUST University. Provide short, clear, and accurate responses in markdown format. Use headers, lists, and code blocks where appropriate. Do not mention Google or other AI providers.`;
        
        if (currentModel === 'danvil-fast') {
            systemPrompt += ` You are in Search mode. Provide comprehensive, detailed, and well-structured answers, as if synthesizing information from a web search. Include examples, facts, and structured sections where relevant, and aim for depth and clarity.`;
        }

        // Include conversation history
        const conversationContext = getConversationContext();
        const fullPrompt = conversationContext
            ? `${systemPrompt}\n\n### Conversation History\n${conversationContext}\n### Current Prompt\nUser: ${prompt}`
            : `${systemPrompt}\n\n### Current Prompt\nUser: ${prompt}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: fullPrompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: currentModel === 'danvil-fast' ? 0.9 : 0.7,
                    maxOutputTokens: currentModel === 'danvil-fast' ? 800 : 500
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error(`Prompt blocked: ${data.promptFeedback.blockReason}`);
        }

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response from API.');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        cache.set(cacheKey, aiResponse);
        return aiResponse;

    } catch (error) {
        console.error('Error in generateAIResponse:', error);
        if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
            throw new Error('Network error: API request blocked, possibly due to CORS. Use a server-side proxy for production.');
        }
        throw error;
    }
}

// Function to speak AI response
function speakResponse(text) {
    const cleanText = text.replace(/[#*`]+/g, '').replace(/\n/g, ' ').slice(0, 500);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

// Microphone input
micBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Speech recognition not supported. Use Chrome.');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();
    micBtn.style.color = '#ff4757';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.slice(0, MAX_INPUT_LENGTH);
        userInput.value = transcript;
        micBtn.style.color = '';
        sendMessage();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micBtn.style.color = '';
        alert('Speech recognition failed. Try again.');
    };

    recognition.onend = () => {
        micBtn.style.color = '';
    };
});

// Render chat history
function renderHistory() {
    historyItems.innerHTML = '';
    if (chatHistory.length === 0) {
        historyItems.innerHTML = '<p>No chat history available.</p>';
        return;
    }

    chatHistory
        .filter(item => item.type !== 'typing')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            const preview = item.message.length > 50 ? item.message.substring(0, 50) + '...' : item.message;
            historyItem.innerHTML = `
                <strong>${item.sender}</strong>: ${preview}
                <small>${new Date(item.timestamp).toLocaleString()}</small>
            `;
            historyItem.addEventListener('click', () => {
                resultsContainer.innerHTML = '';
                const index = chatHistory.findIndex(h => h.id === item.id);
                chatHistory.slice(0, index + 1).forEach(history => {
                    if (history.type !== 'typing') {
                        addMessageToChat(history.sender, history.message, history.type);
                    }
                });
                historyPanel.classList.remove('active');
                document.querySelector('.welcome-message').style.display = 'none';
            });
            historyItems.appendChild(historyItem);
        });
}

// Auto-scroll observer
const observer = new MutationObserver(() => {
    if (scrollToggle.checked) {
        const latestMessage = resultsContainer.lastElementChild;
        if (latestMessage) {
            latestMessage.scrollIntoView({ behavior: 'smooth' });
        }
    }
});
observer.observe(resultsContainer, { childList: true });

// Initialize Highlight.js
hljs.highlightAll();

// Initialize chat history
renderHistory();
