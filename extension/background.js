// Chrome MV3 service worker
// Toolbar click injects Specter on any page (not just localhost)
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
});
