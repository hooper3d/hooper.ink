const appTheme = document.querySelector('meta[name="theme-color"]');
function syncAppTheme() { appTheme.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); }
syncAppTheme();
new MutationObserver(syncAppTheme).observe(document.documentElement, {attributes:true, attributeFilter:['class']});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'}).catch(() => {});
  });
}
