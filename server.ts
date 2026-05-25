import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import net from "net";
import fs from "fs";
import geoip from "geoip-lite";

const app = express();
app.use(express.json());
const PORT = 3000;

interface ProxyNode {
  ip: string;
  port: string;
  country: string;
  speed: number;
  uptime: number;
  anonymity: string;
  source: string;
  lastChecked: number;
  checks: number;
  successfulChecks: number;
  isWorking: boolean;
  consecutiveFailures: number;
  addedBy?: string;
}

// In-memory Database
const proxyDb = new Map<string, ProxyNode>();
const recentChecks: { ip: string, port: string, time: number, success: boolean, ms: number }[] = [];

// Sources for proxy parsing
const sourceUrls = new Set<string>([
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
  "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
  "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
  "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt",
  "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
  "https://raw.githubusercontent.com/Bardiafa/Proxy-Leecher/main/socks5.txt",
  "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/socks5.txt",
  "https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/socks5.txt",
  "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/socks5_proxies.txt",
  "https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks5.txt",
  "https://raw.githubusercontent.com/casals-ar/proxy-list/main/socks5",
  "https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/socks5.txt",
  "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
  "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/socks5/socks5.txt",
  "https://raw.githubusercontent.com/Zeller255/Proxy/main/socks5.txt",
  "https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks5.txt",
  "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt",
  "https://cdn.jsdelivr.net/gh/Infinity2346/socks5@main/proxies.txt",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt"
]);

// SOCKS5 TCP Handshake Checker
function checkSocks5(ip: string, port: number, timeoutMs = 2000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = new net.Socket();
    let isSettled = false;

    const cleanup = () => {
      if (!socket.destroyed) socket.destroy();
    };

    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error("Timeout"));
      }
    }, timeoutMs);

    socket.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeout);
        cleanup();
        reject(err);
      }
    });

    socket.connect(port, ip, () => {
      socket.write(Buffer.from([0x05, 0x01, 0x00]));
    });

    socket.on("data", (data) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeout);
        cleanup();
        if (data.length >= 2 && data[0] === 0x05 && data[1] === 0x00) {
          resolve(Date.now() - start);
        } else {
          reject(new Error("Invalid protocol"));
        }
      }
    });
  });
}

function getRealCountryInfo(ip: string): { country: string; valid: boolean } {
  const geo = geoip.lookup(ip);
  if (!geo) return { country: "Unknown", valid: false };
  if (geo.country === "RU") return { country: "RU", valid: false };
  
  // All European + CIS country codes
  const allowedCountries = new Set([
     "UA", "BY", "MD", "GE", "AM", "AZ", "KZ", "UZ", "TM", "KG", "TJ", "EE", "LV", "LT", // CIS
     "AL", "AD", "AT", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "FI", "FR", "DE", "GR",
     "HU", "IS", "IE", "IT", "XK", "LI", "LU", "MT", "MC", "ME", "NL", "MK", "NO", "PL",
     "PT", "RO", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR", "GB", "VA"              // Europe
  ]);
  
  return { country: geo.country, valid: allowedCountries.has(geo.country) };
}

// Global Parser
async function parseSources() {
  console.log(`[Parser] Running parser for ${sourceUrls.size} sources...`);
  for (const url of sourceUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      
      let added = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes("<") || trimmed.includes("{")) continue;
        const [ip, port] = trimmed.split(":");
        if (ip && port && !isNaN(Number(port))) {
          const key = `${ip}:${port}`;
          if (!proxyDb.has(key)) {
            const countryInfo = getRealCountryInfo(ip);
            if (countryInfo.valid) {
              proxyDb.set(key, {
                ip,
                port,
                country: countryInfo.country,
                speed: 0,
                uptime: 100,
                anonymity: "Elite",
                source: url,
                lastChecked: 0,
                checks: 0,
                successfulChecks: 0,
                isWorking: false,
                consecutiveFailures: 0
              });
              added++;
            }
          }
        }
      }
      console.log(`[Parser] Extracted ${added} new proxies from ${url}`);
    } catch (err) {
      console.error(`[Parser] Error fetching ${url}:`, err);
    }
  }
}

// Background Checker Worker
async function verifyProxies() {
  const allProxies = Array.from(proxyDb.values());
  const neverChecked = allProxies.filter(p => p.lastChecked === 0);
  const checked = allProxies.filter(p => p.lastChecked > 0).sort((a, b) => a.lastChecked - b.lastChecked);

  const toCheck: ProxyNode[] = [];
  if (neverChecked.length > 0) {
    for (let i = 0; i < 5; i++) {
        const item = neverChecked[i];
        if (item && !toCheck.includes(item)) toCheck.push(item);
    }
  }
  toCheck.push(...checked.slice(0, 5 - toCheck.length));

  if (toCheck.length === 0) return;

  await Promise.allSettled(toCheck.map(async (p) => {
    p.lastChecked = Date.now();
    p.checks++;
    try {
      const latency = await checkSocks5(p.ip, Number(p.port), 3000); // 3s timeout
      p.speed = latency;
      p.successfulChecks++;
      p.isWorking = true;
      p.consecutiveFailures = 0;
      recentChecks.unshift({ ip: p.ip, port: p.port, time: Date.now(), success: true, ms: latency });
    } catch (e) {
      p.isWorking = false;
      p.consecutiveFailures++;
      recentChecks.unshift({ ip: p.ip, port: p.port, time: Date.now(), success: false, ms: 0 });
    }
    
    if (recentChecks.length > 50) recentChecks.pop();
    
    p.uptime = p.checks > 0 ? (p.successfulChecks / p.checks) * 100 : 100;

    // Prune logic: drop if failed 3 times in a row, or never worked and checked 3 times
    if (p.consecutiveFailures >= 3 && p.addedBy !== "Author Added") {
      proxyDb.delete(`${p.ip}:${p.port}`);
    }
  }));
}

// Start background loops
setInterval(parseSources, 30 * 60 * 1000); // Parse new proxies every 30 mins
setInterval(verifyProxies, 3000); // Check 1 proxy every 3 seconds

// API Endpoints
app.get("/api/socks5.txt", (req, res) => {
  const workingProxies = Array.from(proxyDb.values())
    .filter(p => p.isWorking)
    .sort((a, b) => a.speed - b.speed);
    
  const textList = workingProxies.map(p => `${p.ip}:${p.port}`).join("\n");
  
  res.setHeader("Content-Type", "text/plain");
  res.send(textList);
});

app.get("/api/proxies", (req, res) => {
  const workingProxies = Array.from(proxyDb.values())
    .filter(p => p.isWorking && p.speed > 0 && p.speed <= 1000)
    .sort((a, b) => {
      // Prioritize uptime for stability
      if (Math.abs(b.uptime - a.uptime) > 10) { 
        return b.uptime - a.uptime;
      }
      return a.speed - b.speed;
    })
    .slice(0, 5000); // Massive list

  res.json({
    proxies: workingProxies.map(p => ({
      ip: p.ip,
      port: p.port,
      country: p.country,
      speed: p.speed,
      uptime: p.uptime,
      anonymity: p.anonymity,
      source: p.source,
      addedBy: p.addedBy
    }))
  });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: recentChecks });
});

app.post("/api/manual", async (req, res) => {
  const { ip, port } = req.body;
  
  if (!ip || !port || isNaN(Number(port))) {
    return res.status(400).json({ error: "Invalid IP or Port" });
  }

  try {
    const latency = await checkSocks5(ip, Number(port), 5000);
    const key = `${ip}:${port}`;
    let p = proxyDb.get(key);
    
    let country = "Unknown";
    const countryInfo = getRealCountryInfo(ip);
    if (countryInfo.valid || countryInfo.country !== "Unknown") {
       country = countryInfo.country;
    }

    if (!p) {
      proxyDb.set(key, {
        ip,
        port: port.toString(),
        country,
        speed: latency,
        uptime: 100,
        anonymity: "Elite",
        source: "Manual",
        lastChecked: Date.now(),
        checks: 1,
        successfulChecks: 1,
        isWorking: true,
        consecutiveFailures: 0,
        addedBy: "Author Added"
      });
    } else {
      p.speed = latency;
      p.isWorking = true;
      p.checks++;
      p.successfulChecks++;
      p.lastChecked = Date.now();
      p.consecutiveFailures = 0;
      p.addedBy = "Author Added";
    }
    
    res.json({ success: true, latency });
  } catch (err) {
    res.status(400).json({ error: "Connection to proxy failed or timed out" });
  }
});

app.post("/api/sources", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid URL provided" });
  }
  sourceUrls.add(url);
  // Trigger immediate parsing for this new source
  try {
    const fetchRes = await fetch(url);
    const text = await fetchRes.text();
    let added = 0;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes("<") || trimmed.includes("{")) continue;
      const [ip, port] = trimmed.split(":");
      if (ip && port && !isNaN(Number(port))) {
        const key = `${ip}:${port}`;
        if (!proxyDb.has(key)) {
          const countryInfo = getRealCountryInfo(ip);
          if (countryInfo.valid) {
            proxyDb.set(key, {
              ip,
              port,
              country: countryInfo.country,
              speed: 0,
              uptime: 100,
              anonymity: "Elite",
              source: url,
              lastChecked: 0,
              checks: 0,
              successfulChecks: 0,
              isWorking: false,
              consecutiveFailures: 0
            });
            added++;
          }
        }
      }
    }
    res.json({ success: true, addedFilesCount: added, totalSources: sourceUrls.size });
  } catch (err) {
    res.status(500).json({ error: "Failed to download and parse file" });
  }
});

app.get("/api/stats", (req, res) => {
  const all = Array.from(proxyDb.values());
  res.json({
    totalKnown: all.length,
    working: all.filter(p => p.isWorking).length,
    sourcesCount: sourceUrls.size
  });
});

async function startServer() {
  // Run initial parse
  await parseSources();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
