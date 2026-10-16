const imagePath = /^\/api\/note-images\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/;
const emptyDocument = () => ({type:'doc', content:[{type:'paragraph'}]});
function safeLink(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function validateNote(doc) {
  let count = 0, textLength = 0;
  const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'blockquote', 'codeBlock', 'horizontalRule', 'noteImage'];
  function visit(node, depth = 0) {
    if (!node || !['doc', 'text', 'hardBreak', ...blocks].includes(node.type) || ++count > 5000 || depth > 16) throw Error('内容无效或过长');
    const out = {type:node.type};
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text || (textLength += node.text.length) > 100000) throw Error('文字最多 10 万字');
      out.text = node.text;
    }
    if (node.type === 'noteImage') {
      if (!imagePath.test(node.attrs?.src || '')) throw Error('请使用上传的私人图片');
      out.attrs = {src:node.attrs.src, alt:typeof node.attrs.alt === 'string' ? node.attrs.alt.slice(0,160) : '图片', size:Number.isInteger(node.attrs.size) && node.attrs.size > 0 ? node.attrs.size : 0};
    }
    if (node.type === 'heading') out.attrs = {level:[1,2,3].includes(node.attrs?.level) ? node.attrs.level : 2};
    if (node.type === 'orderedList') out.attrs = {start:Number.isInteger(node.attrs?.start) && node.attrs.start > 0 ? node.attrs.start : 1};
    if (node.type === 'codeBlock') out.attrs = {language:null};
    if (node.type === 'taskItem') {
      if (typeof node.attrs?.checked !== 'boolean') throw Error('勾选状态无效');
      out.attrs = {checked:node.attrs.checked};
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 8 || node.type !== 'text') throw Error('文字格式无效');
      out.marks = node.marks.map(mark => {
        if (!['bold','italic','strike','underline','code','link'].includes(mark?.type)) throw Error('文字格式无效');
        if (mark.type !== 'link') return {type:mark.type};
        if (typeof mark.attrs?.href !== 'string' || mark.attrs.href.length > 4000 || !safeLink(mark.attrs.href)) throw Error('链接需使用 http 或 https');
        return {type:'link', attrs:{href:mark.attrs.href, target:'_blank', rel:'noopener noreferrer', class:null}};
      });
    }
    if (node.content !== undefined) {
      const allowed = ['doc','blockquote','listItem'].includes(node.type) ? blocks.filter(type => !['listItem','taskItem'].includes(type)) : node.type === 'taskList' ? ['taskItem'] : node.type === 'taskItem' ? ['paragraph'] : ['bulletList','orderedList'].includes(node.type) ? ['listItem'] : ['paragraph','heading'].includes(node.type) ? ['text','hardBreak'] : node.type === 'codeBlock' ? ['text'] : [];
      if (!Array.isArray(node.content) || node.content.some(child => !allowed.includes(child?.type))) throw Error('便笺结构无效');
      if (node.type === 'listItem' && node.content[0]?.type !== 'paragraph') throw Error('列表结构无效');
      out.content = node.content.map(child => visit(child, depth + 1));
    }
    if (['doc','blockquote','listItem','bulletList','orderedList','taskList','taskItem'].includes(node.type) && !out.content?.length) throw Error('便笺结构无效');
    return out;
  }
  if (doc?.type !== 'doc') throw Error('便笺文档无效');
  const out = visit(doc);
  if (new TextEncoder().encode(JSON.stringify(out)).length > 200000) throw Error('这份便笺过大');
  return out;
}
module.exports = {emptyDocument, safeLink, validateNote, imagePath};
