"use client";

import * as React from "react";

import { CpuIcon, FlaskConicalIcon, KeyboardIcon, RadioTowerIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";

import { UpdateCard } from "./_components/update-card";

export default function SystemSettingsPage() {
  const [trafficCapture, setTrafficCapture] = React.useState(false);
  const [agentTrafficBinding, setAgentTrafficBinding] = React.useState(false);
  const [webSearch, setWebSearch] = React.useState(false);
  const [backend, setBackend] = React.useState("ddgs");
  const [braveKeySet, setBraveKeySet] = React.useState(false);
  const [braveKeyInput, setBraveKeyInput] = React.useState("");
  const [tavilyKeySet, setTavilyKeySet] = React.useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = React.useState("");
  const [savingTavilyKey, setSavingTavilyKey] = React.useState(false);
  const [proxyInput, setProxyInput] = React.useState("");
  const [savingProxy, setSavingProxy] = React.useState(false);
  const [globalProxyInput, setGlobalProxyInput] = React.useState("");
  const [savingGlobalProxy, setSavingGlobalProxy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [pyInterp, setPyInterp] = React.useState("");
  const [workers, setWorkers] = React.useState("3");
  const [savingWorkers, setSavingWorkers] = React.useState(false);
  // 操作约束注入范围(默认都开)。
  const [injectPlanner, setInjectPlanner] = React.useState(true);
  const [injectWorker, setInjectWorker] = React.useState(true);
  // 实验功能:noa 上下文压缩(默认关)。
  const [noaCompaction, setNoaCompaction] = React.useState(false);
  // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
  const sendMode = useChatSendMode();

  const apply = React.useCallback((s: Settings) => {
    setTrafficCapture(!!s.traffic_capture);
    setAgentTrafficBinding(!!s.agent_traffic_binding);
    setWebSearch(!!s.web_search_enabled);
    setBackend(s.web_search_backend || "ddgs");
    setBraveKeySet(!!s.brave_key_set);
    setTavilyKeySet(!!s.tavily_key_set);
    setProxyInput(s.web_search_proxy ?? "");
    setGlobalProxyInput(s.global_proxy ?? "");
    setPyInterp(s.python_interpreter ?? "");
    setWorkers(String(s.workers ?? 3));
    setInjectPlanner(s.constraints_inject_planner !== false);
    setInjectWorker(s.constraints_inject_worker !== false);
    setNoaCompaction(!!s.noa_compaction);
  }, []);

  const saveWorkers = () => {
    const n = Number(workers);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Concurrency must be an integer greater than 0");
      return;
    }
    setSavingWorkers(true);
    api
      .setSettings({ workers: n })
      .then((s) => {
        apply(s);
        toast.success("Saved worker agent concurrency (applies to tasks started afterwards)");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSavingWorkers(false));
  };

  const savePython = () => {
    setSaving(true);
    api
      .setSettings({ python_interpreter: pyInterp.trim() })
      .then((s) => {
        apply(s);
        toast.success("Saved Python interpreter config");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSaving(false));
  };
  const detectPython = () => {
    setSaving(true);
    api
      .detectPython()
      .then((r) => setPyInterp(r.python_interpreter))
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  React.useEffect(() => {
    api
      .settings()
      .then(apply)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [apply]);

  const toggleTraffic = (v: boolean) => {
    setTrafficCapture(v); // optimistic
    setSaving(true);
    api
      .setSettings({ traffic_capture: v })
      .then(apply)
      .catch(() => setTrafficCapture(!v)) // revert on failure
      .finally(() => setSaving(false));
  };

  const toggleInjectPlanner = (v: boolean) => {
    setInjectPlanner(v); // optimistic
    api
      .setSettings({ constraints_inject_planner: v })
      .then(apply)
      .catch(() => setInjectPlanner(!v)); // revert on failure
  };

  const toggleAgentTrafficBinding = (v: boolean) => {
    setAgentTrafficBinding(v);
    setSaving(true);
    api
      .setSettings({ agent_traffic_binding: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "Agent auto-bind traffic enabled" : "Agent auto-bind traffic disabled");
      })
      .catch((e) => {
        setAgentTrafficBinding(!v);
        toast.error(`Save failed: ${(e as Error).message}`);
      })
      .finally(() => setSaving(false));
  };

  const toggleInjectWorker = (v: boolean) => {
    setInjectWorker(v); // optimistic
    api
      .setSettings({ constraints_inject_worker: v })
      .then(apply)
      .catch(() => setInjectWorker(!v)); // revert on failure
  };

  const toggleNoaCompaction = (v: boolean) => {
    setNoaCompaction(v); // optimistic
    api
      .setSettings({ noa_compaction: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "noa context compaction enabled (applies to runs started afterwards)" : "noa context compaction disabled (built-in compaction restored)");
      })
      .catch((e) => {
        setNoaCompaction(!v); // revert on failure
        toast.error(`Save failed: ${(e as Error).message}`);
      });
  };

  // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
  const saveWebSearch = (patch: Partial<Settings>) => {
    setSaving(true);
    api
      .setSettings(patch)
      .then((s) => {
        apply(s);
        toast.success("Saved web search config");
      })
      .catch((e) => {
        toast.error("Save failed: " + (e as Error).message);
        api
          .settings()
          .then(apply)
          .catch(() => undefined);
      })
      .finally(() => setSaving(false));
  };

  const saveBraveKey = () => {
    setSavingKey(true);
    api
      .setSettings({ brave_search_api_key: braveKeyInput })
      .then((s) => {
        apply(s);
        setBraveKeyInput("");
        toast.success("Saved Brave API Key");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSavingKey(false));
  };

  const saveTavilyKey = () => {
    setSavingTavilyKey(true);
    api
      .setSettings({ tavily_search_api_key: tavilyKeyInput })
      .then((s) => {
        apply(s);
        setTavilyKeyInput("");
        toast.success("Saved Tavily API Key");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSavingTavilyKey(false));
  };

  const saveProxy = () => {
    setSavingProxy(true);
    api
      .setSettings({ web_search_proxy: proxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(proxyInput.trim() ? "Saved egress proxy" : "Cleared egress proxy (now direct)");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSavingProxy(false));
  };

  const saveGlobalProxy = () => {
    setSavingGlobalProxy(true);
    api
      .setSettings({ global_proxy: globalProxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(globalProxyInput.trim() ? "Saved global proxy" : "Cleared global proxy (now direct)");
      })
      .catch((e) => toast.error("Save failed: " + (e as Error).message))
      .finally(() => setSavingGlobalProxy(false));
  };

  // Run a real "test" search ("test") against the CURRENT form values (backend +
  // proxy + entered key), falling back to saved values server-side. Toasts result.
  const runTest = () => {
    setTesting(true);
    api
      .testWebSearch({
        web_search_backend: backend,
        web_search_proxy: proxyInput.trim(),
        brave_search_api_key: braveKeyInput,
        tavily_search_api_key: tavilyKeyInput,
      })
      .then((r) => {
        if (r.ok) toast.success(`Search test succeeded · ${r.backend} returned ${r.count} results`);
        else toast.error("Search test failed: " + (r.error || "unknown error"));
      })
      .catch((e) => toast.error("Search test failed: " + (e as Error).message))
      .finally(() => setTesting(false));
  };

  // brave-free selected but no key stored and none being entered → tool stays off.
  const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">System settings</h1>
        <p className="text-muted-foreground text-sm">Global runtime switches</p>
      </div>

      {/* 多列而非 grid：网络搜索卡片比其余高数倍，且高度随所选后端变化（brave/tavily
          的 key 输入是条件渲染）。grid 会按最高的一张撑满整行、在旁边留下大片空白，
          多列则自动按内容高度平衡填充。卡片间距靠 mb 而非 gap——多列布局下
          column-gap 只管列间距，行间距要由子元素自己给。 */}
      <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
        <UpdateCard />

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Traffic capture
            </CardTitle>
            <CardDescription>
              When enabled, all Agent HTTP traffic is fully stored via the recording proxy, and the traffic_search / traffic_get
              tools and proxy config are injected into Agents (the prompt includes proxy instructions).
              <br />
              When disabled (default) no traffic is recorded: Agents
              <b>do not</b> get the proxy config or traffic tools, and the prompt <b>does not include</b> any proxy content. Takes effect immediately by rebuilding Agents after switching.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="traffic-capture" className="text-sm font-normal text-muted-foreground">
              {trafficCapture ? "Enabled · recording traffic and injecting the proxy" : "Disabled · not recording, not injecting the proxy"}
            </Label>
            <Switch
              id="traffic-capture"
              checked={trafficCapture}
              disabled={!loaded || saving}
              onCheckedChange={toggleTraffic}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Agent auto-bind traffic
            </CardTitle>
            <CardDescription id="agent-traffic-binding-description">
              Off by default. When on, the report Agent triggered at finding intake checks existing HTTP requests/responses and links the matching traffic before writing the report.
              <b>Reading packets and the extra tool calls increase Token usage.</b>
              <br />
              TCP, no capture, or no matching traffic. Reporting still works normally. This switch does not affect traffic capture, manual binding, or viewing saved evidence. Takes effect on the next Agent
              round; when turned off, new automatic bindings are rejected immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="agent-traffic-binding" className="text-sm font-normal text-muted-foreground">
              {agentTrafficBinding ? "Enabled · increases Token usage" : "Disabled · manual binding still available"}
            </Label>
            <Switch
              id="agent-traffic-binding"
              aria-describedby="agent-traffic-binding-description"
              checked={agentTrafficBinding}
              disabled={!loaded || saving}
              onCheckedChange={toggleAgentTrafficBinding}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Global proxy
            </CardTitle>
            <CardDescription>
              The <b>target traffic</b> of all Agents goes out through this proxy (hides the source IP / uses a jump host). Supports <b>http / https / socks5</b>, optionally with{" "}
              <code>user:pass</code> authentication. Empty = direct.
              <br />
              When <b>traffic capture</b> is on, it acts as the <b>upstream</b> of the recording proxy (traffic is still fully stored, then goes out through this proxy); when capture is off, it is injected directly into
              the Agent's bash / WebFetch egress. Independent of the web search proxy and the LLM proxy.
              <br />
              <b>Note</b>: with <b>capture off</b>, socks5 relies on each CLI tool honoring <code>ALL_PROXY</code> (curl
              works, some tools may ignore it); if you mainly use socks5, enable traffic capture — on that path the MITM
              dials itself, so tools are unaware and it works reliably.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="global-proxy" className="text-sm font-normal text-muted-foreground">
              Proxy address
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="global-proxy"
                autoComplete="off"
                placeholder="socks5://user:pass@host:1080 or http://host:port (empty = direct)"
                value={globalProxyInput}
                disabled={!loaded || savingGlobalProxy}
                onChange={(e) => setGlobalProxyInput(e.target.value)}
              />
              <Button type="button" onClick={saveGlobalProxy} disabled={!loaded || savingGlobalProxy}>
                Save
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {globalProxyInput.trim() ? "Configured · all target traffic goes out through this proxy" : "Not configured · target traffic goes out directly"}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlertIcon className="size-4" />
              Operation constraint injection
            </CardTitle>
            <CardDescription>
              When on, each task's <b>operation constraints</b> (allow/deny entries maintained under "Operation constraints" in the task overview) are appended to the corresponding Agent's
              system prompt to frame the exploration boundary (e.g. "test the current port only", "no brute force").
              <br />
              Can be controlled separately for the <b>planner</b> and the <b>worker</b>
              ; both on by default. Switching takes effect immediately (read on the next round), no Agent rebuild needed. When off, that Agent no longer sees the constraints.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-planner" className="text-sm font-normal text-muted-foreground">
                Inject into planner{injectPlanner ? " · enabled" : " · disabled"}
              </Label>
              <Switch
                id="inject-planner"
                checked={injectPlanner}
                disabled={!loaded}
                onCheckedChange={toggleInjectPlanner}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-worker" className="text-sm font-normal text-muted-foreground">
                Inject into worker{injectWorker ? " · enabled" : " · disabled"}
              </Label>
              <Switch
                id="inject-worker"
                checked={injectWorker}
                disabled={!loaded}
                onCheckedChange={toggleInjectWorker}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConicalIcon className="size-4" />
              Experimental features
            </CardTitle>
            <CardDescription>
              Mechanisms still under validation, off by default. They may change Agent behavior or affect stability; enable only if you understand the impact.
              <br />
              <b>noa context compaction</b>: the model proactively compacts long conversation history (norma v0.4.0). When on, the four kinds of Agent the platform integrates (
              <b>planner / worker / main Agent / chat</b>) use noa to manage context instead of the built-in compaction,
              and the original text is archived under the task working directory for traceability. Takes effect immediately (for runs started afterwards), no Agent rebuild needed;
              when turned off, built-in compaction is restored immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="noa-compaction" className="text-sm font-normal text-muted-foreground">
              noa context compaction{noaCompaction ? " · enabled" : " · disabled"}
            </Label>
            <Switch
              id="noa-compaction"
              checked={noaCompaction}
              disabled={!loaded}
              onCheckedChange={toggleNoaCompaction}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="size-4" />
              Web search
            </CardTitle>
            <CardDescription>
              This is the <b>master switch + source config</b> for web search. Only when on can you choose, in <b>each Agent's config</b>, whether to enable
              <b>web_search</b> (returns titles/links/snippets only, no page body; fetching is done by WebFetch). Web search <b>does not go through</b> the
              recording proxy and is independent of traffic capture.
              <br />
              Sources: <b>DuckDuckGo (ddgs)</b> (no Key needed), <b>Brave (free tier)</b> (Brave API Key required),{" "}
              <b>Tavily</b> (Tavily API Key required) or <b>DeepSeek</b> (reuses the current LLM config). When the master switch is off, each
              Agent's web search switch is unavailable.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="web-search" className="text-sm font-normal text-muted-foreground">
                {webSearch ? "Master switch on · can be enabled per Agent in each Agent config" : "Disabled · Agents cannot enable web search"}
              </Label>
              <Switch
                id="web-search"
                checked={webSearch}
                disabled={!loaded || saving}
                onCheckedChange={(v) => {
                  setWebSearch(v); // optimistic
                  saveWebSearch({ web_search_enabled: v });
                }}
              />
            </div>

            {webSearch && (
              <div className="flex items-center justify-between gap-4">
                Search source
                <Select
                  value={backend}
                  disabled={!loaded || saving}
                  onValueChange={(v) => {
                    setBackend(v); // optimistic
                    saveWebSearch({ web_search_backend: v });
                  }}
                >
                  <SelectTrigger className="w-48 shrink-0">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ddgs">DuckDuckGo (ddgs · free, no Key)</SelectItem>
                    <SelectItem value="brave-free">Brave (free tier · Key required)</SelectItem>
                    <SelectItem value="tavily">Tavily (Key required)</SelectItem>
                    <SelectItem value="deepseek">DeepSeek (official)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {webSearch && backend === "deepseek" && (
              <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
                DeepSeek official web search
                <p className="text-muted-foreground text-xs leading-relaxed">
                  This source directly reuses the <b>currently active LLM config</b>. Therefore it
                  <b>only supports official DeepSeek models</b>, and that config <b>must use the anthropic protocol</b>
                  — DeepSeek's OpenAI-protocol endpoint does not support server-side search. This source may stop working after switching the LLM config.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Unlike other sources, the search is <b>executed server-side by DeepSeek</b>: each search consumes one extra model call (incurring Token
                  cost), the search request <b>does not go through the egress proxy above</b> and is <b>not recorded in traffic logs</b>; results contain <b>only titles and links</b>
                  (no snippets); WebFetch fetches the body when needed.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  You are responsible for confirming the conditions above are met; the system does not block it. Use the "Test search" button below to run one for real and verify.
                </p>
              </div>
            )}

            {webSearch && backend === "brave-free" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="brave-key" className="text-sm font-normal text-muted-foreground">
                  Brave Search API Key
                  {braveKeySet && <span className="ml-2 text-xs text-emerald-500">Configured</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brave-key"
                    type="password"
                    autoComplete="off"
                    placeholder={braveKeySet ? "Configured (leave empty to keep)" : "Enter Brave API Key"}
                    value={braveKeyInput}
                    disabled={!loaded || savingKey}
                    onChange={(e) => setBraveKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveBraveKey}
                    disabled={!loaded || savingKey || braveKeyInput.trim() === ""}
                  >
                    Save
                  </Button>
                </div>
                {braveNeedsKey && (
                  <p className="text-xs text-amber-500">
                    Brave is selected but no Key is configured yet — the search tool will not be enabled until a Key is saved.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  The free tier allows about 2,000 requests/month. Get a Key at https://brave.com/search/api/.
                </p>
              </div>
            )}

            {webSearch && backend === "tavily" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="tavily-key" className="text-sm font-normal text-muted-foreground">
                  Tavily Search API Key
                  {tavilyKeySet && <span className="ml-2 text-xs text-emerald-500">Configured</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tavily-key"
                    type="password"
                    autoComplete="off"
                    placeholder={tavilyKeySet ? "Configured (leave empty to keep)" : "Enter Tavily API Key (tvly-…)"}
                    value={tavilyKeyInput}
                    disabled={!loaded || savingTavilyKey}
                    onChange={(e) => setTavilyKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveTavilyKey}
                    disabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}
                  >
                    Save
                  </Button>
                </div>
                {webSearch && backend === "tavily" && !tavilyKeySet && (
                  <p className="text-xs text-amber-500">
                    Tavily is selected but no Key is configured yet — the search tool will not be enabled until a Key is saved.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">Sign up and get an API Key at https://tavily.com.</p>
              </div>
            )}

            {webSearch && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-proxy" className="text-sm font-normal text-muted-foreground">
                  Egress proxy (optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ws-proxy"
                    autoComplete="off"
                    placeholder="http://host:port or socks5://host:port (empty = direct)"
                    value={proxyInput}
                    disabled={!loaded || savingProxy}
                    onChange={(e) => setProxyInput(e.target.value)}
                  />
                  <Button type="button" onClick={saveProxy} disabled={!loaded || savingProxy}>
                    Save
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  A dedicated egress proxy, used only to reach the search endpoint (VPN/SOCKS etc.). Unrelated to the MITM proxy that records traffic; used when the network is unreachable directly.
                </p>
              </div>
            )}

            {webSearch && (
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  Actually run one search for "test" using the current config (source + proxy + Key) to verify it works.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runTest}
                  disabled={!loaded || testing}
                  className="shrink-0"
                >
                  {testing ? "Testing…" : "Test search"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Custom script · Python interpreter
            </CardTitle>
            <CardDescription>
              Custom <b>script</b>-type tools use this to run Python. Auto-detected at startup (python3 preferred); here you can enter the absolute path of a venv /
              specific version manually; leave empty to auto-detect at runtime.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-sm"
                placeholder="/usr/bin/python3 (empty = auto-detect)"
                value={pyInterp}
                disabled={!loaded || saving}
                onChange={(e) => setPyInterp(e.target.value)}
              />
              <Button variant="outline" onClick={detectPython} disabled={!loaded || saving}>
                Re-detect
              </Button>
              <Button onClick={savePython} disabled={!loaded || saving}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CpuIcon className="size-4" />
              Work concurrency · Work Agent count
            </CardTitle>
            <CardDescription>
              Number of worker agents running concurrently per task (default 3). Higher values mean more parallel probing and higher cost. After changing,
              <b>applies to tasks started afterwards</b>; running tasks are not affected.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-32 font-mono text-sm"
                placeholder="3"
                value={workers}
                disabled={!loaded || savingWorkers}
                onChange={(e) => setWorkers(e.target.value)}
              />
              <Button onClick={saveWorkers} disabled={!loaded || savingWorkers}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyboardIcon className="size-4" />
              Chat input send key
            </CardTitle>
            <CardDescription>
              The main Agent chat input on the chat page and task detail shares this setting; it takes effect immediately after selecting, no save needed.
              <br />
              This preference <b>is stored only in this browser</b>, is not synced with your account, and must be set again after switching browsers or clearing site data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="chat-send-mode" className="text-sm font-normal text-muted-foreground">
              Send mode
            </Label>
            <Select value={sendMode} onValueChange={(v) => setChatSendMode(v as ChatSendMode)}>
              <SelectTrigger id="chat-send-mode" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_SEND_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
