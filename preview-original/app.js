const grid = document.getElementById('linksGrid');
const searchInput = document.getElementById('searchInput');
const searchMode = document.getElementById('searchMode');
const searchSubmit = document.getElementById('searchSubmit');
const clearSearch = document.getElementById('clearSearch');
const empty = document.getElementById('emptyState');
const categoryFilters = document.getElementById('categoryFilters');
let categories = [], names = {};
let currentCat = 'all';
let searchQuery = '';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function renderCategories() {
  names = Object.fromEntries([['all','全部'],['favorites','常用'],...navCategories.map(item => [item.id,item.name])]);
  if (!names[currentCat]) currentCat = 'all';
  const categoryButton = item => `<button data-cat="${escapeHtml(item.id)}" title="${escapeHtml(item.name)}" aria-pressed="false">${escapeHtml(item.name)}</button>`;
  const more = navCategories.slice(5);
  categoryFilters.innerHTML = `<button data-cat="all" aria-pressed="true">全部</button><button data-cat="favorites" aria-pressed="false"><i class="far fa-star" aria-hidden="true"></i> 常用</button>${navCategories.slice(0,5).map(categoryButton).join('')}${more.length?`<details class="category-more"><summary aria-label="更多分类" title="更多分类"><i class="fas fa-ellipsis" aria-hidden="true"></i></summary><div class="category-menu">${more.map(categoryButton).join('')}</div></details>`:''}<span id="resultStatus" class="result-count" role="status" aria-live="polite"></span>`;
  categories = [...categoryFilters.querySelectorAll('[data-cat]')];
}
function readSaved(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function save(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { document.getElementById('resultStatus').textContent = '浏览器无法保存设置，本次会话仍可使用'; return false; }
}
let favorites;
try { favorites = JSON.parse(readSaved('nav_favs', '[]')); } catch { favorites = []; }
if (!Array.isArray(favorites)) favorites = [];
const engines = {
  '!g':'https://www.google.com/search?q=', '!b':'https://www.bing.com/search?q=',
  '!d':'https://duckduckgo.com/?q=', '!gh':'https://github.com/search?q=',
  '!y':'https://www.youtube.com/results?search_query=', '!bd':'https://www.baidu.com/s?wd=',
  '!tb':'https://s.taobao.com/search?q=', '!zh':'https://www.zhihu.com/search?type=content&q='
};
function webSearch() {
  const match = searchQuery.match(/^(!\w+)\s+(.+)$/);
  if (match && engines[match[1]]) return engines[match[1]] + encodeURIComponent(match[2]);
  return searchMode.value === 'google' && searchQuery ? engines['!g'] + encodeURIComponent(searchQuery) : null;
}
const tiles = ['#248D80','#C57843','#6576C4','#248D80','#C04A70','#5D6AC3','#C56740','#3D8E72','#3889AB','#586678','#498BBC','#C65C69','#B96298','#8A67BC','#8F65BA','#B78543','#3D9395','#4C81C9','#BA5E90','#617A99','#258E80','#8D63BE','#527DC2','#6D6BC4'];
const siteIcons = {
  'chat.openai.com':'chat.openai.com.webp',
  'console.cloud.tencent.com':'console.cloud.tencent.com.ico',
  'coolors.co':'coolors.co.png',
  'deepseek.com':'deepseek.com.ico',
  'gemini.google.com':'gemini.google.com.png',
  'github.com':'github.com.svg',
  'hermesagent.org.cn':'hermesagent.org.cn.png',
  'jimeng.jianying.com':'jimeng.jianying.com.ico',
  'tinypng.com':'tinypng.com.png',
  'tushare.pro':'tushare.pro.png',
  'www.figma.com':'www.figma.com.png',
  'www.minimaxi.com':'www.minimaxi.com.ico',
  'www.volcengine.com':'www.volcengine.com.png'
};
function renderCard(item) {
  const index = item.id;
  const isFavorite = favorites.includes(item.url);
  const href = item.url.startsWith('/') ? 'https://hooper.ink' + item.url : item.url;
  const host = item.url !== '#' ? new URL(href).hostname : '';
  const favicon = item.iconUrl || (!item.mark && item.cat !== 'my' && host ? (siteIcons[host] ? `/assets/site-icons/${siteIcons[host]}` : `https://favicon.im/${host}?larger=true`) : '');
  const fallback = `<span class="fallback" style="--tile:${escapeHtml(item.tile || tiles[Number(index)] || '#617A99')}" ${favicon ? 'hidden' : ''}>${item.mark ? escapeHtml([...item.mark].slice(0,2).join('')) : `<i class="${item.icon === 'fa-github' ? 'fab' : 'fas'} ${escapeHtml(item.icon || 'fa-link')}" aria-hidden="true"></i>`}</span>`;
  return `<article class="site-card" data-site="${escapeHtml(index)}">
    <a class="site-link" href="${escapeHtml(href)}" ${href !== '#' ? 'target="_blank" rel="noopener noreferrer"' : 'aria-haspopup="dialog"'}>
      <span class="site-icon${/^https?:\/\/github\.com(?:[/?#]|$)/.test(href) ? ' github-icon' : ''}" aria-hidden="true">${favicon ? `<img src="${escapeHtml(favicon)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}${fallback}</span>
      <div class="site-copy"><div class="site-title"><h2 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h2>${item.new ? '<span class="new-mark" title="新增" aria-label="新增"></span>' : ''}</div><p title="${escapeHtml(item.desc)}">${escapeHtml(item.desc)}</p></div>
    </a>
    <button class="favorite-button" data-favorite="${escapeHtml(index)}" aria-label="${escapeHtml(item.title)}：${isFavorite ? '取消常用' : '加入常用'}" aria-pressed="${isFavorite}" title="${isFavorite ? '取消常用' : '加入常用'}"><i class="${isFavorite ? 'fas' : 'far'} fa-star" aria-hidden="true"></i></button>
  </article>`;
}
function render() {
  const query = searchMode.value === 'site' && !webSearch() ? searchQuery.toLowerCase() : '';
  const filtered = navData.filter(item =>
    !item.hidden && (currentCat === 'all' || (currentCat === 'favorites' ? favorites.includes(item.url) : item.cat === currentCat)) &&
    (!query || [item.title, item.desc, item.alias || ''].some(text => text.toLowerCase().includes(query)))
  ).sort((a,b) => Number(favorites.includes(b.url)) - Number(favorites.includes(a.url)));
  grid.innerHTML = filtered.map(renderCard).join('');
  grid.hidden = !filtered.length;
  empty.hidden = !!filtered.length;
  clearSearch.hidden = !searchQuery;
  categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cat === currentCat)));
  document.getElementById('resultStatus').innerHTML = `<span aria-hidden="true">${filtered.length}</span><span class="sr-only">${escapeHtml(names[currentCat])} · ${filtered.length} 个网站${query ? ' · 搜索结果' : ''}</span>`;
  const selectedMore = categoryFilters.querySelector('.category-menu [aria-pressed="true"]');
  const moreSummary = categoryFilters.querySelector('summary');
  if (moreSummary) { moreSummary.innerHTML = selectedMore ? escapeHtml(selectedMore.textContent) : '<i class="fas fa-ellipsis" aria-hidden="true"></i>'; moreSummary.title = selectedMore ? selectedMore.textContent : '更多分类'; moreSummary.setAttribute('aria-label', moreSummary.title); moreSummary.classList.toggle('selected', !!selectedMore); }
  empty.querySelector('h2').textContent = currentCat === 'favorites' && !query ? '暂无常用' : '无结果';
  empty.querySelector('i').className = currentCat === 'favorites' && !query ? 'far fa-star' : 'fas fa-magnifying-glass';
  document.getElementById('emptyMessage').textContent = '';
  document.getElementById('searchAll').hidden = currentCat === 'all';
  document.getElementById('emptyClear').hidden = !searchQuery;
}
function clearQuery() { searchInput.value = ''; searchQuery = ''; render(); searchInput.focus(); }
function syncSearchMode() {
  const site = searchMode.value === 'site';
  searchInput.placeholder = site ? '搜索本站…' : '搜索…';
  searchInput.setAttribute('aria-label', site ? '搜索站内网站' : 'Google 搜索');
  searchSubmit.setAttribute('aria-label', site ? '查找站内网站' : 'Google 搜索');
  render();
}
searchMode.addEventListener('change', syncSearchMode);
searchInput.addEventListener('input', event => { searchQuery = event.target.value.trim(); clearSearch.hidden = !searchQuery; if (searchMode.value === 'site') render(); });
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) event.preventDefault();
});
document.getElementById('searchForm').addEventListener('submit', event => {
  event.preventDefault();
  searchQuery = searchInput.value.trim();
  if (!searchQuery) { searchInput.focus(); return; }
  const url = webSearch();
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
  else grid.querySelector('.site-link')?.focus();
});
clearSearch.addEventListener('click', clearQuery);
document.getElementById('emptyClear').addEventListener('click', clearQuery);
document.getElementById('searchAll').addEventListener('click', () => { currentCat = 'all'; render(); searchInput.focus(); });
categoryFilters.addEventListener('click', event => { const button = event.target.closest('[data-cat]'); if (!button) return; currentCat = button.dataset.cat; render(); categoryFilters.querySelector('details')?.removeAttribute('open'); if (button.closest('.category-menu')) categoryFilters.querySelector('summary')?.focus(); });
document.addEventListener('click', event => { if (!categoryFilters.contains(event.target)) categoryFilters.querySelector('details')?.removeAttribute('open'); });
document.addEventListener('navigationchange', event => {
  const next = event.detail;
  favorites = favorites.map(url => { const previous = navData.find(item => item.url === url); return previous ? next.links.find(item => item.id === previous.id)?.url || url : url; });
  save('nav_favs', JSON.stringify(favorites));
  navData = next.links; navCategories = next.categories;
  renderCategories(); render();
});
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-favorite]');
  if (button) {
    const index = button.dataset.favorite;
    const item = navData.find(item => item.id === index);
    if (!item) return;
    favorites = favorites.includes(item.url) ? favorites.filter(url => url !== item.url) : [...favorites, item.url];
    render();
    save('nav_favs', JSON.stringify(favorites));
    (grid.querySelector(`[data-favorite="${index}"]`) || document.querySelector('[data-cat="favorites"]')).focus();
  }
  if (event.target.closest('a[href="#"]')) { event.preventDefault(); document.getElementById('schoolDialog').showModal(); }
});
const themeToggle = document.getElementById('themeToggle');
function syncTheme() {
  const dark = document.documentElement.classList.contains('dark');
  themeToggle.setAttribute('aria-label', `切换${dark ? '浅' : '深'}色主题`);
  themeToggle.innerHTML = `<i class="fas fa-${dark ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
}
themeToggle.addEventListener('click', () => { document.documentElement.classList.toggle('dark'); syncTheme(); save('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); });
syncTheme();

const poetryButton = document.getElementById('poetryRefresh');
function loadPoetry() {
  if (!window.jinrishici) { poetryButton.title = '诗词服务暂不可用，保留当前诗句'; return; }
  poetryButton.disabled = true;
  document.getElementById('poetryContent').setAttribute('aria-busy', 'true');
  let finished = false;
  const timer = setTimeout(() => finish(null), 8000);
  function finish(result) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (result?.status === 'success' && result.data?.origin) {
      const { content, origin } = result.data;
      document.getElementById('poetrySentence').textContent = content;
      document.getElementById('poetryMeta').textContent = `【${origin.dynasty}】${origin.author} 《${origin.title}》`;
    }
    poetryButton.disabled = false;
    poetryButton.title = result?.status === 'success' ? '换一句诗词' : '暂时无法更新，稍后可重试';
    document.getElementById('poetryContent').setAttribute('aria-busy', 'false');
  }
  try { window.jinrishici.load(finish, () => finish(null)); } catch { finish(null); }
}
poetryButton.addEventListener('click', loadPoetry);
window.addEventListener('load', loadPoetry);

document.addEventListener('keydown', event => {
  const editing = event.target.matches('input,textarea,[contenteditable="true"]');
  if (((event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) && !editing && !document.querySelector('dialog[open]') && !document.body.classList.contains('manager-open')) { event.preventDefault(); searchInput.focus(); }
  if (event.key === 'Escape') {
    const expanded = categoryFilters.querySelector('details[open]');
    if (expanded) { expanded.removeAttribute('open'); expanded.querySelector('summary').focus(); }
    if (event.target === searchInput) clearQuery();
  }
});
renderCategories();
searchMode.value = 'google';
syncSearchMode();
