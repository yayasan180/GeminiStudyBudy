# 🧠 Gemini Study Buddy - Chrome Extension

## 🚀 Inspiration
The project was inspired by the overwhelming amount of information online and the limited time we have to process it.  
Reading long articles or browsing multiple pages to find answers is time-consuming.  
This Chrome extension **summarizes pages automatically** and allows users to **interact with the content via a Q&A system**, making research and learning much faster and more efficient.

## 💡 What it does
- **Automatic Summarization**: Extracts the main content from any webpage and generates a concise summary.  
- **Interactive Q&A**: Allows users to ask questions about the page content and receive accurate answers.  

**Key features:**  
- Works on blogs, news articles, and research pages.  
- Fully powered by AI (Gemini and ChatGPT).  
- Demonstrates that **AI is only as good as the prompts guiding it**.

## 🛠️ How we built it
- **Defining the Vision**: Asked Gemini to propose a **unique Chrome extension worthy of a top 3 hackathon**. Selected this summarization + Q&A idea.  
- **Prompt-Guided Development**: Used precise prompts to let Gemini **generate, adapt, and correct 100% of the code**.  
- **Content Script**: Extracts main text from pages:
```javascript
function getPageText() {
    return document.body.innerText;
}
