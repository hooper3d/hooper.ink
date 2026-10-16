import {cloneElement,useEffect,useRef,useState} from 'react';
import {Popover} from 'antd';
import {calculate} from './calculator.mjs';

export default function Calculator({open,onOpenChange,triggerElement}){
  const [expression,setExpression]=useState(''),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const input=useRef(null),trigger=useRef(null),copyTimer=useRef(null),copyVersion=useRef(0);
  let result=null,error='';
  try{result=calculate(expression)}catch(e){if(!/[+\-*/×÷^(]\s*$/.test(expression))error=e.message}
  const close=()=>{onOpenChange(false);trigger.current?.focus()};
  useEffect(()=>()=>clearTimeout(copyTimer.current),[]);
  useEffect(()=>{if(!open)return;const escape=event=>{if(event.key==='Escape'){event.stopPropagation();onOpenChange(false);trigger.current?.focus()}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[open,onOpenChange]);
  function change(value){copyVersion.current++;clearTimeout(copyTimer.current);setExpression(value);setCopied(false);setCopyError(false)}
  async function copy(){
    if(!result)return;
    const version=++copyVersion.current;
    try{await navigator.clipboard.writeText(result.value+(result.unit?' '+result.unit:''));if(version!==copyVersion.current)return;setCopied(true);setCopyError(false);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),1400)}catch{if(version===copyVersion.current)setCopyError(true)}
  }
  const content=<section className="calculator-panel" role="dialog" aria-label="计算器">
    <header><strong>计算器</strong><div className="panel-actions"><button className="icon-button" aria-label="清空算式" title="清空" disabled={!expression} onClick={()=>{change('');input.current?.focus()}}><i className="fas fa-eraser" aria-hidden="true"/></button><button className="icon-button" aria-label="关闭计算器" onClick={close}><i className="fas fa-xmark" aria-hidden="true"/></button></div></header>
    <input ref={input} className="calculator-input" aria-label="计算表达式" aria-invalid={!!error} maxLength={160} autoComplete="off" spellCheck={false} placeholder="12.5% × 800" value={expression} onChange={event=>change(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();copy()}}}/>
    <button className="calculator-result" aria-label={result?`复制结果 ${result.value}${result.unit?' '+result.unit:''}`:'计算结果'} title={result?'复制结果':undefined} disabled={!result} onClick={copy}><span>{result?.value||'—'}{result?.unit&&<small>{result.unit}</small>}</span><i className={`far fa-${copied?'circle-check':'copy'}`} aria-hidden="true"/></button>
    <div className="calculator-status" role="status" aria-live="polite">{copyError?'复制失败，请重试':copied?'已复制':error}</div>
    {!expression&&<div className="calculator-examples">{['(12 + 8) × 5','2 m → cm','1 GB → MB'].map(value=><button key={value} onClick={()=>{change(value);input.current?.focus()}}>{value}</button>)}</div>}
  </section>;
  return <Popover open={open} onOpenChange={onOpenChange} afterOpenChange={value=>{if(value)input.current?.focus()}} trigger="click" placement="top" arrow={false} content={content}>{cloneElement(triggerElement,{ref:node=>{triggerElement.props.ref(node);trigger.current=node},'aria-label':'打开计算器','aria-haspopup':'dialog','aria-expanded':open})}</Popover>;
}
