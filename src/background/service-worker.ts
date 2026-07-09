// 툴바 아이콘을 클릭하면 현재 탭 옆에 사이드패널이 열리도록 설정.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('sidePanel 설정 실패:', err))
})
