async function openSidePanel(tabId?: number): Promise<void> {
  if (!tabId) return
  try {
    await chrome.sidePanel.open({ tabId })
  } catch (err) {
    console.error('sidePanel open failed:', err)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => console.error('sidePanel setup failed:', err))
})

chrome.action.onClicked.addListener((tab) => {
  openSidePanel(tab.id)
})
