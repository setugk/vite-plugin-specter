// Firefox MV2 background script
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id, { type: 'specter-toggle' });
});
