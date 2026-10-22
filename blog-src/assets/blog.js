(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const preference = matchMedia('(prefers-color-scheme: dark)');
  function updateTheme(dark) {
    root.classList.toggle('dark', dark);
    toggle.textContent = dark ? '浅色' : '深色';
    toggle.setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    document.querySelector('.giscus-frame')?.contentWindow?.postMessage({giscus:{setConfig:{theme:dark?'dark':'light'}}}, 'https://giscus.app');
  }
  updateTheme(root.classList.contains('dark'));
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const dark = !root.classList.contains('dark');
    updateTheme(dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  });
  window.addEventListener('storage', event => {
    if (event.key === 'theme' || event.key === null) updateTheme(event.newValue ? event.newValue === 'dark' : preference.matches);
  });
  preference.addEventListener('change', event => {
    try { if (localStorage.getItem('theme')) return; } catch {}
    updateTheme(event.matches);
  });

  const readCount = document.getElementById('readCountConfig');
  if (readCount && location.origin === new URL(document.querySelector('link[rel="canonical"]').href).origin) {
    const script = document.createElement('script');
    script.src = JSON.parse(readCount.textContent);
    script.async = true;
    document.body.appendChild(script);
  }

  const filters = document.getElementById('blogFilters');
  if (filters) {
    const articles = [...document.querySelectorAll('[data-post-tags]')].map(element => ({element, tags:JSON.parse(element.dataset.postTags)}));
    const buttons = [...filters.querySelectorAll('[data-tag]')];
    function renderTag(value) {
      const tag = buttons.some(button => button.dataset.tag === value) ? value : '';
      let count = 0;
      articles.forEach(({element, tags}) => {
        element.hidden = !!tag && !tags.includes(tag);
        if (!element.hidden) count++;
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tag === tag)));
      document.getElementById('resultsHeading').textContent = tag || '全部文章';
      document.getElementById('filterStatus').textContent = `${count} 篇 · 按最新发布排序`;
    }
    function selectTag(tag) {
      const url = new URL(location.href);
      if (tag) url.searchParams.set('tag', tag);
      else url.searchParams.delete('tag');
      if (url.href !== location.href) history.pushState(null, '', url);
      renderTag(tag);
    }
    filters.hidden = articles.length === 0;
    filters.addEventListener('click', event => {
      const button = event.target.closest('[data-tag]');
      if (button) selectTag(button.dataset.tag);
    });
    window.addEventListener('popstate', () => renderTag(new URLSearchParams(location.search).get('tag') || ''));
    renderTag(new URLSearchParams(location.search).get('tag') || '');
  }

  const headings = [...document.querySelectorAll('.prose h2[id],.prose h3[id]')];
  const tocLinks = [...document.querySelectorAll('.toc-link')];
  if (headings.length) {
    let scheduled = false;
    let activeId;
    const updateToc = () => {
      scheduled = false;
      let active = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > 130) break;
        active = heading;
      }
      if (active.id === activeId) return;
      activeId = active.id;
      tocLinks.forEach(link => {
        if (decodeURIComponent(link.hash.slice(1)) === activeId) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(updateToc); }
    }, {passive:true});
    updateToc();
    document.querySelectorAll('.mobile-toc .toc-link').forEach(link => {
      link.addEventListener('click', () => { link.closest('details').open = false; });
    });
  }

  const commentsButton = document.getElementById('loadComments');
  if (commentsButton) {
    commentsButton.hidden = false;
    commentsButton.addEventListener('click', () => {
      const config = JSON.parse(document.getElementById('commentsConfig').textContent);
      const status = document.getElementById('commentsStatus');
      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      ['repo','repo_id','category','category_id','mapping','strict','reactions_enabled','emit_metadata','input_position','lang'].forEach(key => {
        if (config[key] != null) script.setAttribute(`data-${key.replaceAll('_','-')}`, config[key]);
      });
      script.setAttribute('data-theme', root.classList.contains('dark') ? 'dark' : 'light');
      script.crossOrigin = 'anonymous';
      script.async = true;
      commentsButton.disabled = true;
      status.textContent = '正在加载评论…';
      script.onload = () => { commentsButton.hidden = true; status.textContent = ''; };
      script.onerror = () => {
        script.remove();
        commentsButton.disabled = false;
        status.textContent = '评论暂时无法加载，可重试或前往 GitHub 讨论。';
      };
      document.querySelector('.giscus').appendChild(script);
    });
  }
})();
