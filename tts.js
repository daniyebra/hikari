/**
 * Japanese Text-to-Speech Feature
 * 
 * Plays Japanese text as audio when selected on non-Netflix pages.
 * Uses Google Translate TTS service via background script.
 */

(function() {
    if (window.location.href.includes('netflix.com/watch')) return;

    // Message display function
    function showMessage(text, duration = 3000) {
        // Remove any existing message box
        const existingBox = document.getElementById('japanese-tts-box');
        if (existingBox) {
            existingBox.remove();
        }

        // Create new message box
        const messageBox = document.createElement('div');
        messageBox.id = 'japanese-tts-box';
        messageBox.textContent = text;
        document.body.appendChild(messageBox);

        // Fade out and remove after duration
        setTimeout(() => {
            messageBox.style.opacity = '0';
            setTimeout(() => messageBox.remove(), 300);
        }, duration);
    }

    // Function to ensure the DOM is ready
    function ensureDOMLoaded() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    // Function to ensure document.body exists
    function ensureBodyExists() {
        return new Promise((resolve) => {
            if (document.body) {
                resolve();
            } else {
                const observer = new MutationObserver((mutations, obs) => {
                    if (document.body) {
                        obs.disconnect();
                        resolve();
                    }
                });
                
                observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }
        });
    }

    // Audio state management
    let currentAudio = null;
    let audioQueue = [];
    let currentSelection = '';

    // Regular expression for Japanese characters
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

    // Function to check if text contains Japanese characters
    function containsJapanese(text) {
        return japaneseRegex.test(text);
    }

    // Function to play text as audio
    function playTextAsAudio(text) {
        if (!text || !containsJapanese(text)) return;

        return new Promise((resolve, reject) => {
            // Send request to background script
            chrome.runtime.sendMessage(
                { 
                    action: 'fetchAudio', 
                    text: text 
                },
                response => {
                    if (response.success) {
                        const audio = new Audio(response.audioUrl);
                        currentAudio = audio;
                        
                        audio.onerror = (error) => {
                            console.error('Japanese TTS: Audio error:', error);
                            showMessage('Error playing audio');
                            reject(error);
                        };

                        audio.play()
                            .then(() => resolve(audio))
                            .catch(error => {
                                console.error('Japanese TTS: Playback error:', error);
                                showMessage('Error playing audio');
                                reject(error);
                            });
                    } else {
                        console.error('Japanese TTS: Failed to fetch audio:', response.error);
                        showMessage('Error fetching audio');
                        reject(new Error(response.error));
                    }
                }
            );
        });
    }

    // Function to split text into segments
    function splitIntoSegments(text, maxLength = 150) {
        const segments = [];
        let currentSegment = '';
        
        // Split on periods and spaces
        const parts = text.split(/([。\s])/);
        
        for (const part of parts) {
            if ((currentSegment + part).length <= maxLength) {
                currentSegment += part;
            } else if (currentSegment) {
                segments.push(currentSegment.trim());
                currentSegment = part;
            } else {
                segments.push(part.trim());
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment.trim());
        }
        
        return segments.filter(segment => segment.length > 0);
    }

    // Function to stop all audio playback
    function stopAllAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        audioQueue.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        audioQueue = [];
        currentSelection = '';
    }

    // Function to play segments sequentially
    async function playSegments(segments, index = 0) {
        if (index >= segments.length) {
            currentAudio = null;
            audioQueue = [];
            return;
        }

        try {
            const audio = await playTextAsAudio(segments[index]);
            if (!audio) return;

            audio.onended = () => {
                if (currentAudio === audio) {
                    playSegments(segments, index + 1);
                }
            };

            audioQueue.push(audio);
        } catch (error) {
            console.error('Japanese TTS: Error playing segment:', error);
            playSegments(segments, index + 1);
        }
    }

    // Debounce function for hover detection
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Handler for mouse out
    function onMouseOut(event) {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
            stopAllAudio();
        }
    }

    // Handler for text selection
    const onTextSelected = debounce(() => {
        const selection = window.getSelection().toString().trim();
        
        if (!selection || selection !== currentSelection) {
            stopAllAudio();
        }

        if (selection && containsJapanese(selection)) {
            currentSelection = selection;
            showMessage('Playing Japanese text...');
            console.log('Japanese TTS: Playing selected text');
            
            const segments = splitIntoSegments(selection);
            playSegments(segments);
        }
    }, 300);

    // Handler for keyboard events
    function onKeyUp(event) {
        if (event.key === 'Escape' || !window.getSelection().toString().trim()) {
            stopAllAudio();
        } else {
            onTextSelected();
        }
    }

    // Initialize TTS feature
    async function initializeExtension() {
        try {
            await ensureDOMLoaded();
            await ensureBodyExists();

            console.log('Japanese TTS: Script loaded');

            // Create and inject our CSS
            const style = document.createElement('style');
            style.textContent = `
                #japanese-tts-box {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #2196F3;
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    z-index: 2147483647;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    max-width: 300px;
                    opacity: 1;
                    transition: opacity 0.3s;
                    pointer-events: none;
                }
            `;

            // Safely append style
            if (document.head) {
                document.head.appendChild(style);
            } else {
                document.documentElement.appendChild(style);
            }

            // Add event listeners
            document.addEventListener('mouseup', onTextSelected);
            document.addEventListener('mouseout', onMouseOut);
            document.addEventListener('keyup', onKeyUp);
            document.addEventListener('selectionchange', debounce(() => {
                if (!window.getSelection().toString().trim()) {
                    stopAllAudio();
                }
            }, 300));

            console.log('Japanese TTS: Initialization complete - Ready to speak Japanese text');

            // Log any errors
            window.addEventListener('error', (e) => {
                console.error('[Japanese TTS] Error:', e.error);
            });
        } catch (error) {
            console.error('Japanese TTS: Initialization error:', error);
        }
    }

    // Start TTS initialization
    initializeExtension();
})(); 