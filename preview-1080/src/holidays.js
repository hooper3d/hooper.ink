  const source='https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html';
  const holidays=[
    {name:'元旦',start:'2026-01-01',end:'2026-01-03',work:['2026-01-04']},
    {name:'春节',start:'2026-02-15',end:'2026-02-23',work:['2026-02-14','2026-02-28']},
    {name:'清明节',start:'2026-04-04',end:'2026-04-06',work:[]},
    {name:'劳动节',start:'2026-05-01',end:'2026-05-05',work:['2026-05-09']},
    {name:'端午节',start:'2026-06-19',end:'2026-06-21',work:[]},
    {name:'中秋节',start:'2026-09-25',end:'2026-09-27',work:[]},
    {name:'国庆节',start:'2026-10-01',end:'2026-10-07',work:['2026-09-20','2026-10-10']}
  ];
  const parse=value=>new Date(`${value}T12:00:00Z`);
  const shanghai=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
  const todayKey=()=>{const parts=Object.fromEntries(shanghai.formatToParts(new Date()).map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}`};
  const lunar=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'});
  const lunarDays=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  function lunarLabel(key,full=false){const parts=Object.fromEntries(lunar.formatToParts(parse(key)).map(x=>[x.type,x.value])),day=Number(parts.day);if(!day||!parts.month)return '';return full?parts.month+lunarDays[day-1]:day===1?parts.month:lunarDays[day-1]}
  function dayInfo(key){const holiday=holidays.find(h=>key>=h.start&&key<=h.end);if(holiday)return{type:'holiday',label:`${holiday.name}假期 · 放假`};const work=holidays.find(h=>h.work.includes(key));if(work)return{type:'work',label:`${work.name}调休 · 补班`};if(!key.startsWith('2026-'))return{type:'unknown',label:'本年放假调休安排未收录'};return{type:'normal',label:[0,6].includes(parse(key).getUTCDay())?'周末休息':'工作日'}}

export { source, holidays, todayKey, lunarLabel, dayInfo };

