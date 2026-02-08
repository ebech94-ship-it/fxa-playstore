// ChartView.tsx — FULLY UPDATED WITH MULTI-TRADE DYNAMIC PAYOUT

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

/* ---------------- TYPES ---------------- */

type ChartViewProps = {
  symbol?: string;
};

export type ChartViewHandle = {
  getCurrentPrice: () => number;
  onTrade: (
    type: string,
    amount: number,
    price: number,
    id: string,
    profit?: number,
    expire?: number
  ) => void;
  removeMarker: (id: string) => void;
  resize?: () => void;
 
  setWickCompression: (value: number) => void;
};

/* ---------------- COMPONENT ---------------- */

const ChartView = forwardRef<ChartViewHandle, ChartViewProps>(
  ({ symbol = "BECH/USD" }, ref) => {
    const webRef = useRef<WebView>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const latestPriceRef = useRef(0);
    const lastLayoutRef = useRef({ w: 0, h: 0 });
    const webReadyRef = useRef(false);

    /* ---------- RN → WEB API ---------- */
    useImperativeHandle(ref, () => ({
      getCurrentPrice: () => latestPriceRef.current,

      onTrade: (
        type: string,
        amount: number,
        price: number,
        id: string,
        profit = 0,
        expire = 0
      ) => {
        const payload = {
          type: type.toUpperCase(),
          amount,
          price,
          id,
          profit,
          expire,
        };

        // 📱 ANDROID / IOS
        if (Platform.OS !== "web") {
          webRef.current?.injectJavaScript(`
            window.handleRNMessage && window.handleRNMessage(${JSON.stringify(
              payload
            )});
            true;
          `);
        }

        // 🌐 WEB ONLY
        if (Platform.OS === "web") {
          iframeRef.current?.contentWindow?.postMessage(payload, "*");
        }
      },

      removeMarker: (id: string) => {
        webRef.current?.injectJavaScript(`
          window.removeMarkerById && window.removeMarkerById("${id}");
          true;
        `);
      },

      resize: () => {
        if (!webReadyRef.current) return;
        const { w, h } = lastLayoutRef.current;
        webRef.current?.injectJavaScript(`
          if (window.chart && chart.applyOptions) {
            chart.applyOptions({ width: ${w}, height: ${h} });
          }
          true;
        `);
      },

      

      setWickCompression: (value: number) => {
        if (!webReadyRef.current) return;
        webRef.current?.injectJavaScript(`
          window.setWickCompression && window.setWickCompression(${value});
          true;
        `);
      },
    }));

    /* ---------------- HTML ---------------- */

    const tradingViewHTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
html,body{
  margin:0;
  height:100%;
  background:#0b1220;
  overflow:hidden;
}
#chart{width:100%;height:100%;}
#pairName{
  position:absolute;top:6px;left:10px;color:#9ca3af;font-size:13px;z-index:10;
}
#tradeInfoContainer{
  position:absolute;top:6px;left:80px;display:flex;flex-direction:column;gap:4px;z-index:20;pointer-events:none;
}
.tradeInfo{
  background:rgba(11,18,32,0.7);color:#e5e7eb;font-size:13px;padding:4px 8px;border-radius:6px;min-width:80px;text-align:center;backdrop-filter:blur(6px);font-family:monospace;
}
</style>
<script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
</head>
<body>
<div id="pairName">${symbol}</div>
<div id="tradeInfoContainer"></div>
<div id="chart"></div>
<script>
(() => {
const tradeInfoContainer=document.getElementById("tradeInfoContainer");
const tradeInfoElements={};
function updateTradeInfo(id,text,color){
  let el=tradeInfoElements[id];
  if(!el){el=document.createElement("div");el.className="tradeInfo";tradeInfoContainer.appendChild(el);tradeInfoElements[id]=el;}
  el.textContent=text;el.style.color=color;
}
function removeTradeInfo(id){const el=tradeInfoElements[id];if(el){tradeInfoContainer.removeChild(el);delete tradeInfoElements[id];}}
const {createChart}=LightweightCharts;
const chartEl=document.getElementById("chart");
window.chart=createChart(chartEl,{width:window.innerWidth,height:window.innerHeight,layout:{background:{color:"#0b1220"},textColor:"#d1d5db"},grid:{vertLines:{color:"rgba(255,255,255,0.04)"},horzLines:{color:"rgba(255,255,255,0.04)"}},timeScale:{timeVisible:true},crosshair:{mode:1}});
const series=chart.addCandlestickSeries({upColor:"#22c55e",downColor:"#ef4444",borderVisible:false,wickUpColor:"#22c55e",wickDownColor:"#ef4444"});
let bars=[],i=0,lastBar=null;let markers=[];let priceLines={};let wickCompression=0.3;let useHeikinAshi=false;let rawBars=[],haBars=[];
function sendToRN(p){const m=JSON.stringify(p);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else if(window.parent!==window)window.parent.postMessage(m,"*");}
function applyWickCompression(b){if(wickCompression===1)return b;const m=(b.high+b.low)/2;return {...b,high:m+(b.high-m)*wickCompression,low:m-(m-b.low)*wickCompression};}
function toHA(b,p){const c=(b.open+b.high+b.low+b.close)/4;const o=p?(p.open+p.close)/2:b.open;return {time:b.time,open:o,high:Math.max(b.high,o,c),low:Math.min(b.low,o,c),close:c};}
function seed(){const now=Math.floor(Date.now()/1000);let o=1945;for(let j=0;j<200;j++){const c=o+(Math.random()-0.5)*10;bars.push({time:now-(200-j)*60,open:o,high:Math.max(o,c)+5,low:Math.min(o,c)-5,close:c});o=c;}rawBars=bars.slice(0,50);haBars=rawBars.map((b,i)=>toHA(b,haBars[i-1]));series.setData((useHeikinAshi?haBars:rawBars).map(applyWickCompression));chart.timeScale().fitContent();i=50;}
function tick(){if(i>=bars.length){const l=bars[bars.length-1];const c=l.close+(Math.random()-0.5)*20;bars.push({time:l.time+60,open:l.close,high:Math.max(l.close,c)+5,low:Math.min(l.close,c)-5,close:c});}const b=bars[i++];rawBars.push(b);const ha=toHA(b,haBars[haBars.length-1]);haBars.push(ha);series.update(applyWickCompression(useHeikinAshi?ha:b));lastBar=b;chart.timeScale().scrollToRealTime();sendToRN({type:"TICK",close:b.close});}
window.setWickCompression=v=>{wickCompression=v;series.setData((useHeikinAshi?haBars:rawBars).map(applyWickCompression));};
window.handleRNMessage=(msg)=>{if(!msg)return;const candleTime=lastBar?lastBar.time:rawBars.length?rawBars[rawBars.length-1].time:null;if(!candleTime)return;const t=String(msg.type).toUpperCase();if(t!=="BUY"&&t!=="SELL")return;const entry=typeof msg.price==="number"&&msg.price>0?msg.price:lastBar.close;const exp=Date.now()+(msg.expire||0);markers=markers.filter(m=>m.id!==msg.id);if(priceLines[msg.id]){series.removePriceLine(priceLines[msg.id]);delete priceLines[msg.id];}markers.push({time:candleTime,position:t==="BUY"?"belowBar":"aboveBar",color:t==="BUY"?"#22c55e":"#ef4444",
shape:t==="BUY"?"arrowUp":"arrowDown",text:t==="BUY"?"Buy":"Sell",id:msg.id});priceLines[msg.id]=series.createPriceLine({price:entry,color:t==="BUY"?"#22c55e":"#ef4444",
lineWidth:2,axisLabelVisible:true,title:t+" ENTRY"});series.setMarkers(markers);const timer=setInterval(()=>{const remaining=Math.max(0,Math.ceil((exp-Date.now())/1000));const minutes=Math.floor(remaining/60);const seconds=remaining%60;const countdown=\`\${minutes}:\${seconds.toString().padStart(2,"0")}\`;const currentPrice=lastBar.close;
let pl=0;if(t==="BUY")pl=Math.min(Math.max(currentPrice-entry,0),
msg.profit||0);else pl=Math.min(Math.max(entry-currentPrice,0),msg.profit||0);
const payout=pl>0?msg.amount+pl:0;
const displayText=pl>0?\`\${t}: \${msg.amount}$; Payout: \${msg.profit}$;
 Expected Profit: +\${payout.toFixed(2)}$; Expires in: \${countdown}\`:\`\${t}: \${msg.amount}$; LOSS: -\${msg.amount}$; Payout: 0$; Expires in: \${countdown}\`;const color=pl>0?"#22c55e":"#ef4444";updateTradeInfo(msg.id,displayText,color);if(remaining<=0){clearInterval(timer);removeTradeInfo(msg.id);markers=markers.filter(m=>m.id!==msg.id);series.setMarkers(markers);if(priceLines[msg.id]){series.removePriceLine(priceLines[msg.id]);delete priceLines[msg.id];}}},500);};
window.addEventListener("message",e=>{if(!e.data)return;try{const d=typeof e.data==="string"?JSON.parse(e.data):e.data;window.handleRNMessage(d);}catch{}});window.removeMarkerById=id=>{markers=markers.filter(m=>m.id!==id);series.setMarkers(markers);if(priceLines[id]){series.removePriceLine(priceLines[id]);delete priceLines[id];}};seed();sendToRN({type:"READY"});setTimeout(()=>{setInterval(tick,1000);},300);
})();
</script>
</body>
</html>`;

    /* ---------------- RN SIDE ---------------- */

    const onMessage = (e: { nativeEvent: { data: string } }) => {
      try {
        const raw = e.nativeEvent.data;
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (data.type === "READY") webReadyRef.current = true;
        if (data.type === "TICK") latestPriceRef.current = data.close;
      } catch {}
    };

    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width === 0 || height === 0) return;
      lastLayoutRef.current = { w: width, h: height };
      setTimeout(() => {
        webRef.current?.injectJavaScript(`
          if(window.chart){
            chart.applyOptions({width:${width},height:${height}});
          }
          true;
        `);
      }, 50);
    };

    useEffect(() => {
      if (Platform.OS !== "web") return;
      const handler = (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === "READY") webReadyRef.current = true;
          if (d.type === "TICK") latestPriceRef.current = d.close;
        } catch {}
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, []);

    if (Platform.OS === "web") {
      return (
        <iframe
          ref={iframeRef}
          srcDoc={tradingViewHTML}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      );
    }

    return (
      <View style={styles.container} onLayout={onLayout}>
        <WebView
          ref={webRef}
          source={{ html: tradingViewHTML, baseUrl: "https://localhost" }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowsInlineMediaPlayback
          androidLayerType="hardware"
          renderToHardwareTextureAndroid
          style={styles.webview}
        />
      </View>
    );
  }
);

ChartView.displayName = "ChartView";

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
  webview: { width: "100%", height: "100%", backgroundColor: "#0b1220" },
});

export default ChartView;