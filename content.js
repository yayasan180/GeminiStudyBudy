// content.js (Consolidated and Updated)

function extractPageText() {
    let mainContent = '';

    const primarySelectors = [
        'article',
        '.post-content',
        '.entry-content',
        '#main-content',
        '#article-content',
        '.content-area',
        '.article-body',
        '.mw-parser-output' // For Wikipedia
    ];

    for (const selector of primarySelectors) {
        const element = document.querySelector(selector);
        if (element) {
            mainContent = element.innerText;
            if (mainContent.length > 300) {
                break;
            }
        }
    }

    if (mainContent.length < 300 && document.body) {
        mainContent = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'))
                           .map(el => el.innerText)
                           .filter(text => text.trim().length > 0)
                           .join('\n\n');
    }

    mainContent = mainContent.replace(/(\n\s*){3,}/g, '\n\n')
                             .replace(/[ \t]+/g, ' ')
                             .trim();

    mainContent = mainContent.split('\n').filter(line => line.length > 5 || line.trim() === '').join('\n');

    return mainContent;
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageContent") {
        const pageText = extractPageText();
        sendResponse({ content: pageText });
        return true;
    } else if (request.action === "displaySelectionResult") {
        // For context menu summarization, we'll show a simple overlay or alert
        // A more sophisticated approach would be to open the popup.
        alert(`Gemini Summary of Selection:\n\n${request.content}`);
        sendResponse({ status: "displayed" });
        return true;
    }
});