function validUrl(value, allowRelative = true) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw Error('网址无效');
  value = value.trim();
  if (allowRelative && value === '#') return value;
  if (allowRelative && /^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) {
    if (new URL(value, 'https://hooper.ink').origin !== 'https://hooper.ink') throw Error('网址无效');
    return value;
  }
  let url;
  try { url = new URL(value); } catch { throw Error('请输入完整的 HTTP 或 HTTPS 网址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('网址仅支持不含账号密码的 HTTP 或 HTTPS 链接');
  return value;
}
function validateNavigation(input) {
  if (!input || input.schema !== 1 || !Array.isArray(input.categories) || !Array.isArray(input.links) || input.categories.length > 30 || input.links.length > 500) throw Error('导航数据格式无效');
  const text = (value, max, optional = false) => {
    if (optional && value == null) return '';
    if (typeof value !== 'string' || value.length > max) throw Error('字段格式或长度无效');
    return value.trim();
  };
  const id = value => {
    value = text(value, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(value) || ['all', 'favorites', '__proto__', 'constructor', 'prototype'].includes(value)) throw Error('标识无效');
    return value;
  };
  const categories = input.categories.map(item => ({id:id(item.id), name:text(item.name, 20)}));
  if (categories.some(item => !item.name) || new Set(categories.map(item => item.id)).size !== categories.length || new Set(categories.map(item => item.name)).size !== categories.length) throw Error('分类名称或标识为空或重复');
  const links = input.links.map(item => {
    if (item.url === '#' && item.id !== '17') throw Error('请输入完整网址');
    const title = text(item.title, 100), cat = id(item.cat);
    if (!title || !categories.some(category => category.id === cat)) throw Error('网站名称或分类无效');
    const icon = text(item.icon, 80, true), tile = text(item.tile, 7, true) || '#617A99';
    if ((icon && !/^fa-[a-z0-9-]+$/.test(icon)) || !/^#[0-9a-f]{6}$/i.test(tile)) throw Error('图标或颜色无效');
    return {id:id(item.id), title, url:validUrl(item.url), desc:text(item.desc, 200, true), cat, alias:text(item.alias, 100, true), icon, mark:text(item.mark, 8, true), iconUrl:item.iconUrl ? validUrl(item.iconUrl, false) : '', tile, new:item.new === true, hidden:item.hidden === true};
  });
  if (new Set(links.map(item => item.id)).size !== links.length) throw Error('网站标识重复');
  if (links.filter(item => !item.hidden).length > 24) throw Error('首页最多 24 个入口，请先隐藏暂时不用的网站');
  return {schema:1, categories, links};
}
module.exports = {validUrl, validateNavigation};
