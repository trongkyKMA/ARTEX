// GENERATED FILE - display-only English translations of the built-in tool
// descriptions shown on System -> Tools.
//
// The real tool descriptions (stored in the `tools` table and sent to the LLM) stay
// in Chinese on purpose: the deployment uses Chinese-tuned models (DeepSeek / GLM)
// and the agent prompts are Chinese. These translations are ONLY rendered in the UI
// for English-speaking operators and are never sent to a model or saved.
//
// Each entry carries `h`, a hash of the Chinese built-in default text it translates.
// If an operator edits a description, the hash no longer matches and the UI falls
// back to the edited text (and marks the reference translation as outdated).

export type ToolTextTranslation = { h: string; text: string };
export type ToolTranslation = { h: string; description: string; params: Record<string, ToolTextTranslation> };

/** FNV-1a 32-bit hash over UTF-16 code units, hex. Must match the generator. */
export function textHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type DisplayTranslation = { text: string; matchesDefault: boolean };

/** English reference for a built-in tool description, or null when none exists. */
export function toolDescriptionEn(key: string, current: string): DisplayTranslation | null {
  const t = TOOL_TRANSLATIONS[key];
  if (!t) return null;
  return { text: t.description, matchesDefault: textHash(current) === t.h };
}

/** English reference for a parameter description. path = "name" or "parent.name". */
export function paramDescriptionEn(key: string, path: string, current: string): DisplayTranslation | null {
  const t = TOOL_TRANSLATIONS[key]?.params[path];
  if (!t) return null;
  return { text: t.text, matchesDefault: textHash(current) === t.h };
}

/**
 * Text to show for a tool description in lists/cards: the English translation while
 * the stored description is still the built-in default, otherwise the stored text.
 * Display only - always save/send the original description.
 */
export function displayToolDescription(tool: { key: string; system?: boolean; description: string }): string {
  if (tool.system === false) return tool.description;
  const tr = toolDescriptionEn(tool.key, tool.description);
  return tr?.matchesDefault ? tr.text : tool.description;
}

export const TOOL_TRANSLATIONS: Record<string, ToolTranslation> = {
  add_company_scope: {
    h: "f7e51827",
    description:
      "Add domains/IPs/CIDRs/ICP filings/company keywords to a company's [asset scope]. Domains, networks and ICP filings automatically claim matching assets; keywords are only provided to the Agent as scope hints.\nCompany names are unique: if `company` does not exist it is created, and if it already exists it is reused (the scope is merged into it).\n`scope` takes one entry per line; the system recognizes the type automatically: root domain / URL / single IP / CIDR block / ICP filing / company keyword.\nAlways give `reason` to state the basis for ownership (whois/certificate/ASN, etc.).\nGuardrails: bare TLDs and overly broad network blocks are rejected (IPv4 prefix must be /16-/32, IPv6 prefix must be /32-/128); invalid lines are skipped and returned in `errors`.",
    params: {
      logo: {
        h: "f6a80b97",
        text: "Company logo URL (optional; only takes effect when creating a new company)",
      },
      scope: {
        h: "c785aea1",
        text: "Asset scope, one entry per line: domain / URL / IP / CIDR / ICP filing / company keyword",
      },
      reason: {
        h: "78d99b38",
        text: "Basis for ownership (evidence/source); must be filled in",
      },
      company: {
        h: "f40faa61",
        text: "Company name (created if it does not exist, reused if it does; names are unique)",
      },
    },
  },
  add_hint: {
    h: "6bc5ff1f",
    description:
      "Attach a strategic hint from a human/the main agent to the exploration graph; the planner will read it the next time it generates intents.\n★ Prefer batching: put multiple hints into the `hints` array and submit them in one call (saves round trips compared with calling one by one). Returns an `ids` array of the same length and order as `hints` (a failed item has id=0; see `errors` for details). For a single hint, omit `hints` and give the top-level `text` directly.",
    params: {
      text: {
        h: "515fd818",
        text: "[Single] Hint content, e.g. 'focus on post-authentication endpoints'",
      },
      hints: {
        h: "6c1f6203",
        text: "[Prefer this] Array of hints to add, processed in order. Each element has the same fields as the top-level fields below (text/asset_ids/traffic_refs). The returned `ids` has the same length and order as this array.",
      },
      "hints.text": {
        h: "3fb334a5",
        text: "Hint content",
      },
      "hints.traffic_refs": {
        h: "5e7b142d",
        text: "Optional: verified traffic references that correspond to the specific finding in this hint, order preserved; after handoff, report_finding can pass `evidence_hint_id` to carry these references.",
      },
      asset_ids: {
        h: "75a07585",
        text: "Asset ids to anchor to (optional, 0/1/many)",
      },
      traffic_refs: {
        h: "5e7b142d",
        text: "Optional: verified traffic references that correspond to the specific finding in this hint, order preserved; after handoff, report_finding can pass `evidence_hint_id` to carry these references.",
      },
      "traffic_refs.note": {
        h: "0ac61a71",
        text: "What conclusion this traffic supports",
      },
      "traffic_refs.role": {
        h: "bf1512a3",
        text: "baseline / proof / verification / supporting",
      },
      "traffic_refs.traffic_id": {
        h: "2b1db581",
        text: "Real traffic ID",
      },
    },
  },
  add_intent: {
    h: "e859b551",
    description:
      "Generate [exploration directions], write them into the frontier, and connect them into the exploration chain. An intent is an open-ended exploration direction, not a fixed type: use `summary` to describe in one free-form sentence what to explore/verify/exploit.\n★ Prefer batching: put the multiple new directions screened out in one round into the `intents` array and submit them in one call (saves round trips compared with calling one by one). Returns an `ids` array of the same length and order as `intents` (a failed item has id=0; see `errors` for details). For a single direction, omit `intents` and give the top-level `summary` directly.",
    params: {
      intents: {
        h: "45501570",
        text: "[Prefer this] Array of exploration directions to add, processed in order. Each element has the same fields as the top-level fields below (summary/asset_ids/parent_ids/priority). The returned `ids` has the same length and order as this array.",
      },
      summary: {
        h: "dcc13384",
        text: "[Single] One sentence describing this exploration direction: what to do + why. It is enough to state the direction clearly; it does not depend on asset ids.",
      },
      priority: {
        h: "78888d57",
        text: "Priority 0-10, default 5",
      },
      asset_ids: {
        h: "73e6ed73",
        text: "[Target asset ids] this direction will test/attack (**pass them whenever possible**, 0/1/many; these are the asset ids returned by list_assets, not exploration node ids): which assets (sites/endpoints/parameters/hosts, etc.) this exploration direction targets. Whenever the direction revolves around specific assets, be sure to pass them; it is a structured marker of 'which targets this exploration hits', used for coverage deduplication and for connecting the intent into the asset chain. Leave empty only for purely global reconnaissance with no specific target asset.",
      },
      parent_ids: {
        h: "00daad1e",
        text: "Upstream anchor ids (optional, 0/1/many): which [confirmed facts (fact)/findings (finding)] this direction was derived from. **Only existing fact/finding node ids may be filled in; intents/goals/hints are not allowed**: an intent must be anchored on confirmed knowledge, finding-driven rather than planned out of thin air. If multiple facts jointly produce one new intent, pass multiple; for a brand-new top-level reconnaissance direction, leave empty (it is automatically attached to the task's starting origin fact).",
      },
    },
  },
  add_task_hint: {
    h: "611da33b",
    description:
      "Inject a strategic hint into a specified task (that task's planner will read it the next time it generates intents).\n★ Prefer batching: put multiple hints into the `hints` array and submit them in one call (returns an `ids` array of the same length and order as `hints`; a failed item has id=0). For a single hint, omit `hints` and give the top-level `text` directly.",
    params: {
      text: {
        h: "0814e249",
        text: "[Single] Hint content",
      },
      hints: {
        h: "0c53cb98",
        text: "[Prefer this] Array of hints; each element has the same fields as the top level (text/asset_ids/traffic_refs).",
      },
      "hints.text": {
        h: "3fb334a5",
        text: "Hint content",
      },
      "hints.traffic_refs": {
        h: "5e7b142d",
        text: "Optional: verified traffic references that correspond to the specific finding in this hint, order preserved; after handoff, report_finding can pass `evidence_hint_id` to carry these references.",
      },
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
      asset_ids: {
        h: "96037d2a",
        text: "Asset ids to anchor to (optional, 0/1/many; asset ids within that task)",
      },
      traffic_refs: {
        h: "5e7b142d",
        text: "Optional: verified traffic references that correspond to the specific finding in this hint, order preserved; after handoff, report_finding can pass `evidence_hint_id` to carry these references.",
      },
      "traffic_refs.note": {
        h: "0ac61a71",
        text: "What conclusion this traffic supports",
      },
      "traffic_refs.role": {
        h: "bf1512a3",
        text: "baseline / proof / verification / supporting",
      },
      "traffic_refs.traffic_id": {
        h: "2b1db581",
        text: "Real traffic ID",
      },
    },
  },
  add_task_scope: {
    h: "9a060e78",
    description:
      "Add test scope to [this task]. This is the task's authorization boundary and also the denominator for asset test coverage.\n`kind` supports: company (all assets under the whole company name) / root_domain (the whole root domain, including all subdomains) / subdomain (a single exact subdomain) / ip / cidr / icp / keyword.\nNote: hosts the worker encounters one by one are [automatically] added to the scope by the system (as exact subdomains); this tool is for [actively expanding]: bringing in a whole root domain/whole company, or adding a specified subdomain/IP.\n`value`: for company pass the company name or id (the company must already exist); for root_domain/subdomain pass the domain; for ip/cidr pass the IP or block; for icp/keyword pass the filing number or company keyword.\nAlways give `reason` stating the basis (auditable). For multiple entries use the `entries` array.",
    params: {
      kind: {
        h: "ecc39007",
        text: "[Single] company / root_domain / subdomain / ip / cidr / icp / keyword",
      },
      value: {
        h: "230d65d9",
        text: "[Single] Company name or id / domain / IP / CIDR / ICP filing / keyword",
      },
      reason: {
        h: "fd450b70",
        text: "Basis for adding (used for audit); must be filled in",
      },
      entries: {
        h: "bf113f76",
        text: "Batch: [{kind, value}]. kind is one of company/root_domain/subdomain/ip/cidr/icp/keyword.",
      },
    },
  },
  bind_finding_traffic: {
    h: "217faebe",
    description:
      "Additionally bind verified real HTTP traffic to an already registered finding. `finding_id` uses the standalone finding record ID; do not pass an exploration node ID. All references in the same batch succeed or fail together, and duplicate references do not overwrite existing notes. Additional binding marks existing reports as pending update; do not re-probe or create the finding again just to add packets.",
    params: {
      finding_id: {
        h: "adda6a00",
        text: "Standalone finding record ID, read from the finding_id field of list_task_findings / get_task_node_detail",
      },
      traffic_refs: {
        h: "5e7b142d",
        text: "Optional: verified traffic references that correspond to the specific finding in this hint, order preserved; after handoff, report_finding can pass `evidence_hint_id` to carry these references.",
      },
      "traffic_refs.note": {
        h: "0ac61a71",
        text: "What conclusion this traffic supports",
      },
      "traffic_refs.role": {
        h: "bf1512a3",
        text: "baseline / proof / verification / supporting",
      },
      "traffic_refs.traffic_id": {
        h: "2b1db581",
        text: "Real traffic ID",
      },
    },
  },
  create_custom_tool: {
    h: "079656cb",
    description:
      "[Important] When you install a tool the platform does not have, call this tool to put the installed tool into the platform so the platform can invoke it! Creates a custom tool (shell/command/script/http). shell = a bash environment declaration; it only needs key+description+agents, no exec/schema.",
    params: {
      key: {
        h: "d13fd6d2",
        text: "Tool key (starts with a lowercase letter; letters/digits/underscores)",
      },
      exec: {
        h: "a9196449",
        text: "Execution spec (not needed for the shell kind): command→{command}; script→{code}; http→{method,url,headers,body,proxy,use_recording_proxy}",
      },
      kind: {
        h: "5c2e7f61",
        text: "shell | command | script (Python only) | http. shell = a bash environment declaration (only tells the model the tool can be called directly in bash, no exec/schema needed); the other three require exec",
      },
      agents: {
        h: "9f37c967",
        text: "Bound agent keys (optional)",
      },
      schema: {
        h: "37998839",
        text: "Parameter JSON-Schema (may be left empty for shell/command/script; required for http and must contain properties)",
      },
      enabled: {
        h: "2977ed72",
        text: "Whether enabled (default true)",
      },
      deferred: {
        h: "4808fd3e",
        text: "Whether deferred (no effect for the shell kind; only turn on for rarely used command/script/http tools)",
      },
      description: {
        h: "c30132aa",
        text: "Description sent to the model",
      },
    },
  },
  create_mcp: {
    h: "455ceb0e",
    description:
      "Create an MCP server (stdio/http/sse). After creation, its tools must be authorized according to per-agent visibility.",
    params: {
      env: {
        h: "a81b4f5c",
        text: "Environment variables {KEY:VALUE}",
      },
      url: {
        h: "a1e286f6",
        text: "URL for http/sse",
      },
      args: {
        h: "69260732",
        text: "Command argument array",
      },
      name: {
        h: "886f62f0",
        text: "MCP server name",
      },
      command: {
        h: "2b371aa7",
        text: "Launch command for stdio (e.g. npx)",
      },
      enabled: {
        h: "2977ed72",
        text: "Whether enabled (default true)",
      },
      insecure: {
        h: "a7f9d553",
        text: "http: skip TLS certificate verification (set true for self-signed certificates; default false)",
      },
      transport: {
        h: "d4af5726",
        text: "stdio | http / sse",
      },
    },
  },
  create_skill: {
    h: "a7dd4d7e",
    description:
      "Create a new skill (writes SKILL.md, per the agentskills.io specification). `name` uses lowercase letters/digits/hyphens.",
    params: {
      name: {
        h: "61f1aa66",
        text: "Skill name (starts with a lowercase letter; letters/digits/hyphens)",
      },
      description: {
        h: "a3ee99b7",
        text: "Skill description (required; state what it does / when to use it)",
      },
      instructions: {
        h: "54ef0ecf",
        text: "Markdown body instructions (optional)",
      },
    },
  },
  delete_assets_by_host: {
    h: "9ced5182",
    description:
      "Delete assets by exact host: deletes that host's domain/subdomain, as well as the services (service) and endpoints (endpoint) under it.\n`host` is matched exactly (lowercased, whitespace trimmed); it is not fuzzy/wildcard.\nPassing a root domain (e.g. example.com) also deletes its subdomains and their services/endpoints; passing a subdomain (e.g. a.example.com) or an IP deletes only that host itself and its services/endpoints.\n⚠️ Hard delete, acts on the global asset library (shared across tasks), irreversible.",
    params: {
      host: {
        h: "da0278b6",
        text: "Host to delete: domain/subdomain/IP. Exact match, e.g. example.com or a.example.com or 1.2.3.4",
      },
    },
  },
  expand_digest: {
    h: "79e8bf85",
    description:
      "Expand a cold digest: returns the compact list of the members it folded (id/summary/state/confidence), in the same shape as recent_facts/recent_done_intents in the overview. For the full details/evidence of a single member, use node_detail(member_id).",
    params: {
      id: {
        h: "2d311be7",
        text: "Digest node id (from cold_digests in the overview)",
      },
    },
  },
  get_finding_retest_context: {
    h: "069dd5ed",
    description:
      "Read the finding evidence snapshot associated with the current retest session, the retest status, supplementary notes, and the current task constraints. No parameters; it can only read this session.",
    params: {},
  },
  get_finding_traffic: {
    h: "3f9af702",
    description:
      "Read the real traffic evidence already bound to a finding, independent of the capture switch. `finding_id` uses the standalone finding record ID returned by the report_finding JSON (not the exploration node ID on the first line). First call without binding_id to get the list and the version; an empty list is normal: for non-HTTP findings such as TCP, or when nothing was collected, the report can still be written from text/command evidence, and binding is not mandatory. When bindings exist, read the body in segments by binding_id, side (request/response) and offset. When writing the report, pass the version you read as evidence_version to update_finding_report; for that tool, finding_id still uses the exploration node ID.",
    params: {
      side: {
        h: "f5b417cc",
        text: "request or response, default response",
      },
      binding_id: {
        h: "4833b93c",
        text: "Binding ID from the list; omit to return the list",
      },
      finding_id: {
        h: "b8ee9f53",
        text: "Standalone finding record ID",
      },
    },
  },
  get_task_graph: {
    h: "6a7167a3",
    description:
      "Read the exploration graph overview of a specified task (same as graph_overview: asset counts/frontier/findings/coverage, etc.), using task_id to specify the task.",
    params: {
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
    },
  },
  get_task_node_detail: {
    h: "9464983f",
    description:
      "Read the full content of an exploration graph node in a specified task (finding/fact/intent/goal: summary + details/evidence/PoC). `id` is the exploration node id (e.g. returned by report_finding, or the id in list_task_findings). Use it to get the finding's full evidence before writing a finding report.",
    params: {
      id: {
        h: "74a2f082",
        text: "Exploration graph node id (not an asset id)",
      },
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
    },
  },
  get_task_worker_trace: {
    h: "70c12a34",
    description:
      "View the execution process of a work (intent) in a specified task: get_task_worker_trace(task_id, intent_id) shows the step summaries; then pass step_ids=[...] to get the full content of those steps (at most 5 at a time; if more are passed, only the first 5 are returned).",
    params: {
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
      step_ids: {
        h: "43b872dd",
        text: "Optional: step ids whose full content is wanted (at most 5 at a time; if more are passed, only the first 5 are returned and the rest are listed in omitted_step_ids)",
      },
      intent_id: {
        h: "a711ae36",
        text: "Intent id (the work in that task)",
      },
    },
  },
  get_worker_output: {
    h: "9beadd53",
    description:
      "Get the final output conclusion of an intent (work) in this task or a directly linked task. Linked-task results carry source_task_id/inherited=true and are read-only. A work that ended normally returns its summary; a work that was terminated (stopped) or ended abnormally returns its last output up to the point it was aborted.",
    params: {
      intent_id: {
        h: "e312251f",
        text: "Intent id (= work handle)",
      },
    },
  },
  get_worker_trace: {
    h: "575c0544",
    description:
      "View the [execution process] of an intent (work) (as opposed to get_worker_output, which only gives the final conclusion). Three usages:\n① Pass only intent_id → returns a stream of summaries for every step of that work (summary ≤100 characters, including step_id; just an outline of the actions, not the full output);\n② intent_id + q → returns only the step summaries matching the keyword (searches both the summaries and the full output; still gives only summaries, use ③ to see content);\n③ intent_id + step_ids → returns the full content (detail) of those steps; at most 5 at a time, beyond that only the first 5 are returned and the ones not fetched are reported in notice/omitted_step_ids.\nTypical flow: first use ①/② to locate the step_id of a suspicious step, then use ③ to get its full output. Does not include thinking steps. Supports the history trace of directly linked tasks; its results carry source_task_id/inherited=true and are read-only.",
    params: {
      q: {
        h: "d0cf407c",
        text: "Keyword: only return steps whose summary/full output matches it (optional; mutually exclusive with step_ids)",
      },
      limit: {
        h: "fafba713",
        text: "Cap on the summary stream/search results returned (optional)",
      },
      step_ids: {
        h: "11511d99",
        text: "step_ids whose full content is wanted (from ①/②; at most 5 at a time, if more are passed only the first 5 are returned and the rest are listed in omitted_step_ids)",
      },
      intent_id: {
        h: "e312251f",
        text: "Intent id (= work handle)",
      },
    },
  },
  goal_met: {
    h: "2ddbf599",
    description:
      "[Immediately ends the entire task]. Call it only when you have confirmed that [all of the task's goals have truly been achieved and the whole task is wrapping up] (note: this means the [whole] task is complete; merely achieving one of the goals / one flag / one finding does [not] count; in that case use prove_goal to mark that goal). ⚠️ It is not for 'ending this round of planning': if this round has no new intents to dispatch, or you are waiting for worker output, [simply end this round and do not call this tool] (0 intents is completely normal). Normally prefer prove_goal to prove goals one by one; goal_met is just a way to bypass proving them one by one and close out globally.",
    params: {
      reason: {
        h: "d1ec26d3",
        text: "Reason for achievement (must be evidence that the goals were truly achieved, not a reason like 'no new directions this round' that merely ends the round)",
      },
    },
  },
  graph_overview: {
    h: "39284876",
    description:
      "(Exploration chain graph) Distilled summary of the exploration state: asset counts, sites without endpoints, frontier, findings, hints (strategic hints from humans/the main agent, which must be incorporated when generating intents). Call it first when planning.",
    params: {},
  },
  insert_assets: {
    h: "ed7384c4",
    description:
      "Register newly discovered assets in batch; one call may mix multiple types (see the enum for type).\nRequired fields per type: root_domain→domain; ip→ip (must be IPv4/IPv6, not a hostname); subdomain→domain; app→app_name; service(HTTP)→url; service(non-HTTP)→service_name+port (at least one of ip/domain); endpoint→url+method. See each field's own description for the meaning of the rest.\nauth/technologies/params are append-merged and do not overwrite existing values.\nReturns: {results:[{index,id,type}], errors:[{index,error}]}",
    params: {
      assets: {
        h: "226aa42e",
        text: "Array of assets, each element corresponding to one asset record",
      },
      "assets.ip": {
        h: "a48902bc",
        text: "IP address; must be an IPv4/IPv6 address, not a hostname (for hostnames use the domain field with type=subdomain); required for the ip type; optional for service/endpoint types, used to associate the IP",
      },
      "assets.icp": {
        h: "9d5b2ca4",
        text: "ICP filing number (optional)",
      },
      "assets.url": {
        h: "9b621a6a",
        text: "Full URL including protocol and port (required for HTTP services; service_type is automatically set to http)",
      },
      "assets.auth": {
        h: "ec21e690",
        text: "List of discovered authentication information, each with fields such as type/username/password (optional, appended, not overwritten)",
      },
      "assets.port": {
        h: "e5d109cc",
        text: "Port number (required when service is non-HTTP)",
      },
      "assets.type": {
        h: "d0c1eeaa",
        text: "Asset type",
      },
      "assets.domain": {
        h: "e2fa6b59",
        text: "Root domain or subdomain (required for root_domain/subdomain)",
      },
      "assets.method": {
        h: "49e176c0",
        text: "HTTP method: GET/POST/PUT/PATCH/DELETE, etc. (required for endpoint)",
      },
      "assets.params": {
        h: "76b5c497",
        text: "List of request parameters, each with location(query/body/header/path)/name/value/type (optional, appended, not overwritten)",
      },
      "assets.app_icp": {
        h: "13039a97",
        text: "App ICP filing (optional)",
      },
      "assets.app_name": {
        h: "7463519e",
        text: "App name (required for the app type)",
      },
      "assets.category": {
        h: "a71e43bd",
        text: "App category (optional)",
      },
      "assets.bundle_id": {
        h: "1fd21314",
        text: "Bundle ID (optional for the app type)",
      },
      "assets.company_id": {
        h: "28399544",
        text: "Owning company id (optional for the app type; apps cannot be attributed automatically via scope, so specify it explicitly. The id is returned by add_company_scope)",
      },
      "assets.open_ports": {
        h: "78144daa",
        text: "List of open ports (optional for the ip type)",
      },
      "assets.page_title": {
        h: "c9573263",
        text: "Page <title> content (optional)",
      },
      "assets.description": {
        h: "a23fb969",
        text: "App description (optional)",
      },
      "assets.record_type": {
        h: "c7e78fba",
        text: "DNS record type: A/AAAA/CNAME/MX, etc. (optional for subdomain)",
      },
      "assets.status_code": {
        h: "b6d20055",
        text: "HTTP response status code, such as 200/301/403/404 (optional)",
      },
      "assets.favicon_mmh3": {
        h: "b9f01655",
        text: "Favicon MMH3 hash (optional)",
      },
      "assets.record_value": {
        h: "0112c16b",
        text: 'List of DNS record values (optional for subdomain, e.g. ["1.2.3.4","2.3.4.5"])',
      },
      "assets.service_name": {
        h: "5b118db7",
        text: "Service name, such as ssh/mysql/redis (required when service is non-HTTP)",
      },
      "assets.technologies": {
        h: "62924fab",
        text: 'List of fingerprints/tech stack, such as ["Nginx","Vue","Bootstrap"] (optional)',
      },
      "assets.bound_domains": {
        h: "683c4c11",
        text: "List of domains bound to this IP (optional for the ip type)",
      },
      "assets.content_length": {
        h: "3e30433d",
        text: "HTTP response body size in bytes (optional)",
      },
    },
  },
  kill_work: {
    h: "ec454e1b",
    description:
      "Terminate a running intent (work). Used to stop explorations that have gone off track/are pointless; a terminated intent is marked stopped and is no longer automatically re-claimed. First use get_worker_output to see what it is doing before deciding.",
    params: {
      intent_id: {
        h: "a3b20c2c",
        text: "Id of the intent to terminate (= work handle)",
      },
    },
  },
  list_assets: {
    h: "84e22b3d",
    description:
      "Query the asset library: DSL expression search, or direct fetch by id/ids; supports pagination. Only returns assets within the test scope of [this task and directly linked tasks].\nDSL: field=value fuzzy (ILIKE) | field==value exact | field!=value exclude | numeric fields support > >= < <= | a bare word = full-text fuzzy; combine with AND/OR (AND has higher precedence), parentheses may be used for grouping. The asset type uses the separate type parameter and is not written into the DSL.\nWhen id/ids are not passed, dsl must be non-empty (unconditional full queries are not allowed).\nAvailable fields: domain (root/sub/service domain), root_domain, ip, url, page_title, icp, service_name, app_name, method (e.g. GET/POST), service_type (http|other), record_type (e.g. A/CNAME), technology (array, = fuzzy, == exact), port/status_code/company_id (integers).\nExamples: status_code>=400 AND technology=shiro ; (port==80 OR port==443) AND technology=nginx",
    params: {
      id: {
        h: "378ce4c4",
        text: "Fetch directly by a single asset id (optional, mutually exclusive with dsl/type)",
      },
      dsl: {
        h: "eaff5316",
        text: "DSL query expression (see the tool description for syntax/fields). Must be non-empty when id/ids are not passed.",
      },
      ids: {
        h: "774ce735",
        text: "Fetch directly by multiple asset ids (optional, mutually exclusive with dsl/type)",
      },
      type: {
        h: "ec5f1e08",
        text: "Asset type filter: root_domain|ip|subdomain|app|service|endpoint (a separate field that can be combined with dsl; type alone is not enough to query, dsl is still required)",
      },
      limit: {
        h: "2f273723",
        text: "Maximum number returned, default 10 (optional)",
      },
      offset: {
        h: "cc82ee3d",
        text: "Pagination offset, default 0 (optional)",
      },
    },
  },
  list_companies: {
    h: "17d38713",
    description:
      "List the [companies] in the asset library together with their asset scope (scope) and the number of assets attributed to them. Used to see which companies exist and to get company_id (used when insert_assets associates an app, and when list_assets filters by company_id). Optional `search` fuzzy-filters by company name (case-insensitive); leave empty to return all.",
    params: {
      search: {
        h: "53db019a",
        text: "Fuzzy filter by company name (optional, case-insensitive); leave empty to return all",
      },
    },
  },
  list_facts: {
    h: "cd683735",
    description:
      "List, with pagination, the [exploration facts/conclusions] of this task and directly linked tasks, newest first (compact: id + summary + state; overly long summaries are truncated, use node_detail(id) for the full text). All parameters are optional: limit (default 20, max 100), before (cursor; pass the next_before returned by the previous page to get an older page; omitted/0 = the latest page), q (filter by summary keyword). Returns {facts, total, has_more, next_before}: total is the total after filtering, and when has_more=true use next_before to continue paging. Linked-task entries carry source_task_id/inherited=true and are read-only. For findings, see list_findings.",
    params: {
      q: {
        h: "637bc04e",
        text: "Filter by fact summary keyword (case-insensitive); omitted = no filtering",
      },
      limit: {
        h: "4637780d",
        text: "Number of entries returned, default 20, max 100",
      },
      before: {
        h: "2a69779b",
        text: "Pagination cursor: only return older facts with id less than this value; omitted or 0 = the latest page",
      },
    },
  },
  list_findings: {
    h: "d611f139",
    description:
      "List the [confirmed findings] of this task and directly linked tasks (compact: id+task_id+intent_id+vulnclass+severity+summary+state). Linked-task entries carry source_task_id/inherited=true and are read-only. This contains findings only; for ordinary exploration facts use list_facts, and for details use node_detail(id).",
    params: {},
  },
  list_goals: {
    h: "361911d7",
    description:
      "List this task's goal nodes and their status (open/met), used to judge whether goals have been achieved.",
    params: {},
  },
  list_llm_profiles: {
    h: "5d7ae932",
    description:
      "List the available LLM profiles: id, name, model, format, and whether it is the currently active profile. Use the id as the llm_profile_id parameter of spawn_task to assign a dedicated LLM to a subtask (e.g. a cheap model for recon, a strong model for exploitation). Does not include API keys.",
    params: {},
  },
  list_task_findings: {
    h: "a9f9ccfe",
    description:
      "Read the confirmed findings of a given task (including flag/PoC; each entry carries id/task_id/intent_id/vulnclass/severity/summary/status). Specify the task with task_id.",
    params: {
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
    },
  },
  list_task_worker_traces: {
    h: "b0021f54",
    description:
      "List which works (intents) have run in the given task and their step counts, used to find which works are worth looking into (then use get_task_worker_trace).",
    params: {
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
    },
  },
  list_tasks: {
    h: "40090271",
    description:
      "List all tasks (id/description/goal/status/runtime duration/parent task/LLM profile). The orchestration agent uses it to keep track of the big picture, see which tasks have been stuck for too long, and which LLM each uses. Runtime duration: for running tasks = creation to now; for terminal-state tasks = creation to last activity (seconds). llm_profile: the profile name used by the task's planner/worker; (active profile) = follows the global active profile.",
    params: {},
  },
  list_untested_assets: {
    h: "a1609fb3",
    description:
      "Query the assets within [this task and its directly linked tasks] that are not yet covered by any fact anchor (the linked scope is read-only, provided for you to decide for yourself whether to fill in the testing; it does not decide for you).\nOptionally filter by asset type: root_domain/subdomain/service/app/endpoint/ip.\nPagination: page starts at 1, page_size defaults to 10. Returns {assets:[{id,type,label}], total, page, page_size}. Only available in task context.",
    params: {
      page: {
        h: "5daaec9d",
        text: "Page number, starting at 1 (default 1)",
      },
      type: {
        h: "e304576c",
        text: "Asset type filter (optional): root_domain/subdomain/service/app/endpoint/ip",
      },
      page_size: {
        h: "81317020",
        text: "Items per page (default 10)",
      },
    },
  },
  node_detail: {
    h: "ea86d9f2",
    description:
      "Get the full content of an [exploration graph node] of this task or a directly linked task by id. Inherited nodes carry source_task_id/inherited=true and are read-only. Limited to exploration node ids returned by list_facts/list_findings/graph_overview; for assets use list_assets/asset_neighbors.",
    params: {
      id: {
        h: "74a2f082",
        text: "Exploration graph node id (not an asset id)",
      },
    },
  },
  pause_task: {
    h: "4f7908ab",
    description: "Pause the given task (stop its planner/worker loop).",
    params: {
      task_id: {
        h: "f88e49d7",
        text: "Id of the task to pause",
      },
    },
  },
  prove_goal: {
    h: "4d6d800d",
    description:
      "Call this when you judge that a finding/fact proves a goal has been achieved: links the evidence node to the goal node and marks the goal met.",
    params: {
      reason: {
        h: "e796be8f",
        text: "Why this evidence satisfies the goal",
      },
      goal_id: {
        h: "8c7dc2d4",
        text: "Goal node id",
      },
      evidence_id: {
        h: "4c2cc1de",
        text: "Id of the finding/fact node that proves it",
      },
    },
  },
  record_fact: {
    h: "e438649c",
    description:
      "Write an exploration [fact/conclusion] into the exploration graph, linked to the intent that produced it (intent_id). Used to record exploration results, including [positive conclusions] such as fingerprinting/enumeration, and [negative conclusions] such as 'port closed'/'parameter not injectable'/'no login entry found'.\n⚠️ Combine the multiple observations of one exploration into [a single fact]; do not split them into several. Anything that can be merged into one fact should be expressed as one fact: summary = a one-sentence summary of this conclusion, detail = the relevant details (may contain multiple specific items). Example: a fingerprinting intent -> one fact {summary:'Identified the tech stack and response characteristics of site X', detail:'nginx 1.25 / Vue3 / 200 / title=.. / body_len=..'}, instead of recording status code, fingerprint, and title as separate facts. One intent usually produces just one fact; splitting too finely makes the graph bloat endlessly.\n★ The facts array is for writing several [mutually distinct] conclusions at once (each may omit intent_id, defaulting to the top-level intent_id). Returns an ids array, the same length and order as facts.\n⚠️ Only write conclusions you [actually saw] in tool output; do not make things up. evidence and confidence are used to keep inaccurate conclusions from polluting the graph:\n  · evidence = [one line] of key evidence supporting this conclusion (the command + the one or two lines of output that best prove it); **keep it concise** - the details are already in detail, so do not paste large blocks of output here.\n  · confidence = observed (seen directly in the output) | inferred (deduced from observed behavior).\n  · **Negative conclusions** (not injectable/port closed/no entry found, etc.) should only state \"observation + tentative reading\" - state what you actually saw; whether to abandon the direction is decided by the planner based on the whole picture; always provide evidence, and if the approaches were not exhausted or the evidence is weak (including probing only once, or merely 'looks like'), mark it inferred; mark it observed only if truly exhausted and seen directly.",
    params: {
      facts: {
        h: "f90f9b6d",
        text: "[Use when there are multiple distinct conclusions] An array of facts, whose element fields are the same as the top-level fields below (summary/detail/evidence/confidence/intent_id/asset_ids); if intent_id is omitted, the top-level intent_id is used. The returned ids have the same length and order as this array.",
      },
      detail: {
        h: "4b645b89",
        text: "Relevant details of this fact: write the multiple observed facts of this exploration here",
      },
      summary: {
        h: "ed742cca",
        text: "A [one-sentence summary] of this exploration's conclusion (a summary of detail)",
      },
      evidence: {
        h: "7af2e15b",
        text: "[One line] of key evidence: the command + the one or two lines of output that best prove the conclusion. Keep it concise; do not paste large blocks of output (put details in detail).",
      },
      asset_ids: {
        h: "dd43d7d7",
        text: "Related asset ids (optional, 0/1/many): which assets this fact involves",
      },
      intent_id: {
        h: "dd6af728",
        text: "Id of the intent that produced this fact (the intent you were assigned; used as the default for each item in a batch)",
      },
      confidence: {
        h: "3a23a023",
        text: "observed (seen directly in the output) | inferred (deduced from observed behavior). Negative conclusions must be labeled truthfully.",
      },
    },
  },
  record_finding_retest_result: {
    h: "34e47f27",
    description:
      "Save the sole conclusion for the current retest session; the original finding's evidence and report remain unchanged. When the session ends successfully and the conclusion is fixed, the system automatically changes the finding's status to fixed; for other conclusions the original status is kept. You must provide the evidence actually checked this time; if it cannot be confirmed, state the blocking reason.",
    params: {
      summary: {
        h: "01e11ffc",
        text: "Summary of this retest's conclusion",
      },
      evidence: {
        h: "82ec75ca",
        text: "Markdown: the steps actually performed this time, observations, comparisons, and the basis for the conclusion; if it cannot be confirmed, list what was checked and the blocking reason.",
      },
    },
  },
  report_finding: {
    h: "c4d4c7e9",
    description:
      "Record a confirmed finding, using evidence to provide verifiable proof such as command output and logs. In task context, pass the current intent_id. The returned finding_id is the ID of the standalone finding record, and finding_node_id is the exploration node ID (keep that node number on the first line).",
    params: {
      name: {
        h: "70b4dfe5",
        text: "Finding name",
      },
      summary: {
        h: "a25783ef",
        text: "Summary of the finding",
      },
      evidence: {
        h: "c9f771ea",
        text: "Evidence/PoC text",
      },
      severity: {
        h: "3bc61791",
        text: "critical|high|medium|low",
      },
      asset_ids: {
        h: "ddb7e2a6",
        text: "Affected asset ids",
      },
      intent_id: {
        h: "6f11c21b",
        text: "The current task's intent id",
      },
      vulnclass: {
        h: "59a8585e",
        text: "Finding class",
      },
      traffic_refs: {
        h: "51f44e85",
        text: "Optional; for HTTP/HTTPS findings, first search and verify one by one that the requests/responses really support the finding's conclusion, then fill in the real IDs in reproduction order. For non-HTTP findings such as TCP, or when traffic was not captured or no exact record can be found, omit it or pass []; this does not block reporting; you may explain the reason in evidence and provide other verifiable evidence. Do not guess IDs, infer associations by domain/time, or re-probe merely to fill in packets. Purposes: baseline = normal control / proof = proof of the finding / verification = supplementary verification / supporting = auxiliary evidence.",
      },
      "traffic_refs.note": {
        h: "e521c2d1",
        text: "How this traffic supports the finding's conclusion",
      },
      "traffic_refs.traffic_id": {
        h: "ed999369",
        text: "A real traffic ID returned by traffic_search",
      },
      evidence_hint_id: {
        h: "ec0a3376",
        text: "Optional: the hint node ID in this task that corresponds to this finding; automatically carries its structured traffic_refs; cannot reference inherited hints or hints for other findings.",
      },
    },
  },
  search_all_worker_traces: {
    h: "57aeb789",
    description:
      "[Generally not recommended, since the system has already provided most of the information] Search by keyword (q) within [the execution traces of other works in this task] - used to recover something a worker saw but did not write into a fact (a path/token/error message, etc.). Steps of your own intent are automatically excluded (they are already in your context). Returns only summaries of matching steps (summary <=100 characters), each with an intent_id; then use get_worker_trace(intent_id, step_ids=[...]) to get the full content.",
    params: {
      q: {
        h: "348f0ee0",
        text: "Keyword (searched in the summaries + full output of all work steps)",
      },
      limit: {
        h: "f8b8acdb",
        text: "Maximum number returned, default 100 (optional)",
      },
    },
  },
  search_task_worker_traces: {
    h: "684159a2",
    description:
      "Search by keyword all works' execution traces in the given task (returns summaries of matching steps + intent_id).",
    params: {
      q: {
        h: "4ba5f98f",
        text: "Search keyword",
      },
      task_id: {
        h: "1cb44a9e",
        text: "Task id",
      },
    },
  },
  set_constraints: {
    h: "4a29e31d",
    description:
      "Add operational constraints to [this task] to frame the exploration boundary: type = allow (operations that are permitted) or deny (operations that are forbidden).\nA constraint = a rule about 'which operations may / may not be done' (e.g. 'test only the current port, do not scan other ports', 'no write operations on the production database', 'passive recon only'); it is neither a goal nor an attack step.\n★ Prefer batching: put multiple items into the constraints array and submit once; the returned ids have the same length and order (failed items get id=0, with details in errors). For a single item, omit constraints and give the top-level text/type directly.\nOnly register constraints that are [explicitly written] in the task goal/description; do not invent any; if unsure of the type, use deny (more conservative).",
    params: {
      text: {
        h: "4a18faa2",
        text: "[Single] The content of one operational constraint",
      },
      type: {
        h: "d89c00cf",
        text: "[Single] allow (permitted) or deny (forbidden); defaults to deny if omitted",
      },
      constraints: {
        h: "fc618ff2",
        text: "[Prefer this] The array of constraints to add, processed in order. Each element: text (required, one constraint) + type (allow|deny). The returned ids have the same length and order as this array.",
      },
    },
  },
  set_goals: {
    h: "dc00f6e6",
    description:
      "Add exploration goals to [this task]. A goal = a final deliverable/verifiable result, not an attack step or a recon action.\n★ Prefer batching: put multiple goals into the goals array and submit once; the returned ids have the same length and order (failed items get id=0, with details in errors). For a single item, omit goals and give the top-level text directly.\nvulnclass is optional: the corresponding finding class (e.g. SQLi/IDOR); leave it empty for business-logic goals. Whether a goal is achieved is determined by the system, which marks it met; this tool only adds goals.",
    params: {
      text: {
        h: "1dbbd603",
        text: "[Single] One independently verifiable final goal",
      },
      goals: {
        h: "ad074bf6",
        text: "[Prefer this] The array of goals to add, processed in order. Each element: text (required, one independently verifiable final goal) + vulnclass (optional). The returned ids have the same length and order as this array.",
      },
      vulnclass: {
        h: "b71a3ba5",
        text: "[Single] The corresponding finding class (if clear), e.g. SQLi/IDOR; may be left empty for business-logic goals",
      },
    },
  },
  spawn_task: {
    h: "dd72a2b8",
    description:
      "Create a new subtask and start the exploration engine; returns task_id. Used to dispatch one matter (e.g. one challenge/one goal) as an independent task. parent_ref is optional: fill in the parent task id that the current orchestration is associated with to link parent and child.",
    params: {
      goal: {
        h: "fef46302",
        text: "Task goal (what to achieve)",
      },
      parent_ref: {
        h: "af9772c4",
        text: "Optional: parent task id (to link parent and child)",
      },
      description: {
        h: "1b1f4b95",
        text: "Task description (short title)",
      },
      llm_profile_id: {
        h: "90195d62",
        text: "Optional: the id of the LLM profile for this subtask's planner/worker (see list_llm_profiles); if empty, inherits from the parent task, then falls back to the global active profile",
      },
      source_task_ids: {
        h: "c962390e",
        text: "Optional: list of source task ids to inherit from read-only (at most 8). The subtask may reference the assets/conclusions already established by these tasks as a starting point, read-only; unlike parent_ref, which is a pure parent-child pointer, this is content inheritance.",
      },
      timeout_seconds: {
        h: "92b4e3f7",
        text: "Optional: task-level timeout (seconds). When it expires, a graceful wrap-up is triggered and the task enters the timeout terminal state; empty or 0 = no time limit",
      },
      seed_first_intent: {
        h: "3efd97fe",
        text: "Optional: can be enabled for simple tasks; on creation a seed intent (content = description + goal) is issued directly so the worker starts testing without waiting for the first planner round; default false (follows the standard plan-then-execute flow).",
      },
      plan_heartbeat_seconds: {
        h: "bbd61655",
        text: "Optional: planner heartbeat trigger interval (seconds). When this many seconds have passed since the last planning round ended / the task started with no trigger in between -> a planning round is triggered (fallback against deadlock + wakes the planner to supervise in-flight workers). Empty or 0 = default 600 (10 min);",
      },
    },
  },
  steer_work: {
    h: "212e32ef",
    description:
      "Inject a real-time corrective instruction into a running intent (work), without interrupting it or losing existing progress: the worker receives your instruction before its next action and adjusts accordingly. Used for [within-intent] corrections like 'stop going down X, focus on Y'; if the direction is entirely wrong, use kill_work and then issue a new intent instead. It is recommended to first use get_worker_output to see what it is doing.",
    params: {
      message: {
        h: "402e3b46",
        text: "Corrective instruction for the worker, clearly telling it what to stop and what to turn to",
      },
      intent_id: {
        h: "fbab8779",
        text: "Id of the intent to steer (= the work handle)",
      },
    },
  },
  traffic_blob: {
    h: "22d964df",
    description:
      "Read the raw content of oversized request/response bodies in segments. The parts shown in traffic_get as '…[truncated] @blob sha256:<hash>' are stored here; pass that hash in to get the full content. Returns at most 8KB per call; use offset to continue reading further (the result gives the total length). Suitable for browsing backup files, source code leaks, large JSON exports, and other responses exceeding the inline threshold.",
    params: {
      hash: {
        h: "4aab25f4",
        text: "The 64-character hex value after @blob sha256: in traffic_get",
      },
      length: {
        h: "2c33ad6d",
        text: "Number of bytes to read this time, default and maximum 8192",
      },
      offset: {
        h: "8d9558c0",
        text: "Starting byte offset, default 0",
      },
    },
  },
  traffic_get: {
    h: "3cec8469",
    description:
      "Get the raw request/response of a captured traffic entry by id (truncated if too large). Use together with traffic_search to avoid repeated curl.",
    params: {
      id: {
        h: "c11d772a",
        text: "The id returned by traffic_search",
      },
    },
  },
  traffic_search: {
    h: "204a2a93",
    description:
      "Query the target traffic captured by the recording proxy (host must be specified; bare host, host:port, or a full URL are supported; can be further filtered by URL substring or body keyword). When a port is specified, only that service's traffic is returned, avoiding mix-ups between different ports on the same IP. body_contains does a full-text search over the captured request/response headers and bodies, supports arbitrary substrings and Chinese (at least 3 characters). Returns only a very lightweight index (id/method/url/status/resp_len), without response content; once results are non-empty, you must verify the request/response one by one with traffic_get, then hand the IDs that genuinely support the current finding to bind_finding_traffic. By default returns only 3 entries, at most 10 per page; use page to paginate when there are many results.",
    params: {
      host: {
        h: "6b9f2bed",
        text: "Filter by host (required; e.g. '107.172.96.177', '107.172.96.177:8082', or 'http://107.172.96.177:8082/path')",
      },
      page: {
        h: "dd38635f",
        text: "Page number, starting at 0, default 0 (paginated by ts in descending order)",
      },
      limit: {
        h: "a5343ae3",
        text: "Entries per page, default 3, maximum 10",
      },
      contains: {
        h: "ef61cb4c",
        text: "URL substring filter (optional, e.g. 'api' / 'login')",
      },
      body_contains: {
        h: "497b0a47",
        text: "Full-text body search (optional, at least 3 characters), matching the headers and bodies of requests/responses, e.g. 'password' / 'root:x:0' / '内网测试'",
      },
    },
  },
  update_custom_tool: {
    h: "86baa34b",
    description: "Modify an existing custom tool (by key).",
    params: {
      key: {
        h: "7a9b0485",
        text: "Key of the custom tool to modify",
      },
      exec: {
        h: "a9196449",
        text: "Execution spec (not needed for the shell kind): command->{command}; script->{code}; http->{method,url,headers,body,proxy,use_recording_proxy}",
      },
      kind: {
        h: "5c2e7f61",
        text: "shell | command | script (Python only) | http. shell = a bash environment declaration (only tells the model this tool can be called directly in bash, no exec/schema needed); the other three require exec",
      },
      agents: {
        h: "9f37c967",
        text: "Bound agent keys (optional)",
      },
      schema: {
        h: "37998839",
        text: "Parameter JSON-Schema (may be empty for shell/command/script; required for http and must include properties)",
      },
      enabled: {
        h: "2977ed72",
        text: "Whether enabled (default true)",
      },
      deferred: {
        h: "4808fd3e",
        text: "Whether deferred (no effect for the shell kind; only turn on for infrequently used command/script/http tools)",
      },
      description: {
        h: "c30132aa",
        text: "Description sent to the model",
      },
    },
  },
  update_finding_report: {
    h: "ad7a3a37",
    description:
      'Write/update the [detailed report] of a registered finding (full Markdown text; overwrites the old content wholesale). Pass for finding_id the id returned by report_finding (the number in "finding recorded: <id>"). The report should include: finding overview, impact and harm, reproduction steps, evidence/PoC, remediation advice.',
    params: {
      report: {
        h: "c18fb891",
        text: "Full text of the detailed report, in Markdown format",
      },
      finding_id: {
        h: "635f3452",
        text: "Target finding id (the id returned by report_finding)",
      },
      evidence_version: {
        h: "e52f1ef1",
        text: "The evidence version returned by get_finding_traffic; used to prevent the report from overwriting newer evidence changes",
      },
    },
  },
  update_mcp: {
    h: "5a2320ea",
    description: "Modify an existing MCP server (by id).",
    params: {
      id: {
        h: "3954139e",
        text: "Id of the MCP server to modify",
      },
      env: {
        h: "a81b4f5c",
        text: "Environment variables {KEY:VALUE}",
      },
      url: {
        h: "a1e286f6",
        text: "URL for http/sse",
      },
      args: {
        h: "69260732",
        text: "Command argument array",
      },
      name: {
        h: "886f62f0",
        text: "MCP server name",
      },
      command: {
        h: "2b371aa7",
        text: "Launch command for stdio (e.g. npx)",
      },
      enabled: {
        h: "2977ed72",
        text: "Whether enabled (default true)",
      },
      insecure: {
        h: "a7f9d553",
        text: "http: skip TLS certificate verification (set true for self-signed certificates, default false)",
      },
      transport: {
        h: "d4af5726",
        text: "stdio | http / sse",
      },
    },
  },
  update_skill_file: {
    h: "4a6a8ecf",
    description:
      "Write/overwrite a file inside a skill (default SKILL.md). Used to modify skill content or add scripts/references.",
    params: {
      file: {
        h: "53a56bfb",
        text: "Relative path (optional, default SKILL.md, e.g. scripts/run.py)",
      },
      name: {
        h: "399ac57d",
        text: "Skill name",
      },
      content: {
        h: "0a993792",
        text: "Full file content",
      },
    },
  },
};
