// ChartView.tsx — CLEAN + STABLE + ENTRY PRICE LINE (FIXED)

import {
  forwardRef,
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
};

/* ---------------- COMPONENT ---------------- */

const ChartView = forwardRef<ChartViewHandle, ChartViewProps>(
  function ChartView({ symbol = "BECH/USD" }, ref) {

    const webRef = useRef<WebView>(null);
    const latestPriceRef = useRef<number>(0);
    const lastLayoutRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

    /* ---------- RN → WEB API ---------- */
    useImperativeHandle(ref, () => ({
      getCurrentPrice: () => latestPriceRef.current,

      onTrade: (type, amount, price, id, profit = 0, expire = 0) => {
        webRef.current?.injectJavaScript(`
          window.handleRNMessage && window.handleRNMessage({
            type: "${type.toUpperCase()}",
            amount: ${amount},
            price: ${price},
            id: "${id}",
            profit: ${profit},
            expire: ${expire}
          });
          true;
        `);
      },

      removeMarker: (id: string) => {
        webRef.current?.injectJavaScript(`
          window.removeMarkerById && window.removeMarkerById("${id}");
          true;
        `);
      },

      resize: () => {
        const { w, h } = lastLayoutRef.current;
        webRef.current?.injectJavaScript(`
          if (window.chart) {
            chart.applyOptions({ width:${w}, height:${h} });
          }
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
html,body{margin:0;height:100%;background:#0b1220;overflow:hidden}
#chart{width:100%;height:100%}
#pairName{position:absolute;top:6px;left:10px;color:#9ca3af;font-size:13px;z-index:10}
</style>
<script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
</head>

<body>
<div id="pairName">${symbol}</div>
<div id="chart"></div>

<script>
(() => {
  const { createChart } = LightweightCharts;

  const chartEl = document.getElementById("chart");

 window.chart = createChart(chartEl, {
  width: window.innerWidth,
  height: window.innerHeight,
  layout: { background:{color:"#0b1220"}, textColor:"#d1d5db" },
  grid: {
    vertLines:{color:"rgba(255,255,255,0.04)"},
    horzLines:{color:"rgba(255,255,255,0.04)"}
  },
  timeScale: { timeVisible:true },
  crosshair:{ mode:1 }
    // 👇 ADD THIS
  rightPriceScale: {
    scaleMargins: { top: 0.2, bottom: 0.2 }
  }
});

  const series = chart.addCandlestickSeries({
    upColor:"#22c55e",
    downColor:"#ef4444",
    borderVisible:false,
    wickUpColor:"#22c55e",
    wickDownColor:"#ef4444"
  });

  // rest of your code continues...
  let bars=[], i=0, lastBar=null;
  let markers=[];
  let priceLines={};

  function seed(){
    const now=Math.floor(Date.now()/1000);
    let open=1945;
    for(let j=0;j<200;j++){
      const close=open+(Math.random()-0.5)*10;
      bars.push({
        time: now-(200-j)*60,
        open,
        high:Math.max(open,close)+5,
        low:Math.min(open,close)-5,
        close
      });
      open=close;
    }
    series.setData(bars.slice(0,50));
     chart.timeScale().fitContent(); 
    i=50;
  }

  function tick(){
    if(i>=bars.length){
      const last=bars[bars.length-1];
      const close=last.close+(Math.random()-0.5)*20;
      bars.push({
        time:last.time+60,
        open:last.close,
        high:Math.max(last.close,close)+5,
        low:Math.min(last.close,close)-5,
        close
      });
    }

    const bar=bars[i++];
    series.update(bar);
    lastBar=bar;

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type:"TICK",
      close:bar.close
    }));
  }

  window.handleRNMessage = (msg) => {
  if (!msg || !window.chart || !series || !lastBar) return;

    const t=String(msg.type).toUpperCase();
    if(t!=="BUY" && t!=="SELL") return;

    const expireAt=Date.now()+(msg.expire||0);
markers = markers.filter(m => m.id !== msg.id);

if (priceLines[msg.id]) {
  series.removePriceLine(priceLines[msg.id]);
  delete priceLines[msg.id];
}
    markers.push({
      time:lastBar.time,
      position:"price",
      price:msg.price,
      color:t==="BUY"?"#22c55e":"#ef4444",
      shape:t==="BUY"?"arrowUp":"arrowDown",
      text:\`\${t} $\${msg.amount}\`,
      id:msg.id
    });

    if (markers.length > 0) {
  series.setMarkers(markers);
}
    priceLines[msg.id]=series.createPriceLine({
      price:msg.price,
      color:t==="BUY"?"#22c55e":"#ef4444",
      lineWidth:2,
      axisLabelVisible:true,
      title:t+" ENTRY"
    });

    const timer=setInterval(()=>{
      const remain=Math.max(0,Math.ceil((expireAt-Date.now())/1000));
      const m=markers.find(x=>x.id===msg.id);
      if(m){
        m.text=\`\${t} $\${msg.amount} | \${remain}s\`;
        series.setMarkers(markers);
      }
      if(remain<=0){
        clearInterval(timer);
        if(priceLines[msg.id]){
          series.removePriceLine(priceLines[msg.id]);
          delete priceLines[msg.id];
        }
      }
    },1000);
  };

  window.removeMarkerById = (id) => {
    markers=markers.filter(m=>m.id!==id);
    series.setMarkers(markers);
    if(priceLines[id]){
      series.removePriceLine(priceLines[id]);
      delete priceLines[id];
    }
  };

  seed();
  setInterval(tick,1000);
})();
</script>
</body>
</html>`;

    /* ---------------- RN SIDE ---------------- */

    const onMessage = (e: any) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "TICK") {
          latestPriceRef.current = data.close;
        }
      } catch {}
    };

    const onLayout = (e: LayoutChangeEvent) => {
  const { width, height } = e.nativeEvent.layout;
  lastLayoutRef.current = { w: width, h: height };

  webRef.current?.injectJavaScript(`
  if (window.chart && chart.applyOptions) {
    chart.applyOptions({ width: ${width}, height: ${height} });
  }
  true;
`);

};


    if (Platform.OS === "web") {
      return <iframe srcDoc={tradingViewHTML} style={{ width:"100%", height:"100%", border:"none" }} />;
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
          /* 🔑 ANDROID FIXES */
  mixedContentMode="always"
  allowFileAccess
  allowUniversalAccessFromFileURLs
  allowsInlineMediaPlayback

          style={styles.webview}
        />
      </View>
    );
  }
);

ChartView.displayName = "ChartView";

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#0b1220" },
});

export default ChartView;
