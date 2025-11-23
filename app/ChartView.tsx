import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

// ✅ Define prop types for the component
type ChartViewProps = {
  symbol?: string;
  orientation?: "portrait" | "landscape";
};

const ChartView = forwardRef<any, ChartViewProps>(
  ({ symbol = "BECH/USD", orientation = "portrait" }, ref) => {

      const webRef = useRef<WebView>(null);
    const latestPriceRef = useRef<number | null>(null);

    
    // ✅ Expose functions to parent component
    useImperativeHandle(ref, () => ({
      getCurrentPrice: () => latestPriceRef.current || 0,
      onTrade: (type: string, amount: number, price: number, id: string, profit = 0, expire = 0) => {
        if (!webRef.current) return;
        const js = `
          if (window.handleRNMessage) {
            window.handleRNMessage({
              type: "${type.toUpperCase()}",
              amount: ${amount},
              price: ${price},
              id: "${id}",
              profit: ${profit},
              expire: ${expire}
            });
          }
          true;
        `;
        webRef.current.injectJavaScript(js);
      },
      removeMarker: (id: string) => {
        if (!webRef.current) return;
        const js = `
          if (window.removeMarkerById) window.removeMarkerById("${id}");
          true;
        `;
        webRef.current.injectJavaScript(js);
      },
    }));

    const tradingViewHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <style>
            html, body { margin:0; padding:0; height:100%; background:#0b1220; overflow:hidden; }
            #chart { width:100%; height:100%; }
            #pairName {
              position:absolute;
              top:6px; left:10px;
              color:#a0a0a0;
              font-size:14px;
              font-family:Arial, sans-serif;
              letter-spacing:1px;
              z-index:10;
            }
          </style>
          <script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
        </head>
        <body>
          <div id="pairName">${symbol}</div>
          <div id="chart"></div>

          <script>
            const { createChart } = LightweightCharts;
            const chart = createChart(document.getElementById("chart"), {
              width: window.innerWidth,
              height: window.innerHeight,
              layout: { background: { color: "#0b1220" }, textColor: "#d1d5db" },
              grid: { vertLines:{color:"rgba(255,255,255,0.04)"}, horzLines:{color:"rgba(255,255,255,0.04)"} },
              timeScale: { timeVisible:true, secondsVisible:false, borderColor:"rgba(255,255,255,0.1)" },
              crosshair: { mode: 1 }
            });

            const series = chart.addCandlestickSeries({
              upColor:"#22c55e", downColor:"#ef4444", borderVisible:false,
              wickUpColor:"#22c55e", wickDownColor:"#ef4444"
            });

            let bars = [], i=0, lastBar=null, markers=[];

            function generateFakeData() {
              const now = Math.floor(Date.now()/1000);
              let open = 1945;
              for (let j=0; j<200; j++) {
                const close = open + (Math.random()-0.5)*10;
                const high = Math.max(open,close) + Math.random()*5;
                const low = Math.min(open,close) - Math.random()*5;
                bars.push({ time: now-(200-j)*60, open, high, low, close });
                open = close;
              }
            }

            function tick() {
              if (i >= bars.length) {
                const last = bars[bars.length - 1];
                const open = last.close;
                const close = open + (Math.random() - 0.5) * 20;
                const high = Math.max(open, close) + Math.random() * 5;
                const low = Math.min(open, close) - Math.random() * 5;
                const time = last.time + 60;
                const newBar = { time, open, high, low, close };
                bars.push(newBar);
              }

              const bar = bars[i++];
              series.update(bar);
              lastBar = bar;
              chart.timeScale().scrollToRealTime();

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type:"TICK", close: bar.close }));
              }
            }

            // ✅ Handle messages from RN (buy/sell)
            window.handleRNMessage = function(msg) {
              if (!msg || !msg.type) return;
              if (msg.type === "BUY" || msg.type === "SELL") {
                if (!lastBar) return;

                const expireTime = Date.now() + (msg.expire || 0);
                const marker = {
                  time: Math.floor(Date.now()/1000),
                  position: "inBar",
                  price: msg.price,
                  color: msg.type === "BUY" ? "#22c55e" : "#ef4444",
                  shape: msg.type === "BUY" ? "arrowUp" : "arrowDown",
                  text: \`\${msg.type} $\${msg.amount}\`,
                  id: msg.id,
                  expireTime: expireTime,
                  type: msg.type
                };

                markers.push(marker);
                series.setMarkers(markers);

                // ⚡ Glowing pulse animation
                const pulse = document.createElement("div");
                pulse.style.position = "absolute";
                pulse.style.width = "12px";
                pulse.style.height = "12px";
                pulse.style.borderRadius = "50%";
                pulse.style.background = msg.type === "BUY" ? "#22c55e" : "#ef4444";
                pulse.style.boxShadow = \`0 0 10px \${msg.type === "BUY" ? "#22c55e" : "#ef4444"}\`;
                pulse.style.opacity = "0.8";
                pulse.style.transition = "all 0.6s ease-out";
                pulse.style.pointerEvents = "none";
                document.body.appendChild(pulse);

                const y = chart.priceScale("right").priceToCoordinate(msg.price);
                const x = chart.timeScale().timeToCoordinate(marker.time);
                if (x && y) {
                  pulse.style.left = \`\${x - 6}px\`;
                  pulse.style.top = \`\${y - 6}px\`;
                }

                setTimeout(() => { pulse.style.opacity = "0"; pulse.style.transform = "scale(2)"; }, 100);
                setTimeout(() => { if (pulse.parentNode) pulse.parentNode.removeChild(pulse); }, 1000);

                // ⏳ Countdown updater
                const interval = setInterval(() => {
                  const remaining = Math.max(0, Math.ceil((expireTime - Date.now()) / 1000));
                  const m = markers.find(x => x.id === msg.id);
                  if (m) {
                    m.text = \`\${m.type} $\${msg.amount} | \${remaining}s\`;
                    series.setMarkers(markers);
                  }
                  if (remaining <= 0) clearInterval(interval);
                }, 1000);
              }
            };

            // ✅ Remove marker
            window.removeMarkerById = function(id) {
              markers = markers.filter(m => m.id !== id);
              series.setMarkers(markers);
            };

            function boot() {
              generateFakeData();
              series.setData(bars.slice(0,50));
              i=50;
              setInterval(tick, 1000);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type:"READY" }));
              }
            }

            window.addEventListener("resize", () => {
              chart.applyOptions({ width: window.innerWidth, height: window.innerHeight });
            });

            boot();
          </script>
        </body>
      </html>
    `;

   const onMessage = (event: any) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === "TICK") {
      latestPriceRef.current = data.close;
    }
  } catch (e) {
    console.log("WebView message parsing error:", e);
  }
};


    return (
      <View style={{ flex: 1, width: "100%", height: "100%" }}>
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html: tradingViewHTML }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
        />
      </View>
    );
  }
);

ChartView.displayName = "ChartView";

export default ChartView;


