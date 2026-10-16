const units = {
  mm:['length',.001,'mm'],cm:['length',.01,'cm'],m:['length',1,'m'],km:['length',1000,'km'],in:['length',.0254,'in'],ft:['length',.3048,'ft'],
  b:['data',1,'B'],kb:['data',1e3,'KB'],mb:['data',1e6,'MB'],gb:['data',1e9,'GB'],tb:['data',1e12,'TB'],
  kib:['data',1024,'KiB'],mib:['data',1024**2,'MiB'],gib:['data',1024**3,'GiB'],tib:['data',1024**4,'TiB']
};
const format = value => {
  if (!Number.isFinite(value)) throw Error('结果超出范围');
  return String(Number(value.toPrecision(12)));
};
export function calculate(input) {
  if (!input.trim()) return null;
  if (input.length>160) throw Error('算式过长');
  const conversion=input.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)\s*(?:to|in|→|=|转)\s*([a-z]+)$/i);
  if (conversion) {
    const from=units[conversion[2].toLowerCase()],to=units[conversion[3].toLowerCase()];
    if (!from||!to||from[0]!==to[0]) throw Error('单位不匹配');
    return {value:format(Number(conversion[1])*from[1]/to[1]),unit:to[2]};
  }
  const source=input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
  const tokens=source.match(/(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[()+\-*/%^]/gi)||[];
  if (/\d\s+\d/.test(source)||tokens.join('')!==source.replace(/\s/g,'')) throw Error('检查算式或单位');
  let index=0;
  function primary() {
    let value;
    if (tokens[index]==='(') {
      index++;value=sum();
      if (tokens[index++]!==')') throw Error('括号未闭合');
    } else {
      if (!/^\d|^\.\d/.test(tokens[index]||'')) throw Error('算式未完成');
      value=Number(tokens[index++]);
    }
    while (tokens[index]==='%') {index++;value/=100}
    return value;
  }
  function power() {const value=primary();if(tokens[index]!=='^')return value;index++;return value**unary()}
  function unary() {if(tokens[index]==='+'){index++;return unary()}if(tokens[index]==='-'){index++;return -unary()}return power()}
  function product() {
    let value=unary();
    while (['*','/','('].includes(tokens[index])) {
      const operator=tokens[index]==='('? '*':tokens[index++],next=unary();
      if (operator==='/'&&next===0) throw Error('不能除以零');
      value=operator==='*'?value*next:value/next;
    }
    return value;
  }
  function sum() {let value=product();while(['+','-'].includes(tokens[index])){const operator=tokens[index++],next=product();value=operator==='+'?value+next:value-next}return value}
  const value=sum();
  if (index!==tokens.length) throw Error('检查算式');
  return {value:format(value),unit:''};
}
