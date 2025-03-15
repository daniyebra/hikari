// Background service worker for Japanese Hover TTS
// This file handles extension-wide events and state management.
// For example: managing TTS settings, handling messages from content scripts, etc.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Japanese Hover TTS extension installed');
});

// Handle audio fetch requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchAudio') {
        const text = request.text;
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(text)}`;

        // Fetch audio data
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                // Convert blob to data URL
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ 
                        success: true, 
                        audioUrl: reader.result 
                    });
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('Error fetching audio:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });

        // Return true to indicate we'll send response asynchronously
        return true;
    }
}); 