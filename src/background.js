// --- 效能優化變數 ---
let updateTimeout = null; // 防抖定時器
let isProcessing = false; // 鎖定狀態，避免重疊執行

/**
 * 更新圖示上的重複分頁數量標記 (Badge)
 */
async function updateBadge() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map();
    let duplicateCount = 0;

    for (const tab of tabs) {
      // 略過空白頁、系統頁面，或尚未載入完成的 URL
      const targetUrl = tab.url || tab.pendingUrl;
      if (!targetUrl || targetUrl.startsWith('chrome://')) continue;
      
      if (urlMap.has(targetUrl)) {
        duplicateCount++;
      } else {
        urlMap.set(targetUrl, true);
      }
    }

    const text = duplicateCount > 0 ? duplicateCount.toString() : "";
    await chrome.action.setBadgeText({ text: text });
    await chrome.action.setBadgeBackgroundColor({ color: "#F44336" });
  } catch (error) {
    console.error("更新 Badge 失敗:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * 防抖包裝器 (Debounce Wrapper)
 * 確保在 500ms 內的大量連續事件只觸發一次計算
 */
function debouncedUpdateBadge() {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateBadge();
    updateTimeout = null;
  }, 500);
}

/**
 * 核心清理邏輯：使用 Hash Map 達成 O(n) 效率
 */
async function clearDuplicates() {
  try {
    const tabs = await chrome.tabs.query({});
    const seenUrls = new Map();
    const tabsToRemove = [];

    // 1. 依照 ID 由小到大排序 (ID 越大越新)
    tabs.sort((a, b) => a.id - b.id);

    // 2. 遍歷一次所有分頁
    for (const tab of tabs) {
      const targetUrl = tab.url || tab.pendingUrl;
      if (!targetUrl || targetUrl.startsWith('chrome://')) continue;

      if (seenUrls.has(targetUrl)) {
        tabsToRemove.push(seenUrls.get(targetUrl));
        seenUrls.set(targetUrl, tab.id);
      } else {
        seenUrls.set(targetUrl, tab.id);
      }
    }

    // 3. 執行批次刪除
    if (tabsToRemove.length > 0) {
      await chrome.tabs.remove(tabsToRemove);
    }
    
    // 清理後重新計算時不需要防抖，立即執行
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
  chrome.contextMenus.create({
    id: "open-manager",
    title: "開啟重複分頁管理員",
    contexts: ["action"]
  });
  debouncedUpdateBadge();
});

/**
 * 監聽右鍵選單點擊事件
 */
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-manager") {
    chrome.tabs.create({ url: "manager.html" });
  }
});

/**
 * 當「左鍵」點擊擴充功能圖示時觸發
 */
chrome.action.onClicked.addListener(() => {
  clearDuplicates();
});

/**
 * 監聽分頁狀態變動，使用「防抖版本」
 * 解決重新啟動時 1000+ 分頁集體觸發導致的崩潰
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 僅在 URL 改變或載入完成時觸發，過濾掉頻繁的 favicon/title 更新
  if (changeInfo.url || changeInfo.status === 'complete') {
    debouncedUpdateBadge();
  }
});

chrome.tabs.onRemoved.addListener(debouncedUpdateBadge);
chrome.tabs.onCreated.addListener(debouncedUpdateBadge);
chrome.runtime.onStartup.addListener(debouncedUpdateBadge);