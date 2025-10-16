// popup.js (updated for Phase 5)

let cachedPageContent = '';
let displayedModelName = 'N/A';

document.addEventListener('DOMContentLoaded', async () => {
    const summarizeBtn = document.getElementById('summarizeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const questionInput = document.getElementById('questionInput');
    const askQuestionBtn = document.getElementById('askQuestionBtn');
    const summaryText = document.getElementById('summaryText');
    const answerText = document.getElementById('answerText');
    const loadingSpinner = document.getElementById('loading');
    const errorMessage = document.getElementById('error');
    const contentLengthSpan = document.getElementById('contentLength');
    const geminiModelStatusSpan = document.getElementById('geminiModelStatus');

    // NEW: Settings elements
    const summaryLengthSelect = document.getElementById('summaryLength');
    const summaryToneSelect = document.getElementById('summaryTone');

    function resetUI() {
        summaryText.textContent = '';
        answerText.textContent = '';
        questionInput.value = '';
        loadingSpinner.style.display = 'none';
        errorMessage.style.display = 'none';
        contentLengthSpan.textContent = '';
        geminiModelStatusSpan.textContent = `Model: ${displayedModelName}`;
        cachedPageContent = '';
        console.log("UI Reset.");
    }

    function setLoading(isLoading, message = 'Processing...') {
        loadingSpinner.textContent = message;
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
        console.log(`Loading state: ${isLoading}, Message: ${message}`);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        console.error("Extension Error (Popup):", message);
    }

    async function getPageContent() {
        setLoading(true, 'Extracting page content...');
        errorMessage.style.display = 'none';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageContent" });
            console.log("getPageContent response:", response);

            if (response && response.content) {
                cachedPageContent = response.content;
                if (cachedPageContent.length < 100) {
                    showError("Could not extract enough readable content from this page. Try a different page or select text manually.");
                    contentLengthSpan.textContent = `Content: ${cachedPageContent.length} chars (too short)`;
                    return null;
                }
                contentLengthSpan.textContent = `Content: ${cachedPageContent.length} chars`;
                geminiModelStatusSpan.textContent = `Model: ${displayedModelName}`;
                console.log(`Page content extracted. Length: ${cachedPageContent.length}`);
                return cachedPageContent;
            } else {
                showError("Failed to extract content from the page.");
                return null;
            }
        } catch (e) {
            showError(`Error extracting page content: ${e.message}`);
            console.error("Error in getPageContent:", e);
            return null;
        } finally {
            setLoading(false);
        }
    }

    // --- Fetch model name on startup ---
    try {
        const modelResponse = await chrome.runtime.sendMessage({ action: "getGeminiModelName" });
        if (modelResponse && modelResponse.modelName) {
            displayedModelName = modelResponse.modelName;
            geminiModelStatusSpan.textContent = `Model: ${displayedModelName}`;
            console.log("Fetched Gemini Model Name:", displayedModelName);
        }
    } catch (e) {
        console.error("Failed to fetch Gemini Model Name:", e);
        geminiModelStatusSpan.textContent = `Model: ${displayedModelName} (Error)`;
    }
    resetUI(); // Call reset after fetching model name to update display


    // --- Handle Settings Load and Save ---
    async function loadSettings() {
        const settings = await chrome.storage.local.get(['summaryLength', 'summaryTone']);
        summaryLengthSelect.value = settings.summaryLength || 'default';
        summaryToneSelect.value = settings.summaryTone || 'neutral';
        console.log("Settings loaded:", settings);
    }

    async function saveSettings() {
        await chrome.storage.local.set({
            summaryLength: summaryLengthSelect.value,
            summaryTone: summaryToneSelect.value
        });
        console.log("Settings saved.");
    }

    // Load settings when popup opens
    await loadSettings();

    // Save settings when dropdowns change
    summaryLengthSelect.addEventListener('change', saveSettings);
    summaryToneSelect.addEventListener('change', saveSettings);


    // --- Check for selected text from context menu on popup open ---
    chrome.storage.session.get(['selectedTextForQuestion', 'actionType'], async (result) => {
        if (result.selectedTextForQuestion && result.actionType === "ask") {
            questionInput.value = `Based on the following selected text, `;
            cachedPageContent = result.selectedTextForQuestion; // Cache selected text as current content
            contentLengthSpan.textContent = `Selection: ${cachedPageContent.length} chars`;
            await chrome.storage.session.remove(['selectedTextForQuestion', 'actionType']); // Clear storage
            console.log("Popup opened with pre-filled question prompt, selected text was in cache.");
        }
    });


    summarizeBtn.addEventListener('click', async () => {
        summaryText.textContent = '';
        answerText.textContent = '';
        errorMessage.style.display = 'none';
        console.log("Summarize button clicked.");

        const pageContent = await getPageContent();
        if (!pageContent) {
            console.log("Summarize: No page content, stopping.");
            return;
        }

        setLoading(true, 'Asking Gemini to summarize...');
        try {
            const response = await chrome.runtime.sendMessage({ action: "summarizeText", text: pageContent });
            console.log("Summarize response from background:", response);

            if (response && response.summary) {
                summaryText.textContent = response.summary;
            } else if (response && response.error) {
                showError(`Error summarizing: ${response.error}`);
            } else {
                showError("An unknown error occurred during summarization.");
            }
        } catch (e) {
            showError(`Communication error with background script for summarization: ${e.message}`);
            console.error("Summarize communication error:", e);
        } finally {
            setLoading(false);
        }
    });

    askQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (!question) {
            showError("Please enter a question.");
            console.log("Q&A Debug: No question entered.");
            return;
        }

        answerText.textContent = '';
        errorMessage.style.display = 'none';
        console.log("Ask Question button clicked. Question:", question);

        let contentToUse = cachedPageContent;

        if (!contentToUse || contentToUse.length < 100) {
            console.log("Q&A Debug: Cached content too short or empty, attempting to re-extract full page.");
            contentToUse = await getPageContent();
            if (!contentToUse) {
                showError("No valid page content available to answer questions. Try summarizing first or selecting text.");
                console.log("Q&A Debug: Failed to get page content for Q&A.");
                return;
            }
        }

        console.log("Q&A Debug: Content length for API call:", contentToUse.length);
        console.log("Q&A Debug: Question for API call:", question);

        setLoading(true, 'Asking Gemini to answer...');
        try {
            const response = await chrome.runtime.sendMessage({ action: "askQuestion", text: contentToUse, question: question });

            console.log("Q&A Debug: Response from background script:", response);

            if (response && response.answer) {
                answerText.textContent = response.answer;
                console.log("Q&A Debug: Answer displayed:", response.answer);
            } else if (response && response.error) {
                showError(`Error answering question: ${response.error}`);
                console.log("Q&A Debug: Error from background script:", response.error);
            } else {
                showError("An unknown error occurred while answering your question.");
                console.log("Q&A Debug: Unknown error/no answer in response.");
            }
        } catch (e) {
            showError(`Communication error with background script for Q&A: ${e.message}`);
            console.error("Q&A Debug: Communication error:", e);
        } finally {
            setLoading(false);
        }
    });

    clearBtn.addEventListener('click', resetUI);
});