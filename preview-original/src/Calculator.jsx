import {cloneElement,useEffect,useRef,useState} from 'react';
import {Popover} from 'antd';
import {calculate} from './calculator.mjs';

export default function Calculator({open,onOpenChange,triggerElement}){
  const [expression,setExpression]=useState(''),[finished,setFinished]=useState(false),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const input=useRef(null),trigger=useRef(null),copyTimer=useRef(null),copyVersion=useRef(0);
  let result=null,error='';
  try{result=calculate(expression)}catch(e){if(!/[+\-−*/×÷^(]\s*$/.test(expression))error=e.message}
  const close=()=>{onOpenChange(false);trigger.current?.focus()};
  useEffect(()=>()=>clearTimeout(copyTimer.current),[]);
  useEffect(()=>{if(!open)return;const escape=event=>{if(event.key==='Escape'){event.stopPropagation();onOpenChange(false);trigger.current?.focus()}};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[open,onOpenChange]);
  function change(value){copyVersion.current++;clearTimeout(copyTimer.current);setExpression(value.slice(0,160));setFinished(false);setCopied(false);setCopyError(false)}
  function press(key){
    if(key==='AC')return change('');
    if(key==='Backspace')return change(expression.slice(0,-1));
    if(key==='='){if(result){change(result.value+(result.unit?' '+result.unit:''));setFinished(true)}return}
    if(key==='±'){
      const last=expression.match(/\(-\d*\.?\d+(?:e[+-]?\d+)?%?\)$|\d*\.?\d+(?:e[+-]?\d+)?%?$/i)?.[0];
      return change(last?expression.slice(0,-last.length)+(last.startsWith('(-')?last.slice(2,-1):`(-${last})`):expression==='-'?'':expression+'-');
    }
    let value=finished&&/^[\d.]$/.test(key)?'':expression;
    if(/^[+−×÷]$/.test(key))return change((value||'0').replace(/[+\-−*/×÷]\s*$/,'')+key);
    if(key==='%'&&!/[\d)]$/.test(value))return;
    if(key==='.'&&/\d*\.\d*$/.test(value))return;
    if(key==='.'&&(!value||/[+\-−*/×÷(]$/.test(value)))key='0.';
    change(value+key);
  }
  function keyboard(event){
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const key=({'Enter':'=','*':'×','/':'÷','-':'−','Delete':'AC'})[event.key]||event.key;
    if(event.target===input.current&&key!=='='&&!(finished&&/^[\d.]$/.test(key)))return;
    if(/^[\d.+−×÷%=]$/.test(key)||key==='Backspace'||key==='AC'){event.preventDefault();event.stopPropagation();press(key)}
  }
  async function copy(){
    if(!result)return;
    const version=++copyVersion.current;
    try{await navigator.clipboard.writeText(result.value+(result.unit?' '+result.unit:''));if(version!==copyVersion.current)return;setCopied(true);setCopyError(false);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),1400)}catch{if(version===copyVersion.current)setCopyError(true)}
  }
  const content=<section className="calculator-panel" role="dialog" aria-label="计算器" onKeyDown={keyboard}>
    <header><strong>计算器</strong><div className="panel-actions"><button className="icon-button" aria-label="退格" title="退格" disabled={!expression} onClick={()=>press('Backspace')}><i className="fas fa-delete-left" aria-hidden="true"/></button><button className="icon-button" aria-label="关闭计算器" onClick={close}><i className="fas fa-xmark" aria-hidden="true"/></button></div></header>
    <input ref={input} className="calculator-input" aria-label="计算表达式" aria-invalid={!!error} maxLength={160} autoComplete="off" spellCheck={false} placeholder="0" value={expression} onChange={event=>change(event.target.value)}/>
    <button className="calculator-result" aria-label={result?`复制结果 ${result.value}${result.unit?' '+result.unit:''}`:'计算结果'} title={result?'复制结果':undefined} disabled={!result} onClick={copy}><span>{result?.value||'0'}{result?.unit&&<small>{result.unit}</small>}</span><i className={`far fa-${copied?'circle-check':'copy'}`} aria-hidden="true"/></button>
    <div className="calculator-status" role="status" aria-live="polite">{copyError?'复制失败，请重试':copied?'已复制':error}</div>
    <div className="calculator-keypad">{['AC','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='].map(key=><button key={key} className={key==='0'?'calculator-zero':key==='='?'calculator-equals':/[+−×÷]/.test(key)?'calculator-operator':''} aria-label={({'AC':'清空算式','±':'正负号','%':'百分比','÷':'除','×':'乘','−':'减','+':'加','.':'小数点','=':'等于'})[key]||key} onClick={()=>press(key)}>{key}</button>)}</div>
  </section>;
  return <Popover open={open} onOpenChange={onOpenChange} afterOpenChange={value=>{if(value){if(matchMedia('(pointer:coarse)').matches)document.querySelector('.calculator-keypad button')?.focus();else input.current?.focus()}}} trigger="click" placement="top" arrow={false} content={content}>{cloneElement(triggerElement,{ref:node=>{triggerElement.props.ref(node);trigger.current=node},'aria-label':'打开计算器','aria-haspopup':'dialog','aria-expanded':open})}</Popover>;
}
