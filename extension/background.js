// Chrome MV3 service worker
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'specter-toggle' });
});
