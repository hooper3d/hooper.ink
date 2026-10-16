import { useState } from 'react';
import { CustomerServiceOutlined, ReadOutlined, LineChartOutlined, AppstoreOutlined, PlayCircleOutlined, ExperimentOutlined, BankOutlined } from '@ant-design/icons';

export default function SiteIcon({item}) {
  const [failedUrl,setFailedUrl] = useState(null);
  if(item.mark)return <span className="site-icon">{item.mark}</span>;
  if(item.cat==='my'){
    const map=[['headphones',CustomerServiceOutlined,'#bd6bb2'],['rss',ReadOutlined,'#7185a3'],['chart',LineChartOutlined,'#3c9d94'],['microchip',AppstoreOutlined,'#8675c9'],['play',PlayCircleOutlined,'#598bd0'],['graduation',BankOutlined,'#5b9bda']];
    const [,Icon,color]=map.find(([name])=>item.icon.includes(name))||['',ExperimentOutlined,'#547bc3'];
    return <span className="site-icon project-icon" style={{background:color}}><Icon/></span>;
  }
  return <span className="site-icon">{item.url==='#'||failedUrl===item.url?item.title.slice(0,1):<img src={`https://favicon.im/${encodeURIComponent(new URL(item.url).hostname)}?larger=true`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailedUrl(item.url)}/>}</span>;
}
