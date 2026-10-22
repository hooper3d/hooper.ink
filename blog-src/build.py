#!/usr/bin/env python3
"""Build the Markdown blog. Run from any directory; no browser build step required."""
import argparse
from collections import Counter
from datetime import date
import hashlib
import math
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urljoin, urlsplit

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
import markdown
from markdown.treeprocessors import Treeprocessor
from pygments.formatters import HtmlFormatter
import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'blog-src'


class ArticleImages(Treeprocessor):
    def run(self, root):
        for image in root.iter('img'):
            image.set('loading', 'lazy')
            image.set('decoding', 'async')


def read_post(path):
    text = path.read_text(encoding='utf-8-sig')
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.DOTALL)
    if not match:
        raise ValueError(f'{path.name}: missing YAML frontmatter')
    fm = yaml.safe_load(match[1])
    if not isinstance(fm, dict) or not isinstance(fm.get('title'), str) or not fm['title'].strip():
        raise ValueError(f'{path.name}: title is required')
    slug = fm.get('slug', path.stem)
    if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError(f'{path.name}: slug must contain lowercase words separated by hyphens')
    try:
        published = date.fromisoformat(str(fm['date']))
    except (KeyError, ValueError, TypeError):
        raise ValueError(f'{path.name}: date must be YYYY-MM-DD') from None
    tags = fm.get('tags', [])
    if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
        raise ValueError(f'{path.name}: tags must be a list of text values')
    for field in ['summary', 'location', 'cover']:
        if fm.get(field) is not None and not isinstance(fm[field], str):
            raise ValueError(f'{path.name}: {field} must be text')
    cover = fm.get('cover')
    if cover:
        if cover.startswith('/blog/assets/'):
            image = (SRC / 'assets' / cover.removeprefix('/blog/assets/')).resolve()
            if not image.is_relative_to((SRC / 'assets').resolve()) or not image.is_file():
                raise ValueError(f'{path.name}: cover image does not exist')
        elif urlsplit(cover).scheme not in ['http', 'https'] or not urlsplit(cover).netloc:
            raise ValueError(f'{path.name}: cover must be a blog asset or HTTP(S) URL')
    md = markdown.Markdown(extensions=[
        'fenced_code', 'tables', 'sane_lists', 'attr_list', 'codehilite', 'toc',
    ], extension_configs={'codehilite': {'guess_lang': False}})
    md.treeprocessors.register(ArticleImages(md), 'article_images', 5)
    body = md.convert(match[2])
    toc = []

    def collect(items):
        for item in items:
            if item['level'] in [2, 3]:
                toc.append({'id': item['id'], 'title': item['name'], 'level': item['level']})
            collect(item['children'])

    collect(md.toc_tokens)
    prose = re.sub(r'```[\s\S]*?```', '', match[2])
    minutes = len(re.findall(r'[\u4e00-\u9fff]', prose)) / 350 + len(re.findall(r'\b[a-zA-Z]+\b', prose)) / 220
    read_time = fm.get('read_time', max(1, math.ceil(minutes)))
    if not isinstance(read_time, int) or isinstance(read_time, bool) or read_time < 1:
        raise ValueError(f'{path.name}: read_time must be a positive number of minutes')
    return dict(title=fm['title'].strip(), slug=slug, date=published.isoformat(),
                tags=tags, summary=fm.get('summary', ''), cover=cover,
                location=fm.get('location', '南京'), body=body, toc=toc,
                read_time=read_time, url=f'/blog/posts/{slug}.html')


def build(output):
    cfg = yaml.safe_load((SRC / 'blog.config.yaml').read_text(encoding='utf-8'))
    site = cfg['site']
    posts = sorted((read_post(p) for p in (SRC / 'posts').glob('*.md')),
                   key=lambda p: (p['date'], p['slug']), reverse=True)
    slugs = [p['slug'] for p in posts]
    if len(slugs) != len(set(slugs)):
        raise ValueError('Duplicate article slugs; each published URL must be unique')
    tags = Counter(tag for post in posts for tag in set(post['tags']))
    tag_counts = sorted(tags.items(), key=lambda item: (-item[1], item[0]))
    for i, post in enumerate(posts):
        post['prev'] = posts[i + 1] if i + 1 < len(posts) else None
        post['next'] = posts[i - 1] if i else None

    env = Environment(loader=FileSystemLoader(SRC / 'templates'), trim_blocks=True, lstrip_blocks=True,
                      autoescape=select_autoescape(['html']), undefined=StrictUndefined)
    # The navigation site owns the palette. Rebuilding keeps both surfaces in sync.
    palette = '\n'.join((ROOT / 'preview-original/style.css').read_text(encoding='utf-8').splitlines()[:2])
    css = palette + '\n' + (SRC / 'assets/blog.css').read_text(encoding='utf-8')
    css += '\n' + HtmlFormatter(style='friendly').get_style_defs('.codehilite')
    css += '\n' + HtmlFormatter(style='native').get_style_defs('.dark .codehilite')
    js = (SRC / 'assets/blog.js').read_text(encoding='utf-8')
    version = hashlib.sha256((css + js).encode()).hexdigest()[:12]
    context = dict(site=site, giscus=cfg.get('giscus', {}), busuanzi=cfg.get('busuanzi', {}),
                   year=date.today().year, version=version)
    pages = {}
    for post in posts:
        pages[f'posts/{post["slug"]}.html'] = env.get_template('post.html').render(
            **context, post=post, title=f'{post["title"]} - {site["name"]}',
            description=post['summary'] or site['description'],
            canonical=urljoin(site['base_url'], post['url']),
            og_image=urljoin(site['base_url'], post['cover'] or site['og_image']))
    pages['index.html'] = env.get_template('list.html').render(
        **context, posts=posts, tag_counts=tag_counts, title=site['name'], description=site['description'],
        canonical=urljoin(site['base_url'], site['blog_path']),
        og_image=urljoin(site['base_url'], site['og_image']))
    # Validate and render every page before changing generated output.
    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SRC / 'assets', output / 'assets', dirs_exist_ok=True)
    if (SRC / 'images').is_dir():
        shutil.copytree(SRC / 'images', output / 'images', dirs_exist_ok=True)
    (output / 'assets/blog.css').write_text(css, encoding='utf-8')
    for name in ['hooper.svg', 'hooper-navi-wordmark.svg']:
        shutil.copyfile(ROOT / 'preview-original/assets' / name, output / 'assets' / name)
    for name, content in pages.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
    print(f'Built {len(posts)} articles and blog index -> {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/blog', help='Generated blog directory')
    args = parser.parse_args()
    try:
        build(args.output.resolve())
    except (ValueError, KeyError, yaml.YAMLError) as error:
        print(f'Blog build failed: {error}', file=sys.stderr)
        sys.exit(1)
