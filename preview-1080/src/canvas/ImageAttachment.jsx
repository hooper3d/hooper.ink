import {useState} from 'react';
import {Button,Image,Tooltip} from 'antd';
import {DeleteOutlined,DownloadOutlined,EyeOutlined} from '@ant-design/icons';
import {NodeViewWrapper,ReactNodeViewRenderer} from '@tiptap/react';
import TiptapImage from '@tiptap/extension-image';
import {useCanvas} from './Widgets';

function ImageAttachment({node,deleteNode}){
  const [open,setOpen]=useState(false);
  const {readOnly}=useCanvas();
  const {src,alt}=node.attrs;
  const extension=src.startsWith('data:image/png;')?'png':src.startsWith('data:image/jpeg;')?'jpg':'webp';
  const name=alt&&!alt.startsWith('canvas-image-')?alt:`图片.${extension}`;
  const downloadName=`${name.replace(/\.[^.]+$/,'')}.${extension}`;
  const size=Math.ceil((src.length-src.indexOf(',')-1)*.75/1024);
  return <NodeViewWrapper className="scratchpad-attachment" contentEditable={false}>
    <Image className="attachment-thumbnail" width={36} height={36} src={src} alt={name} preview={{open,onOpenChange:setOpen,mask:false}} draggable={false}/>
    <div className="attachment-label"><strong title={name}>{name}</strong><small>{extension.toUpperCase()} · {size} KB</small></div>
    <div className="attachment-actions">
      <Tooltip title="查看图片"><Button type="text" size="small" aria-label="查看图片附件" icon={<EyeOutlined/>} onClick={()=>setOpen(true)}/></Tooltip>
      <Tooltip title="保存图片"><Button type="text" size="small" aria-label="保存图片附件" href={src} download={downloadName} icon={<DownloadOutlined/>}/></Tooltip>
      {!readOnly&&<Tooltip title="删除附件 · 可撤销"><Button type="text" size="small" aria-label="删除图片附件" icon={<DeleteOutlined/>} onClick={deleteNode}/></Tooltip>}
    </div>
  </NodeViewWrapper>;
}

export default TiptapImage.extend({
  addNodeView(){return ReactNodeViewRenderer(ImageAttachment)},
}).configure({allowBase64:true});
