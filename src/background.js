/**
 * 更新圖示上的重複分頁數量標記 (Badge)
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map();
    let duplicateCount = 0;

    for (const tab of tabs) {
      // 略過空白頁或系統頁面
      if (!tab.url || tab.url.startsWith('chrome://')) continue;
      
      if (urlMap.has(tab.url)) {
        duplicateCount++;
      } else {
        urlMap.set(tab.url, true);
      }
    }

    // 更新 Badge 文字：若有重複顯示數字，否則清除
    const text = duplicateCount > 0 ? duplicateCount.toString() : "";
    await chrome.action.setBadgeText({ text: text });
    await chrome.action.setBadgeBackgroundColor({ color: "#F44336" }); // 顯眼的紅色
  } catch (error) {
    console.error("更新 Badge 失敗:", error);
  }
}

/**
 * 核心清理邏輯：使用 Hash Map 達成 O(n) 效率
 */
async function clearDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const seenUrls = new Map(); // Key: URL, Value: TabID
    const tabsToRemove = [];

    // 1. 依照 ID 由小到大排序，確保我們是由舊到新處理（ID 越大越新）
    tabs.sort((a, b) => a.id - b.id);

    // 2. 遍歷一次所有分頁
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) continue;

      if (seenUrls.has(tab.url)) {
        // 如果已經看過這個 URL，將 Map 中記錄的「舊 ID」加入刪除清單
        // 並將 Map 更新為目前這個「較新」的 ID
        tabsToRemove.push(seenUrls.get(tab.url));
        seenUrls.set(tab.url, tab.id);
      } else {
        seenUrls.set(tab.url, tab.id);
      }
    }

    // 3. 執行批次刪除
    if (tabsToRemove.length > 0) {
      await chrome.tabs.remove(tabsToRemove);
      console.log(`成功清理 ${tabsToRemove.length} 個重複分頁。`);
    }
    
    // 清理後重新計算 Badge
    updateBadge();
  } catch (error) {
    console.error("清理分頁失敗:", error);
  }
}

// --- 事件監聽與初始化 ---

/**
 * 插件安裝或啟動時初始化
 */
chrome.runtime.onInstalled.addListener(() => {
  // 建立右鍵選單：點擊 Icon 右鍵時顯示
  chrome.contextMenus.create({
    id: "open-manager",
    title: "開啟重複分頁管理員",
    contexts: ["action"]
  });
  
  updateBadge();
});

/**
 * 監聽右鍵選單點擊事件
 */
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-manager") {
    // 開啟獨立的管理頁面
    chrome.tabs.create({ url: "manager.html" });
  }
});

/**
 * 當「左鍵」點擊擴充功能圖示時觸發：直接執行快速清理
 */
chrome.action.onClicked.addListener(() => {
  clearDuplicates();
});

/**
 * 監聽分頁狀態變動，自動同步 Badge 數字
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateBadge();
});
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onCreated.addListener(updateBadge);

// 瀏覽器啟動時也跑一次初始化
chrome.runtime.onStartup.addListener(updateBadge);