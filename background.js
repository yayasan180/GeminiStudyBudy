// background.js

// --- IMPORTANT: Replace with your actual Gemini API Key ---
const GEMINI_API_KEY = "AIzaSyAhaSV9UKD5CI1ZIsonMLOisSHVFYuVfVY"; // <--- THIS LINE
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL_NAME = "gemini-pro-latest";

// Function to call the Gemini API
async function callGeminiAPI(promptContent) {
    const fullUrl = `${GEMINI_API_URL}${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = JSON.stringify({
        contents: [{
            parts: [{ text: promptContent }]
        }]
    });

    console.log("--- Gemini API Call ---");
    console.log("Request URL:", fullUrl);
    console.log("Request Body (truncated):", requestBody.substring(0, 500) + (requestBody.length > 500 ? '...' : ''));
    console.log("-----------------------");

    try {
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: requestBody
        });

        console.log("Response Status:", response.status);
        console.log("Response OK:", response.ok);

        const responseText = await response.text();
        console.log("Raw Response Text (first 500 chars):", responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

        if (!response.ok) {
            let errorDetail = responseText;
            try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.error && errorJson.error.message) {
                    errorDetail = errorJson.error.message;
                } else if (errorJson.message) {
                    errorDetail = errorJson.message;
                }
            } catch (e) {
                /* responseText was not valid JSON, use it as is */
            }
            throw new Error(`Gemini API HTTP Error ${response.status}: ${errorDetail}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse response as JSON, even though status was OK:", e);
            throw new Error(`Gemini API returned non-JSON response with status OK: ${responseText.substring(0, 200)}...`);
        }

        if (data.candidates && data.candidates.length > 0) {
            const firstCandidate = data.candidates[0];
            if (firstCandidate.finishReason === 'SAFETY') {
                console.warn("Gemini API blocked content due to safety concerns:", firstCandidate.safetyRatings);
                return "Sorry, I cannot process this content due to safety policies. Please try a different page or question.";
            }
            return firstCandidate.content.parts[0].text;
        } else if (data.promptFeedback && data.promptFeedback.blockReason === 'SAFETY') {
             console.warn("Gemini API blocked prompt due to safety concerns:", data.promptFeedback.safetyRatings);
             return "Sorry, your request was blocked due to safety policies. Please rephrase or try a different question.";
        }
        return "No content generated from Gemini API.";

    } catch (error) {
        console.error("Caught error during Gemini API call:", error);
        return `Failed to connect to Gemini API: ${error.message || error}`;
    }
}


// --- Context Menus ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarizeSelection",
    title: "Gemini: Summarize Selection",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "askSelection",
    title: "Gemini: Ask about Selection...",
    contexts: ["selection"]
  });
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const selectedText = info.selectionText;
    if (!selectedText) {
        console.warn("No text selected for context menu action.");
        return;
    }

    if (info.menuItemId === "summarizeSelection") {
        console.log("Context menu: Summarize Selection - Text:", selectedText.substring(0, 100));
        // Fetch summarization settings from storage
        const settings = await chrome.storage.local.get(['summaryLength', 'summaryTone']);
        const summaryLength = settings.summaryLength || 'default'; // 'short', 'medium', 'long'
        const summaryTone = settings.summaryTone || 'neutral'; // 'neutral', 'formal', 'casual'

        let lengthInstruction = "Keep it concise.";
        if (summaryLength === 'short') lengthInstruction = "Provide a very brief summary.";
        if (summaryLength === 'medium') lengthInstruction = "Provide a comprehensive summary.";
        if (summaryLength === 'long') lengthInstruction = "Provide a detailed summary with main points.";

        let toneInstruction = "";
        if (summaryTone === 'formal') toneInstruction = "Use a formal tone.";
        if (summaryTone === 'casual') toneInstruction = "Use a casual tone.";

        const prompt = `Please summarize the following selected text. ${lengthInstruction} ${toneInstruction} Focus on the main points.

        Selected Text:
        """
        ${selectedText}
        """`;
        const summary = await callGeminiAPI(prompt);
        // Instead of alert, send to content script for a more integrated display
        chrome.tabs.sendMessage(tab.id, {
            action: "displaySelectionResult",
            type: "summary",
            content: summary,
            originalText: selectedText // Send original text too
        });

    } else if (info.menuItemId === "askSelection") {
        console.log("Context menu: Ask about Selection - Text:", selectedText.substring(0, 100));
        // Store the selected text and signal the popup to handle it
        await chrome.storage.session.set({
            selectedTextForQuestion: selectedText,
            actionType: "ask"
        });
        chrome.action.openPopup(); // Open the main extension popup
    }
});


// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        // Send MODEL_NAME to popup when requested
        if (request.action === "getGeminiModelName") {
            sendResponse({ modelName: MODEL_NAME });
            return;
        }

        if (request.action === "summarizeText") {
            console.log("Background: Received summarizeText request.");
            const pageText = request.text;
            if (!pageText || pageText.length < 50) {
                sendResponse({ error: "Not enough content to summarize." });
                return;
            }

            // Fetch summarization settings from storage
            const settings = await chrome.storage.local.get(['summaryLength', 'summaryTone']);
            const summaryLength = settings.summaryLength || 'default'; // 'short', 'medium', 'long'
            const summaryTone = settings.summaryTone || 'neutral'; // 'neutral', 'formal', 'casual'

            let lengthInstruction = "Keep the summary under 300 words and focus on main points and key takeaways.";
            if (summaryLength === 'short') lengthInstruction = "Provide a very brief summary, ideally under 100 words.";
            if (summaryLength === 'medium') lengthInstruction = "Provide a concise summary, ideally under 250 words.";
            if (summaryLength === 'long') lengthInstruction = "Provide a detailed summary, highlighting all significant aspects.";

            let toneInstruction = "";
            if (summaryTone === 'formal') toneInstruction = "Use a formal tone.";
            if (summaryTone === 'casual') toneInstruction = "Use a casual tone.";


            const prompt = `Please summarize the following article. ${lengthInstruction} ${toneInstruction} If the content is very short or irrelevant, state that you cannot provide a meaningful summary.

            Article:
            """
            ${pageText}
            """`;

            const summary = await callGeminiAPI(prompt);
            sendResponse({ summary: summary });

        } else if (request.action === "askQuestion") {
            console.log("Background: Received askQuestion request.");
            const pageText = request.text;
            const question = request.question;

            if (!pageText || pageText.length < 50) {
                console.log("Background: Not enough content for Q&A.");
                sendResponse({ error: "Not enough content available to answer questions." });
                return;
            }
            if (!question) {
                console.log("Background: No question provided for Q&A.");
                sendResponse({ error: "No question provided." });
                return;
            }

            console.log("Background: Calling Gemini for Q&A with question:", question);

            // Fetch Q&A settings from storage if you want to add them later (e.g., answer detail level)
            // For now, it uses a standard prompt.
            const prompt = `Based on the following document, answer the question: "${question}".
            Only use information from the provided document to formulate your answer. If the document does not contain enough information to answer the question, state that.
            Keep the answer concise and to the point.

            Document:
            """
            ${pageText}
            """

            Question: "${question}"
            Answer:`;

            const answer = await callGeminiAPI(prompt);
            console.log("Background: Gemini API returned answer (or error string):", answer);
            sendResponse({ answer: answer });
        }
    })();
    return true; // Keep the message channel open for async sendResponse
});