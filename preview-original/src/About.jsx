import {useEffect,useRef,useState} from 'react';
import {Drawer,Modal} from 'antd';

export default function About({avatarUrl}){
  const [open,setOpen]=useState(false),[mobile,setMobile]=useState(()=>matchMedia('(max-width:520px)').matches);
  const trigger=useRef(null);
  useEffect(()=>{
    const query=matchMedia('(max-width:520px)'),update=()=>setMobile(query.matches);
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  const returnFocus=()=>trigger.current?.focus();
  const profile=<section className="about-profile" aria-label="Hooper 个人名片">
    <img className="about-avatar" src={avatarUrl} alt="Hooper 头像" width="88" height="88"/>
    <h2>Hooper</h2>
    <div className="about-bio">
      <p>我是 Hooper，喜欢把创作灵感变成可用的工具，也喜欢在真实项目里探索 AI 的可能。</p>
      <p>我正在打造 <strong>LoopRay</strong>，一个 AIGC 视频创作平台。<strong>Ray</strong> 是我的开发搭档，负责代码、功能实现与技术落地；<strong>Looper（Loop）</strong> 是我的创作搭档，协助我梳理创意、打磨表达，推进 AIGC 创作。</p>
      <p>我在意界面的质感、交互的细节，也在意一个想法能不能一步步落地。</p>
    </div>
    <div className="about-links"><a className="about-link" href="https://github.com/hooper3d" target="_blank" rel="noopener noreferrer" aria-label="访问 Hooper 的 GitHub 主页（新窗口）"><i className="fab fa-github" aria-hidden="true"/><span>GitHub</span><i className="fas fa-arrow-up-right-from-square" aria-hidden="true"/></a><a className="about-link" href="mailto:8131324@qq.com"><i className="far fa-envelope" aria-hidden="true"/><span>8131324@qq.com</span></a></div>
  </section>;
  return <>
    <button ref={trigger} type="button" className="about-trigger" aria-label="关于 Hooper" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>About</button>
    {mobile?<Drawer title="About me" placement="bottom" size="min(620px, calc(100svh - 24px))" open={open} onClose={()=>setOpen(false)} afterOpenChange={visible=>{if(!visible)returnFocus()}} className="about-sheet" styles={{body:{padding:'8px 24px 32px'}}}>{profile}</Drawer>:<Modal title="About me" centered width={480} open={open} onCancel={()=>setOpen(false)} afterClose={returnFocus} footer={null} className="about-modal" styles={{body:{padding:'12px 24px 28px'}}}>{profile}</Modal>}
  </>;
}
