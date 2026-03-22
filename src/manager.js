async function loadDuplicates() {
  const tabs = await chrome.tabs.query({});
  const urlGroups = new Map(); // URL -> Array of Tab IDs

  tabs.forEach(tab => {
    if (!tab.url || tab.url.startsWith('chrome')) return;
    if (!urlGroups.has(tab.url)) {
      urlGroups.set(tab.url, { title: tab.title, ids: [] });
    }
    urlGroups.get(tab.url).ids.push(tab.id);
  });

  const listDiv = document.getElementById('list');
  listDiv.innerHTML = '';
  let totalDups = 0;

  urlGroups.forEach((data, url) => {
    if (data.ids.length > 1) {
      totalDups += (data.ids.length - 1);
      const card = document.createElement('div');
      card.className = 'tab-card';
      card.innerHTML = `
        <div class="info">
          <strong>${data.title}</strong><br>
          <span class="url">${url}</span>
        </div>
        <span class="count">重複 ${data.ids.length - 1} 次</span>
      `;
      listDiv.appendChild(card);
    }
  });

  if (totalDups === 0) {
    listDiv.innerHTML = '<p style="text-align:center; color:#999;">太棒了！目前沒有重複的分頁。</p>';
    document.getElementById('clean-all').style.display = 'none';
  }
}

document.getElementById('clean-all').onclick = async () => {
  const tabs = await chrome.tabs.query({});
  const seen = new Map();
  const toRemove = [];

  // ID 小的代表舊的
  tabs.sort((a, b) => a.id - b.id);
  tabs.forEach(t => {
    if (!t.url || t.url.startsWith('chrome')) return;
    if (seen.has(t.url)) {
      toRemove.push(seen.get(t.url));
    }
    seen.set(t.url, t.id);
  });

  if (toRemove.length > 0) {
    await chrome.tabs.remove(toRemove);
    loadDuplicates(); // 重新整理頁面
  }
};

loadDuplicates();