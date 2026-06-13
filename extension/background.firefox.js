// Firefox MV2 background script
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.executeScript(tab.id, { file: 'content.js' });
});
