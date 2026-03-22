/**
 * 取得網域 (Domain)
 */
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return "其他";
  }
}

async function renderManager() {
  const tabs = await chrome.tabs.query({});
  const urlGroups = new Map();    // 統計重複 URL
  const domainGroups = new Map(); // 統計各 Domain 數量

  // 1. 遍歷並統計
  tabs.forEach(tab => {
    if (!tab.url || tab.url.startsWith('chrome')) return;

    // 統計 Domain
    const domain = getDomain(tab.url);
    domainGroups.set(domain, (domainGroups.get(domain) || 0) + 1);

    // 統計重複 URL
    if (!urlGroups.has(tab.url)) {
      urlGroups.set(tab.url, { title: tab.title, ids: [] });
    }
    urlGroups.get(tab.url).ids.push(tab.id);
  });

  // 2. 更新上方 Stats Bar
  document.getElementById('total-tabs').innerText = tabs.length;
  document.getElementById('unique-domains').innerText = domainGroups.size;
  
  let totalDups = 0;
  urlGroups.forEach(data => { if (data.ids.length > 1) totalDups += (data.ids.length - 1); });
  document.getElementById('dup-count').innerText = totalDups;

  // 3. 渲染 Domain 標籤
  const domainContainer = document.getElementById('domain-distribution');
  domainContainer.innerHTML = '<strong>網域分佈：</strong>';
  // 排序：數量多的排前面
  const sortedDomains = [...domainGroups.entries()].sort((a, b) => b[1] - a[1]);
  sortedDomains.forEach(([domain, count]) => {
    const span = document.createElement('span');
    span.className = 'domain-tag';
    span.innerText = `${domain}: ${count}`;
    domainContainer.appendChild(span);
  });

  // 4. 渲染重複列表
  const listDiv = document.getElementById('list');
  listDiv.innerHTML = totalDups > 0 ? '<h3>重複細節</h3>' : '';
  
  urlGroups.forEach((data, url) => {
    if (data.ids.length > 1) {
      const card = document.createElement('div');
      card.className = 'tab-card';
      card.innerHTML = `
        <div>
          <strong>${data.title}</strong><br><span class="url">${url}</span>
        </div>
        <span class="count-badge">${data.ids.length} 個分頁</span>
      `;
      listDiv.appendChild(card);
    }
  });

  document.getElementById('clean-all').style.display = totalDups > 0 ? 'block' : 'none';
}

// 清理邏輯保持不變
document.getElementById('clean-all').onclick = async () => {
  const tabs = await chrome.tabs.query({});
  const seen = new Map();
  const toRemove = [];
  tabs.sort((a, b) => a.id - b.id);
  tabs.forEach(t => {
    if (!t.url || t.url.startsWith('chrome')) return;
    if (seen.has(t.url)) toRemove.push(seen.get(t.url));
    seen.set(t.url, t.id);
  });
  if (toRemove.length > 0) {
    await chrome.tabs.remove(toRemove);
    renderManager(); // 重新渲染
  }
};

// 初始化
renderManager();