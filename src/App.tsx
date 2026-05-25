import { Activity, Copy, Globe, Plus, RefreshCw, Server, Shield, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { ProxyServer } from "./types";

export default function App() {
  const [proxies, setProxies] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Stats and Sources
  const [stats, setStats] = useState({ totalKnown: 0, working: 0, sourcesCount: 3 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customSrc, setCustomSrc] = useState("");
  const [srcLoading, setSrcLoading] = useState(false);
  const [srcMsg, setSrcMsg] = useState("");

  const [activeTab, setActiveTab] = useState<"dashboard" | "checker" | "manual" | "gateway">("dashboard");
  const [logs, setLogs] = useState<{ ip: string; port: string; time: number; success: boolean; ms: number }[]>([]);

  // Manual Check State
  const [manualIp, setManualIp] = useState("");
  const [manualPort, setManualPort] = useState("");
  const [manualChecking, setManualChecking] = useState(false);
  const [manualResult, setManualResult] = useState<{success?: boolean; msg?: string; latency?: number} | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  const fetchProxies = async (showLoading = true) => {
    if (showLoading && proxies.length === 0) setLoading(true);
    setError("");
    try {
      const [res, statsRes, logsRes] = await Promise.all([
        fetch("/api/proxies"),
        fetch("/api/stats"),
        fetch("/api/logs")
      ]);
      const data = await res.json();
      const stData = await statsRes.json();
      const logsData = await logsRes.json();
      
      if (res.ok) {
        setProxies(data.proxies || []);
        if (statsRes.ok) setStats(stData);
        if (logsRes.ok) setLogs(logsData.logs || []);
        setLastUpdated(new Date());
      } else {
        setError(data.error || "Failed to load proxies");
      }
    } catch (err) {
      setError("Network error fetching proxies");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProxies();
    
    // Poll for real-time updates every 1 second
    const interval = setInterval(() => {
      fetchProxies(false); // pass flag to indicate background fetch
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCopy = (ip: string, port: string, index: number) => {
    navigator.clipboard.writeText(`${ip}:${port}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSrc.startsWith("http")) return;
    setSrcLoading(true);
    setSrcMsg("");
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: customSrc })
      });
      const data = await res.json();
      if (res.ok) {
        setSrcMsg(`Успешно добавлено! Найдено ${data.addedFilesCount} новых прокси.`);
        setCustomSrc("");
        fetchProxies(); // Refresh stats
      } else {
        setSrcMsg(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      setSrcMsg("Ошибка сети при добавлении");
    } finally {
      setSrcLoading(false);
    }
  };

  const activeCount = proxies.length;
  const handleManualCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp || !manualPort) return;
    setManualChecking(true);
    setManualResult(null);
    try {
      const res = await fetch("/api/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: manualIp, port: parseInt(manualPort) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManualResult({ success: true, latency: data.latency, msg: "Успешно подключено!" });
        setManualIp("");
        setManualPort("");
        fetchProxies(false);
      } else {
        setManualResult({ success: false, msg: data.error || "Ошибка подключения к прокси" });
      }
    } catch (e) {
      setManualResult({ success: false, msg: "Сетевая ошибка" });
    } finally {
      setManualChecking(false);
    }
  };

  const avgSpeed =
    proxies.length > 0
      ? Math.round(proxies.reduce((acc, p) => acc + p.speed, 0) / proxies.length)
      : 0;

  return (
    <div className="w-full min-h-screen bg-[#0a0a0c] text-slate-300 font-sans flex flex-col overflow-x-hidden selection:bg-emerald-900 selection:text-emerald-50 relative">
      {/* Modal Source Input */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141418] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2">Добавить файл с прокси</h3>
            <p className="text-sm text-slate-400 mb-6 font-medium">
              Вставьте прямую ссылку (URL) на txt файл с SOCKS5 прокси.<br/>
              Формат файла: <span className="font-mono bg-slate-800/50 px-1 rounded text-emerald-400">IP:PORT</span> на каждой строке.
            </p>
            
            <form onSubmit={handleAddSource} className="space-y-4">
              <div>
                <input
                  type="url"
                  placeholder="https://example.com/socks5.txt"
                  value={customSrc}
                  onChange={(e) => setCustomSrc(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0c] border border-slate-700/50 rounded-lg px-4 py-3 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={srcLoading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-widest text-sm rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {srcLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {srcLoading ? "Парсинг..." : "Загрузить базу"}
              </button>
              {srcMsg && (
                <div className={`text-sm text-center font-medium ${srcMsg.includes("Ошибка") ? "text-red-400" : "text-emerald-400"}`}>
                  {srcMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-6 border-b border-slate-800/50 bg-[#0d0d10] gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_8px_white]"></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">SOCKS<span className="text-emerald-500">PRO</span></span>
              <button
                onClick={() => {
                  const textList = proxies.map(p => `${p.ip}:${p.port}`).join("\n");
                  const blob = new Blob([textList], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "socks5.txt";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="relative flex items-center justify-center h-7 px-2 rounded border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-all focus:outline-none text-[10px] font-bold uppercase tracking-wider"
                title="Download SOCKS5 list"
              >
                <Plus className="w-4 h-4 mr-1" /> TXT
                {linkCopied && (
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg pointer-events-none z-10">
                    Downloaded!
                  </span>
                )}
              </button>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab(activeTab === 'dashboard' ? 'checker' : (activeTab === 'checker' ? 'manual' : 'dashboard'))}
            className="md:hidden flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition-colors"
          >
            <div className={`w-1.5 h-1.5 bg-emerald-500 rounded-full ${loading ? '' : 'animate-pulse'}`}></div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">
              {activeTab === 'dashboard' ? 'Show Checker' : (activeTab === 'checker' ? 'Add Proxy' : 'Show List')}
            </span>
          </button>
        </div>
        
        <nav className="hidden md:flex gap-8 text-sm font-medium uppercase tracking-widest text-slate-500">
          <span 
            className={`cursor-pointer transition-colors ${activeTab === 'dashboard' ? 'text-emerald-400' : 'hover:text-slate-300'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </span>
          <span 
            className={`cursor-pointer transition-colors ${activeTab === 'checker' ? 'text-emerald-400' : 'hover:text-slate-300'}`}
            onClick={() => setActiveTab('checker')}
          >
            Live Checker
          </span>
          <span 
            className={`cursor-pointer transition-colors ${activeTab === 'manual' ? 'text-emerald-400' : 'hover:text-slate-300'}`}
            onClick={() => setActiveTab('manual')}
          >
            Add Proxy
          </span>
          <span 
            className={`cursor-pointer transition-colors ${activeTab === 'gateway' ? 'text-emerald-400' : 'hover:text-slate-300'}`}
            onClick={() => setActiveTab('gateway')}
          >
            Local Gateway
          </span>
          <span className="hover:text-slate-300 cursor-pointer transition-colors" onClick={() => setIsModalOpen(true)}>Add Source Link</span>
        </nav>
        
        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={() => setActiveTab(activeTab === 'dashboard' ? 'checker' : (activeTab === 'checker' ? 'manual' : 'dashboard'))}
            className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition-colors"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">
              {activeTab === 'dashboard' ? 'Live Checker' : (activeTab === 'checker' ? 'Add Proxy' : 'Back to List')}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-7xl mx-auto w-full">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#141418] border border-slate-800/60 p-5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Active Checked Nodes</div>
            <div className="text-3xl font-mono font-bold text-white">{activeCount} <span className="text-sm text-slate-500">of {stats.totalKnown}</span></div>
          </div>
          <div className="bg-[#141418] border border-slate-800/60 p-5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Fastest Ping Ping</div>
            <div className="text-3xl font-mono font-bold text-white">{avgSpeed} <span className="text-sm text-slate-500 font-sans">ms</span></div>
          </div>
          <div className="bg-[#141418] border border-slate-800/60 p-5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Active Sources</div>
            <div className="text-3xl font-mono font-bold text-emerald-500">{stats.sourcesCount} <span className="text-sm font-sans">TXT Sources</span></div>
          </div>
          <div className="bg-[#141418] border border-slate-800/60 p-5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last Updated</div>
            <div className="text-lg md:text-xl font-mono font-bold text-white mt-1">{lastUpdated.toLocaleTimeString()}</div>
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="flex-1 bg-[#141418] border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 bg-[#1a1a20] border-b border-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                Live SOCKS5 Servers
              </h2>
              <div className="text-xs text-slate-500 italic flex gap-4">
                 <button onClick={() => setIsModalOpen(true)} className="hover:text-emerald-400 transition-colors hidden md:block">
                   + Add File Source
                 </button>
                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>Real-time tracking</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              {error ? (
                <div className="p-12 text-center text-red-400">
                  <p>{error}</p>
                </div>
              ) : loading && proxies.length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4 text-emerald-600" />
                  <p className="text-[10px] uppercase tracking-widest font-medium">Checking Proxy Queue in Background...</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                  <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-[#16161c]">
                    <tr>
                      <th className="px-6 py-3 border-b border-slate-800/40">IP Address : Port</th>
                      <th className="px-6 py-3 border-b border-slate-800/40">Location</th>
                      <th className="px-6 py-3 border-b border-slate-800/40">Latency</th>
                      <th className="px-6 py-3 border-b border-slate-800/40">Speed Test</th>
                      <th className="px-6 py-3 border-b border-slate-800/40">Stability</th>
                      <th className="px-6 py-3 border-b border-slate-800/40 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {proxies.map((proxy, i) => (
                      <tr key={`${proxy.ip}-${proxy.port}-${i}`} className={`border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors group ${proxy.addedBy === 'Author Added' ? 'bg-blue-900/10' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div>
                              <span className="text-emerald-400">{proxy.ip}</span>
                              <span className="text-slate-500 mx-1">:</span>
                              <span className="text-slate-300">{proxy.port}</span>
                            </div>
                            {proxy.addedBy && (
                              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-1">
                                {proxy.addedBy}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          <span className="text-lg">
                            {proxy.country !== "Unknown" 
                              ? String.fromCodePoint(...proxy.country.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0))) 
                              : "🌐"}
                          </span> 
                          <span className="font-sans text-sm">{proxy.country}</span>
                        </td>
                        <td className="px-6 py-4 text-white">
                          {proxy.speed}ms
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-24 md:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${proxy.speed < 150 ? "bg-emerald-500" : proxy.speed < 400 ? "bg-yellow-500" : "bg-red-500"}`} 
                              style={{ width: `${Math.max(5, 100 - (proxy.speed / 10))}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-emerald-500">
                          {proxy.uptime.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleCopy(proxy.ip, proxy.port, i)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-white rounded transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {copiedIndex === i ? (
                              <span className="text-emerald-400">COPIED!</span>
                            ) : (
                              "COPY"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {proxies.length === 0 && !loading && !error && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                          Waiting for background checker to verify nodes. If empty long, consider adding a new txt source!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="px-6 py-4 bg-[#0d0d10] border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              <div className="text-slate-500">
                Showing <span className="text-slate-300">{proxies.length}</span> most stable high-speed nodes
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    const text = proxies.map(p => `${p.ip}:${p.port}`).join('\n');
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'proxies.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-emerald-500 text-black font-bold flex-1 md:flex-none text-center rounded-lg hover:bg-emerald-400 transition-colors uppercase tracking-tight"
                >
                  GENERATE LIST (.TXT)
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'checker' ? (
          <div className="flex-1 bg-[#141418] border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 bg-[#1a1a20] border-b border-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Live Node Verification
              </h2>
              <div className="text-xs text-slate-500 italic">
                Scanning 1 proxy every 3 seconds
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0a0a0c] font-mono text-sm space-y-2">
              {logs.length === 0 && <div className="text-slate-500 text-center mt-10">No logs yet. Waiting for next interval...</div>}
              {logs.map((log, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded bg-[#141418] border border-slate-800/50 gap-2">
                  <div className="flex items-center gap-3">
                    {log.success ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    )}
                    <span className="text-slate-400 text-xs">{new Date(log.time).toLocaleTimeString()}</span>
                    <span>
                      <span className="text-slate-300">{log.ip}</span>
                      <span className="text-slate-600">:</span>
                      <span className="text-slate-400">{log.port}</span>
                    </span>
                  </div>
                  <div>
                    {log.success ? (
                      <span className="text-emerald-400 font-bold whitespace-nowrap">{log.ms} ms</span>
                    ) : (
                      <span className="text-red-400 uppercase text-xs font-bold w-12 text-right">Dead</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'manual' ? (
          <div className="flex-1 bg-[#141418] border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 bg-[#1a1a20] border-b border-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                Add Manual Proxy
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-[#0a0a0c]">
              <div className="max-w-md w-full bg-[#16161c] border border-slate-800/50 p-8 rounded-xl">
                <h3 className="text-white text-lg font-bold mb-2">Manual Verification</h3>
                <p className="text-slate-500 text-sm mb-6">Enter a custom SOCKS5 proxy to test latency. If it works, it will be added to the main list as "Author Added".</p>
                <form onSubmit={handleManualCheck} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">IP Address</label>
                      <input 
                         type="text" 
                         value={manualIp}
                         onChange={e => setManualIp(e.target.value)}
                         placeholder="192.168.1.1"
                         className="w-full bg-[#0d0d10] border border-slate-700/50 rounded-lg px-4 py-2 text-white font-mono placeholder:text-slate-700 text-sm focus:outline-none focus:border-emerald-500/50"
                         required
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Port</label>
                      <input 
                         type="text" 
                         value={manualPort}
                         onChange={e => setManualPort(e.target.value)}
                         placeholder="1080"
                         className="w-full bg-[#0d0d10] border border-slate-700/50 rounded-lg px-4 py-2 text-white font-mono placeholder:text-slate-700 text-sm focus:outline-none focus:border-emerald-500/50"
                         required
                      />
                    </div>
                  </div>
                  <button 
                    disabled={manualChecking}
                    type="submit"
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm tracking-widest uppercase rounded-lg transition-colors flex justify-center items-center gap-2"
                  >
                    {manualChecking ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> : <Activity className="w-4 h-4 text-emerald-500" />}
                    {manualChecking ? 'Testing...' : 'Test & Add Proxy'}
                  </button>
                </form>
                
                {manualResult && (
                  <div className={`mt-6 p-4 rounded-lg border text-sm ${manualResult.success ? 'bg-emerald-900/10 border-emerald-500/30 text-emerald-400' : 'bg-red-900/10 border-red-500/30 text-red-400'}`}>
                    <div className="font-bold flex items-center gap-2 mb-1">
                      {manualResult.success ? 'Connection Successful!' : 'Connection Failed'}
                    </div>
                    <div>{manualResult.msg}</div>
                    {manualResult.latency && (
                      <div className="font-mono mt-2 flex gap-2">
                        <span className="text-slate-500">Latency:</span> {manualResult.latency} ms
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'gateway' ? (
          <div className="flex-1 bg-[#141418] border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 bg-[#1a1a20] border-b border-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                Local Opera Gateway
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0c]">
              <div className="max-w-2xl mx-auto w-full bg-[#16161c] border border-slate-800/50 p-8 rounded-xl">
                <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> 
                  SOCKS5 Tunnel for Opera
                </h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Due to cloud infrastructure limitations (Cloud Run only allows HTTP on port 3000), we cannot host a direct SOCKS5 server for your Opera browser here. However, you can run this simple Node.js script locally. It will act as a local SOCKS5 proxy on your machine, dynamically fetching the best working proxies from this app and proxying your Opera traffic seamlessly!
                </p>
                <div className="bg-[#0d0d10] p-4 rounded-lg border border-slate-700/50 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`// Save as local-proxy.js and run with: node local-proxy.js
const net = require('net');
const http = require('http');

let activeProxy = null;

// Fetch best proxy from our app every 10 seconds
setInterval(() => {
  http.get('http://localhost:3000/api/proxies', (res) => { // Replace with actual app URL if remote
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const proxies = JSON.parse(data).proxies;
        if (proxies.length > 0) activeProxy = proxies[0];
      } catch(e) {}
    });
  });
}, 10000);

const server = net.createServer((c) => {
  if (!activeProxy) {
    c.end();
    return;
  }
  const proxy = net.connect(activeProxy.port, activeProxy.ip, () => {
    c.pipe(proxy);
    proxy.pipe(c);
  });
  proxy.on('error', () => c.end());
  c.on('error', () => proxy.end());
});

server.listen(1080, '127.0.0.1', () => {
  console.log('Local SOCKS5 Fake Gateway running at 127.0.0.1:1080 !');
  console.log('Configure Opera to use SOCKS5 proxy at 127.0.0.1:1080');
});
`}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="px-4 md:px-8 py-4 bg-[#08080a] border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-slate-600 text-center md:text-left">
        <div>&copy; {new Date().getFullYear()} SOCKS-PRO NETWORK &bull; DECENTRALIZED DATA LAYER</div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          <span className="hover:text-slate-400 cursor-pointer hidden md:inline" onClick={() => setIsModalOpen(true)}>Add URL Source</span>
          <span className="hover:text-slate-400 cursor-pointer hidden md:inline">Global Latency Map</span>
          <span className="text-emerald-500 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
            Background Scanner Initialized
          </span>
        </div>
      </footer>
    </div>
  );
}
