#!/usr/bin/env python3
"""
Hooper 博客构建脚本
- 读 blog-src/posts/*.md
- 解析 YAML frontmatter
- MD -> HTML (含代码高亮类名)
- 注入 base / post / list 模板
- 自动生成 TOC、上一篇/下一篇、阅读数、Giscus
- 输出到 public/blog/
"""
import os
import re
import sys
import yaml
import shutil
from pathlib import Path

import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.tables import TableExtension
from markdown.extensions.toc import TocExtension
from markdown.extensions.attr_list import AttrListExtension
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path('/home/agentuser/nav')
SRC = ROOT / 'blog-src'
POSTS_SRC = SRC / 'posts'
TEMPLATES = SRC / 'templates'
CONFIG_PATH = SRC / 'blog.config.yaml'
OUT = ROOT / 'public' / 'blog'
ASSETS_SRC = SRC / 'assets'

# ---------- utils ----------
def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def parse_md(path: Path):
    """解析 .md -> (frontmatter dict, body_md)"""
    text = path.read_text(encoding='utf-8')
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.DOTALL)
    if not m:
        raise ValueError(f"Frontmatter missing in {path}")
    fm = yaml.safe_load(m.group(1))
    body_md = m.group(2)
    return fm, body_md

def md_to_html(md_text: str) -> str:
    md = markdown.Markdown(
        extensions=[
            FencedCodeExtension(),
            CodeHiliteExtension(css_class='highlight', guess_lang=False, noclasses=False),
            TableExtension(),
            TocExtension(toc_class='hidden-toc', anchorlink=False, permalink=False),
            AttrListExtension(),
            'sane_lists',
        ]
    )
    return md.convert(md_text)

def estimate_read_time(md_text: str) -> int:
    cn = len(re.findall(r'[\u4e00-\u9fff]', md_text))
    code_blocks = re.findall(r'```[\s\S]*?```', md_text)
    code = sum(len(b) for b in code_blocks) // 10
    chars = cn + code
    return max(1, round(chars / 350))

def gather_posts() -> list:
    posts = []
    for p in sorted(POSTS_SRC.glob('*.md')):
        fm, body = parse_md(p)
        date_val = fm.get('date')
        if date_val is not None and not isinstance(date_val, str):
            date_val = str(date_val)
        posts.append({
            'fm': fm,
            'body_md': body,
            'source': p.name,
            'slug': fm.get('slug') or p.stem,
            'date': date_val,
            'title': fm.get('title'),
            'tags': fm.get('tags', []),
            'summary': fm.get('summary', ''),
            'cover': fm.get('cover'),
            'location': fm.get('location', '南京'),
        })
    posts.sort(key=lambda x: x['date'] or '', reverse=True)
    for i, post in enumerate(posts):
        if i < len(posts) - 1:
            post['prev'] = {'title': posts[i+1]['title'], 'url': f"/blog/posts/{posts[i+1]['slug']}.html"}
        else:
            post['prev'] = None
        if i > 0:
            post['next'] = {'title': posts[i-1]['title'], 'url': f"/blog/posts/{posts[i-1]['slug']}.html"}
        else:
            post['next'] = None
    return posts

def build_post(post: dict, cfg: dict, env: Environment) -> str:
    fm = post['fm']
    body_html = md_to_html(post['body_md'])
    read_time = fm.get('read_time') or estimate_read_time(post['body_md'])

    ctx = {
        'title': f"{fm['title']} - {cfg['site']['name']}",
        'description': fm.get('summary', cfg['site']['description']),
        'keywords': ', '.join(fm.get('tags', []) + [cfg['site']['author'], 'hooper.ink', '博客']),
        'author': cfg['site']['author'],
        'canonical': f"{cfg['site']['base_url']}{cfg['site']['posts_path']}{post['slug']}.html",
        'og_type': 'article',
        'site_name': cfg['site']['name'],
        'og_image': fm.get('cover') or f"{cfg['site']['base_url']}{cfg['site']['og_image']}",
        'published_time': fm.get('date'),
        'locale': cfg['site']['locale'],
        'giscus': cfg['giscus'],
        'busuanzi': cfg['busuanzi'],
        'cover': fm.get('cover'),
        'date': fm.get('date'),
        'location': fm.get('location', '南京'),
        'read_time': read_time,
        'tags': fm.get('tags', []),
        'title_only': fm['title'],
        'prev': post.get('prev'),
        'next': post.get('next'),
    }
    post_tpl = env.get_template('post.html')
    base_tpl = env.get_template('base.html')
    post_html = post_tpl.render(**ctx, body=body_html)
    return base_tpl.render(**ctx, content=post_html)

def build_list(posts: list, cfg: dict, env: Environment) -> str:
    ctx = {
        'title': cfg['site']['name'],
        'description': cfg['site']['description'],
        'keywords': f"{cfg['site']['author']},博客,独立开发者,AIGC,AI Agent,技术随笔,前端",
        'author': cfg['site']['author'],
        'canonical': f"{cfg['site']['base_url']}{cfg['site']['blog_path']}",
        'og_type': 'website',
        'site_name': cfg['site']['name'],
        'og_image': f"{cfg['site']['base_url']}{cfg['site']['og_image']}",
        'locale': cfg['site']['locale'],
        'giscus': {'enabled': False},
        'busuanzi': {'enabled': False},
        'posts': [{'title': p['title'], 'date': p['date'], 'summary': p['summary'],
                   'tags': p['tags'], 'slug': p['slug'], 'cover': p['cover']} for p in posts],
    }
    list_tpl = env.get_template('list.html')
    base_tpl = env.get_template('base.html')
    list_html = list_tpl.render(**ctx)
    return base_tpl.render(**ctx, content=list_html)

def main():
    cfg = load_config()
    OUT.mkdir(parents=True, exist_ok=True)
    posts_out = OUT / 'posts'
    posts_out.mkdir(parents=True, exist_ok=True)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(['html']),
    )

    posts = gather_posts()
    print(f"[build] found {len(posts)} posts")
    for post in posts:
        html = build_post(post, cfg, env)
        out_path = posts_out / f"{post['slug']}.html"
        out_path.write_text(html, encoding='utf-8')
        print(f"  - {out_path.relative_to(ROOT)} ({len(html)} bytes)")

    list_html = build_list(posts, cfg, env)
    (OUT / 'index.html').write_text(list_html, encoding='utf-8')
    print(f"  - public/blog/index.html ({len(list_html)} bytes)")

    target_assets = OUT / 'assets'
    if target_assets.exists():
        shutil.rmtree(target_assets)
    if ASSETS_SRC.exists():
        shutil.copytree(ASSETS_SRC, target_assets)
        print(f"  - assets copied")

    print(f"[build] done -> {OUT}")

if __name__ == '__main__':
    main()
