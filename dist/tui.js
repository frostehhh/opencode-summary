// @bun
// src/tui.tsx
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { SyntaxStyle, TextAttributes } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import path2 from "path";

// src/lib.ts
import path from "path";

// src/prompt.ts
var GUARD = "Do not call any tools and do not take any actions.";
var DEFAULT_PROMPT = `Summarize the conversation so far for the user.
Output markdown only, no preamble, about 300 words or less. Use exactly these sections, bullets only below TL;DR; omit a section if empty:

## TL;DR
2-3 sentences.
## Goal
## Decisions
## Progress / current state
## Open questions / next steps
## Key files and references`;

// src/lib.ts
var METADATA_KEY = "opencode-summary";
var buildRequest = (prompt) => `${GUARD}

${prompt}`;
function promptId(text) {
  let hash = 2166136261;
  for (let i = 0;i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
function readSummary(metadata) {
  if (!metadata || typeof metadata !== "object")
    return;
  const value = metadata[METADATA_KEY];
  if (!value || typeof value !== "object")
    return;
  const { text, generatedAt, promptId: promptId2, lastMessageID } = value;
  if (typeof text !== "string" || typeof generatedAt !== "number")
    return;
  if (typeof promptId2 !== "string" || typeof lastMessageID !== "string")
    return;
  return { text, generatedAt, promptId: promptId2, lastMessageID };
}
var withSummary = (metadata, record) => ({
  ...metadata,
  [METADATA_KEY]: record
});
function withoutSummary(metadata) {
  const { [METADATA_KEY]: _removed, ...rest } = metadata ?? {};
  return rest;
}
var isBlank = (text) => !text || text.trim() === "";
function relativeTime(ts, now) {
  const s = Math.floor((now - ts) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60)
    return "just now";
  if (m < 60)
    return `${m}m ago`;
  if (h < 24)
    return `${h}h ago`;
  if (d < 7)
    return `${d}d ago`;
  return;
}
function datetime(ts) {
  const date = new Date(ts);
  return `${date.toLocaleTimeString(undefined, { timeStyle: "short" })} \xB7 ${date.toLocaleDateString()}`;
}
var TURN_LIMIT = 200;
var GENERATE_TIMEOUT_MS = 180000;
function turnsSince(userMessageIDs, lastMessageID, limit = TURN_LIMIT) {
  const count = userMessageIDs.filter((id) => id > lastMessageID).length;
  return { count, capped: userMessageIDs.length >= limit && count >= limit };
}
function turnsText({ count, capped }) {
  if (capped)
    return `${TURN_LIMIT}+ turns ago`;
  if (count === 0)
    return "up to date";
  return count === 1 ? "1 turn ago" : `${count} turns ago`;
}
var turnLabel = (turns) => `summary ${turnsText(turns)}`;
function generatedLine(record, now, turns) {
  const relative = relativeTime(record.generatedAt, now);
  const parts = ["Generated", ...relative ? [`${relative} \xB7`] : [], datetime(record.generatedAt)];
  return turns ? `${parts.join(" ")} \xB7 ${turnsText(turns)}` : parts.join(" ");
}
function errorMessage(cause) {
  if (cause instanceof Error && cause.message)
    return cause.message;
  return typeof cause === "string" && cause ? cause : "Unknown error";
}
function blockReason(input) {
  if (input.inFlight)
    return "in-flight";
  if (input.status === "running")
    return "running";
  return;
}
function lastVisibleID(idsDesc, revertBoundary) {
  return revertBoundary === undefined ? idsDesc[0] : idsDesc.find((id) => id < revertBoundary);
}
function blockMessage(reason) {
  switch (reason) {
    case "in-flight":
      return "Already generating";
    case "running":
      return "Agent is running - wait for it to finish";
  }
}
function isMessageNotFound(error) {
  if (!error || typeof error !== "object")
    return false;
  const { _tag, name } = error;
  return _tag === "MessageNotFoundError" || name === "MessageNotFoundError";
}
var validityAction = (check) => !check.found && check.notFound ? "delete" : "keep";
var resolvePrompt = (override) => isBlank(override) ? { text: DEFAULT_PROMPT, source: "default" } : { text: override.trim(), source: "override" };
function saveAction(edited) {
  if (isBlank(edited))
    return "noop";
  return edited.trim() === DEFAULT_PROMPT.trim() ? "delete" : "write";
}
function promptPaths(env, home) {
  const base = env.XDG_CONFIG_HOME?.trim() || path.join(home, ".config");
  const dir = path.join(base, "opencode", "opencode-summary");
  return { dir, override: path.join(dir, "summary.md") };
}

// src/tui.tsx
var paths = promptPaths(process.env, homedir());
var tui_default = Plugin.define({
  id: "opencode-summary",
  setup(context) {
    const {
      client,
      ui
    } = context;
    const theme = () => context.theme.surface("dialog");
    const syntax = SyntaxStyle.fromStyles({
      default: {
        fg: context.theme.markdown.text
      },
      "markup.heading": {
        fg: context.theme.markdown.heading,
        bold: true
      },
      "markup.strong": {
        fg: context.theme.markdown.strong,
        bold: true
      },
      "markup.italic": {
        fg: context.theme.markdown.emphasis,
        italic: true
      },
      "markup.list": {
        fg: context.theme.markdown.listItem
      },
      "markup.quote": {
        fg: context.theme.markdown.blockQuote,
        italic: true
      },
      "markup.raw": {
        fg: context.theme.markdown.code
      },
      "markup.link": {
        fg: context.theme.markdown.link,
        underline: true
      }
    }, context.renderer.nativeScene);
    const toastError = (cause) => ui.toast.show({
      variant: "error",
      message: errorMessage(cause)
    });
    async function readMetadata(sessionID) {
      return (await client.session.get({
        sessionID
      })).metadata ?? {};
    }
    async function writeSummary(sessionID, record) {
      const current = await readMetadata(sessionID);
      const metadata = record ? withSummary(current, record) : withoutSummary(current);
      await client.session.update({
        sessionID,
        metadata
      });
    }
    async function loadSummary(sessionID) {
      const record = readSummary(await readMetadata(sessionID));
      if (!record)
        return;
      const check = await client.session.message.get({
        sessionID,
        messageID: record.lastMessageID
      }).then(() => ({
        found: true
      }), (error) => ({
        found: false,
        notFound: isMessageNotFound(error)
      }));
      if (validityAction(check) === "keep")
        return record;
      await writeSummary(sessionID, undefined);
      return;
    }
    async function blocked(sessionID) {
      return blockReason({
        status: context.data.session.status(sessionID),
        inFlight: inFlight(sessionID)
      });
    }
    const [tick, setTick] = createSignal(0);
    let pending;
    const bump = () => {
      clearTimeout(pending);
      pending = setTimeout(() => setTick((n) => n + 1), 150);
    };
    const stops = ["session.inbox.delivered", "session.metadata.updated", "session.revert.committed", "session.revert.staged", "session.revert.cleared", "session.execution.started", "session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"].map((type) => context.data.on(type, bump));
    const [flight, setFlight] = context.storage.memory("inflight", {
      initial: {
        sessions: []
      }
    });
    const inFlight = (sessionID) => flight.sessions.includes(sessionID);
    const [modalFor, setModalFor] = createSignal();
    async function countTurns(sessionID, lastMessageID) {
      const page = await client.message.list({
        sessionID,
        type: "user",
        order: "desc",
        limit: TURN_LIMIT
      });
      return turnsSince(page.data.map((message) => message.id), lastMessageID);
    }
    async function loadView(sessionID) {
      const record = await loadSummary(sessionID);
      return record ? {
        record,
        turns: await countTurns(sessionID, record.lastMessageID)
      } : undefined;
    }
    async function readOverride() {
      return readFile(paths.override, "utf8").catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
    }
    const loadPrompt = async () => resolvePrompt(await readOverride());
    async function applyEdited(edited, previous) {
      switch (saveAction(edited)) {
        case "noop":
          if (previous === undefined)
            await rm(paths.override, {
              force: true
            });
          else
            await writeFile(paths.override, previous);
          return void ui.toast.show({
            variant: "warning",
            message: "Empty prompt - not saved"
          });
        case "delete":
          await rm(paths.override, {
            force: true
          });
          return void ui.toast.show({
            message: "Prompt matches default - override removed"
          });
        case "write":
          await mkdir(path2.dirname(paths.override), {
            recursive: true
          });
          await writeFile(paths.override, edited.trim() + `
`);
          return void ui.toast.show({
            variant: "success",
            message: "Prompt saved"
          });
      }
    }
    function spawnEditor(command, file) {
      const [bin, ...args] = command.split(" ");
      return new Promise((resolve, reject) => {
        const child = spawn(bin, [...args, file], {
          stdio: "inherit"
        });
        child.on("error", reject);
        child.on("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Editor exited with ${signal ? `signal ${signal}` : `code ${code}`}`)));
      });
    }
    const externalEditor = () => process.env.VISUAL || process.env.EDITOR;
    async function editWithEditor(sessionID, editor) {
      const previous = await readOverride();
      await mkdir(path2.dirname(paths.override), {
        recursive: true
      });
      if (previous === undefined)
        await writeFile(paths.override, (await loadPrompt()).text + `
`);
      await context.renderer.suspend();
      try {
        await spawnEditor(editor, paths.override);
      } catch (cause) {
        toastError(cause);
        return;
      } finally {
        await context.renderer.resume();
      }
      await applyEdited(await readOverride() ?? "", previous);
      openModal(sessionID, "prompt");
    }
    async function resetPrompt(sessionID, reopen = true) {
      const confirmed = await ui.dialog.confirm({
        title: "Reset summary prompt?",
        message: `Delete ${ui.format.path(paths.override)} and use the default prompt.`,
        label: {
          confirm: "Reset",
          cancel: "Cancel"
        }
      });
      if (confirmed) {
        await rm(paths.override, {
          force: true
        });
        ui.toast.show({
          message: "Prompt reset to default"
        });
      }
      if (reopen)
        openModal(sessionID, "prompt");
    }
    async function generate(sessionID) {
      const prompt = (await loadPrompt()).text;
      const [info, page] = await Promise.all([client.session.get({
        sessionID
      }), client.message.list({
        sessionID,
        order: "desc",
        limit: TURN_LIMIT
      })]);
      const lastMessageID = lastVisibleID(page.data.map((message) => message.id), info.revert?.messageID);
      if (!lastMessageID) {
        ui.toast.show({
          variant: "warning",
          message: "Nothing to summarize yet"
        });
        return false;
      }
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Summary timed out")), GENERATE_TIMEOUT_MS);
      });
      const result = await Promise.race([client.session.generate({
        sessionID,
        prompt: buildRequest(prompt)
      }), timeout]).catch((cause) => (toastError(cause), undefined)).finally(() => clearTimeout(timer));
      if (!result)
        return false;
      if (isBlank(result.text)) {
        ui.toast.show({
          variant: "error",
          message: "Summary came back empty"
        });
        return false;
      }
      await writeSummary(sessionID, {
        text: result.text.trim(),
        generatedAt: Date.now(),
        promptId: promptId(prompt),
        lastMessageID
      });
      return true;
    }
    const [settings, setSettings] = context.storage.store("settings", {
      initial: {
        indicator: true
      }
    });
    function copyText(text) {
      if (!context.renderer.copyToClipboardOSC52(text))
        ui.toast.show({
          variant: "warning",
          message: "Copy not supported by this terminal"
        });
      else
        ui.toast.show({
          variant: "success",
          message: "Summary copied"
        });
    }
    function currentSession() {
      const route = ui.router.current();
      if (route.type === "session")
        return route.sessionID;
      ui.toast.show({
        variant: "warning",
        message: "Open a session first"
      });
      return;
    }
    async function deleteSummary(sessionID) {
      if (!await loadSummary(sessionID))
        return void ui.toast.show({
          message: "No summary to delete"
        });
      const confirmed = await ui.dialog.confirm({
        title: "Delete summary?",
        message: "Remove this session's stored summary.",
        label: {
          confirm: "Delete",
          cancel: "Cancel"
        }
      });
      if (!confirmed)
        return;
      await writeSummary(sessionID, undefined);
      ui.toast.show({
        message: "Summary deleted"
      });
      bump();
    }
    async function startGenerate(sessionID) {
      const reason = await blocked(sessionID);
      if (reason)
        return void ui.toast.show({
          variant: "warning",
          message: blockMessage(reason)
        });
      setFlight((draft) => void draft.sessions.push(sessionID));
      try {
        const written = await generate(sessionID);
        if (written && modalFor() !== sessionID)
          ui.toast.show({
            variant: "success",
            message: "Summary ready",
            sessionID
          });
      } catch (cause) {
        toastError(cause);
      } finally {
        setFlight((draft) => void (draft.sessions = draft.sessions.filter((id) => id !== sessionID)));
        bump();
      }
    }
    function Spinner(props) {
      const frames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
      const [i, setI] = createSignal(0);
      const timer = setInterval(() => setI((n) => (n + 1) % frames.length), 80);
      onCleanup(() => clearInterval(timer));
      return (() => {
        var _el$ = _$createElement("text");
        _$insert(_el$, () => `${frames[i()]} ${props.label}`);
        _$effect((_$p) => _$setProp(_el$, "fg", context.theme.hue.interactive[200], _$p));
        return _el$;
      })();
    }
    function FooterStatus(props) {
      const [view] = createResource(() => props.sessionID ? [props.sessionID, tick()] : undefined, ([sessionID]) => loadView(sessionID).catch(() => {
        return;
      }));
      return _$createComponent(Show, {
        get when() {
          return props.sessionID;
        },
        children: (sessionID) => _$createComponent(Show, {
          get when() {
            return !inFlight(sessionID());
          },
          get fallback() {
            return _$createComponent(Spinner, {
              label: "/summary"
            });
          },
          get children() {
            return _$createComponent(Show, {
              get when() {
                return _$memo(() => !!settings.indicator)() && view();
              },
              children: (current) => (() => {
                var _el$2 = _$createElement("text");
                _$insert(_el$2, () => turnLabel(current().turns));
                _$effect((_$p) => _$setProp(_el$2, "fg", context.theme.text.muted, _$p));
                return _el$2;
              })()
            });
          }
        })
      });
    }
    ui.slot({
      append: "prompt.footer.status",
      render: (props) => _$createComponent(FooterStatus, {
        get sessionID() {
          return props.sessionID;
        }
      })
    });
    function Hints(props) {
      return (() => {
        var _el$3 = _$createElement("box");
        _$setProp(_el$3, "flexDirection", "row");
        _$setProp(_el$3, "gap", 2);
        _$insert(_el$3, _$createComponent(For, {
          get each() {
            return props.items;
          },
          children: ([title, key]) => (() => {
            var _el$4 = _$createElement("text");
            _$insert(_el$4, `${title} ${key}`);
            _$effect((_$p) => _$setProp(_el$4, "fg", theme().text.muted, _$p));
            return _el$4;
          })()
        }));
        return _el$3;
      })();
    }
    function PromptEditor(props) {
      const [target, setTarget] = createSignal();
      let textarea;
      const save = async () => {
        const previous = await readOverride();
        await applyEdited(textarea?.plainText ?? "", previous).then(() => props.onDone(true), toastError);
      };
      context.keymap.layer(() => ({
        mode: "modal",
        priority: 1,
        target,
        enabled: target() !== undefined,
        commands: [{
          bind: "ctrl+s",
          title: "Save prompt",
          group: "Dialog",
          run: () => void save()
        }, {
          bind: "escape",
          title: "Cancel edit",
          group: "Dialog",
          run: () => props.onDone(false)
        }]
      }));
      onMount(() => setTimeout(() => textarea && !textarea.isDestroyed && textarea.focus(), 1));
      return (() => {
        var _el$5 = _$createElement("box"), _el$6 = _$createElement("text"), _el$7 = _$createElement("textarea");
        _$insertNode(_el$5, _el$6);
        _$insertNode(_el$5, _el$7);
        _$setProp(_el$5, "gap", 1);
        _$insert(_el$6, `fixed: ${GUARD}`);
        _$use((element) => (textarea = element, setTarget(element)), _el$7);
        _$setProp(_el$7, "wrapMode", "word");
        _$insert(_el$5, _$createComponent(Hints, {
          items: [["save", "ctrl+s"], ["cancel", "esc"]]
        }), null);
        _$effect((_p$) => {
          var _v$ = theme().text.muted, _v$2 = props.initial, _v$3 = props.height, _v$4 = theme().text.formfield.base, _v$5 = theme().text.formfield.base, _v$6 = theme().text.base;
          _v$ !== _p$.e && (_p$.e = _$setProp(_el$6, "fg", _v$, _p$.e));
          _v$2 !== _p$.t && (_p$.t = _$setProp(_el$7, "initialValue", _v$2, _p$.t));
          _v$3 !== _p$.a && (_p$.a = _$setProp(_el$7, "height", _v$3, _p$.a));
          _v$4 !== _p$.o && (_p$.o = _$setProp(_el$7, "textColor", _v$4, _p$.o));
          _v$5 !== _p$.i && (_p$.i = _$setProp(_el$7, "focusedTextColor", _v$5, _p$.i));
          _v$6 !== _p$.n && (_p$.n = _$setProp(_el$7, "cursorColor", _v$6, _p$.n));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined,
          n: undefined
        });
        return _el$5;
      })();
    }
    function SummaryDialog(props) {
      const dimensions = useTerminalDimensions();
      const maxHeight = createMemo(() => Math.max(8, Math.floor(dimensions().height * 0.6)));
      const [mode, setMode] = createSignal(props.mode);
      const [view] = createResource(() => [props.sessionID, tick()], ([id]) => loadView(id).catch(toastError));
      const [reason] = createResource(() => [props.sessionID, tick()], ([id]) => blocked(id).catch(() => {
        return;
      }));
      const [prompt, {
        refetch: refetchPrompt
      }] = createResource(() => [mode(), tick()], () => loadPrompt());
      const record = () => view()?.record;
      const busy = () => inFlight(props.sessionID);
      const stale = () => view() && prompt() && view().record.promptId !== promptId(prompt().text);
      let scroll;
      const run = () => void startGenerate(props.sessionID);
      const copy = () => {
        const text = record()?.text;
        if (text)
          copyText(text);
      };
      const edit = () => {
        const editor = externalEditor();
        if (editor)
          editWithEditor(props.sessionID, editor).catch(toastError);
        else
          setMode("edit");
      };
      context.keymap.layer(() => ({
        mode: "modal",
        enabled: mode() !== "edit",
        commands: [{
          bind: "g",
          title: "Generate summary",
          group: "Dialog",
          run
        }, {
          bind: "v",
          title: "Toggle prompt view",
          group: "Dialog",
          run: () => setMode((m) => m === "summary" ? "prompt" : "summary")
        }]
      }));
      context.keymap.layer(() => ({
        mode: "modal",
        enabled: mode() === "summary",
        commands: [{
          bind: "c",
          title: "Copy summary",
          group: "Dialog",
          run: copy
        }]
      }));
      context.keymap.layer(() => ({
        mode: "modal",
        enabled: mode() === "prompt",
        commands: [{
          bind: "e",
          title: "Edit prompt",
          group: "Dialog",
          run: edit
        }, {
          bind: "r",
          title: "Reset prompt",
          group: "Dialog",
          run: () => void resetPrompt(props.sessionID).catch(toastError)
        }]
      }));
      useKeyboard((event) => {
        if (!scroll || mode() === "edit")
          return;
        if (event.name === "up" || event.name === "k")
          return scroll.scrollBy(-1);
        if (event.name === "down" || event.name === "j")
          return scroll.scrollBy(1);
        if (event.name === "pageup")
          return scroll.scrollBy(-maxHeight());
        if (event.name === "pagedown")
          return scroll.scrollBy(maxHeight());
        if (event.name === "home")
          return scroll.scrollTo(0);
        if (event.name === "end")
          return scroll.scrollTo(scroll.scrollHeight);
      });
      const summaryBody = () => _$createComponent(Show, {
        get when() {
          return record();
        },
        children: (current) => (() => {
          var _el$8 = _$createElement("scrollbox"), _el$9 = _$createElement("markdown");
          _$insertNode(_el$8, _el$9);
          _$use((element) => scroll = element, _el$8);
          _$setProp(_el$8, "scrollbarOptions", {
            visible: false
          });
          _$setProp(_el$9, "syntaxStyle", syntax);
          _$setProp(_el$9, "conceal", true);
          _$effect((_p$) => {
            var _v$7 = maxHeight(), _v$8 = current().text, _v$9 = theme().markdown.text;
            _v$7 !== _p$.e && (_p$.e = _$setProp(_el$8, "maxHeight", _v$7, _p$.e));
            _v$8 !== _p$.t && (_p$.t = _$setProp(_el$9, "content", _v$8, _p$.t));
            _v$9 !== _p$.a && (_p$.a = _$setProp(_el$9, "fg", _v$9, _p$.a));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined
          });
          return _el$8;
        })()
      });
      return (() => {
        var _el$0 = _$createElement("box"), _el$1 = _$createElement("box"), _el$10 = _$createElement("text"), _el$12 = _$createElement("text"), _el$14 = _$createElement("text");
        _$insertNode(_el$0, _el$1);
        _$insertNode(_el$0, _el$14);
        _$setProp(_el$0, "paddingLeft", 3);
        _$setProp(_el$0, "paddingRight", 3);
        _$setProp(_el$0, "paddingBottom", 1);
        _$setProp(_el$0, "gap", 1);
        _$insertNode(_el$1, _el$10);
        _$insertNode(_el$1, _el$12);
        _$setProp(_el$1, "flexDirection", "row");
        _$setProp(_el$1, "justifyContent", "space-between");
        _$insertNode(_el$10, _$createTextNode(`/summary`));
        _$insertNode(_el$12, _$createTextNode(`esc`));
        _$insert(_el$14, (() => {
          var _c$ = _$memo(() => !!busy());
          return () => _c$() ? "Generating\u2026" : _$memo(() => !!view())() ? generatedLine(view().record, Date.now(), view().turns) : "No summary yet - press g to generate";
        })());
        _$insert(_el$0, _$createComponent(Show, {
          get when() {
            return _$memo(() => mode() === "edit")() && prompt();
          },
          get children() {
            return _$createComponent(PromptEditor, {
              get initial() {
                return prompt().text;
              },
              get height() {
                return Math.max(6, maxHeight() - 4);
              },
              onDone: (saved) => {
                setMode("prompt");
                if (saved)
                  refetchPrompt();
              }
            });
          }
        }), null);
        _$insert(_el$0, _$createComponent(Show, {
          get when() {
            return mode() === "prompt";
          },
          get children() {
            var _el$15 = _$createElement("scrollbox"), _el$16 = _$createElement("box"), _el$17 = _$createElement("text"), _el$18 = _$createElement("text"), _el$19 = _$createElement("text");
            _$insertNode(_el$15, _el$16);
            _$use((element) => scroll = element, _el$15);
            _$setProp(_el$15, "scrollbarOptions", {
              visible: false
            });
            _$insertNode(_el$16, _el$17);
            _$insertNode(_el$16, _el$18);
            _$insertNode(_el$16, _el$19);
            _$setProp(_el$16, "gap", 1);
            _$insert(_el$17, `fixed: ${GUARD}`);
            _$insert(_el$18, () => prompt()?.text ?? "");
            _$insert(_el$19, (() => {
              var _c$2 = _$memo(() => prompt()?.source === "override");
              return () => _c$2() ? `source: override (${ui.format.path(paths.override)})` : "source: default (prompt.ts)";
            })());
            _$effect((_p$) => {
              var _v$0 = maxHeight(), _v$1 = theme().text.muted, _v$10 = theme().text.base, _v$11 = theme().text.muted;
              _v$0 !== _p$.e && (_p$.e = _$setProp(_el$15, "maxHeight", _v$0, _p$.e));
              _v$1 !== _p$.t && (_p$.t = _$setProp(_el$17, "fg", _v$1, _p$.t));
              _v$10 !== _p$.a && (_p$.a = _$setProp(_el$18, "fg", _v$10, _p$.a));
              _v$11 !== _p$.o && (_p$.o = _$setProp(_el$19, "fg", _v$11, _p$.o));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined
            });
            return _el$15;
          }
        }), null);
        _$insert(_el$0, _$createComponent(Show, {
          get when() {
            return mode() === "summary";
          },
          get children() {
            return summaryBody();
          }
        }), null);
        _$insert(_el$0, _$createComponent(Show, {
          get when() {
            return _$memo(() => mode() === "summary")() && stale();
          },
          get children() {
            var _el$20 = _$createElement("text");
            _$insertNode(_el$20, _$createTextNode(`Generated with a different prompt`));
            _$effect((_$p) => _$setProp(_el$20, "fg", theme().text.muted, _$p));
            return _el$20;
          }
        }), null);
        _$insert(_el$0, _$createComponent(Show, {
          get when() {
            return mode() !== "edit";
          },
          get children() {
            return _$createComponent(Hints, {
              get items() {
                return [[reason() ? `generate (${reason()})` : "generate", "g"], [mode() === "summary" ? "prompt" : "summary", "v"], ...mode() === "prompt" ? [["edit", "e"], ["reset", "r"]] : [], ...mode() === "summary" ? [["copy", "c"]] : [], ["scroll", "j/k"]];
              }
            });
          }
        }), null);
        _$effect((_p$) => {
          var _v$12 = TextAttributes.BOLD, _v$13 = theme().text.base, _v$14 = theme().text.muted, _v$15 = theme().text.muted;
          _v$12 !== _p$.e && (_p$.e = _$setProp(_el$10, "attributes", _v$12, _p$.e));
          _v$13 !== _p$.t && (_p$.t = _$setProp(_el$10, "fg", _v$13, _p$.t));
          _v$14 !== _p$.a && (_p$.a = _$setProp(_el$12, "fg", _v$14, _p$.a));
          _v$15 !== _p$.o && (_p$.o = _$setProp(_el$14, "fg", _v$15, _p$.o));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined
        });
        return _el$0;
      })();
    }
    function openModal(sessionID, mode = "summary") {
      setModalFor(sessionID);
      ui.dialog.show(() => _$createComponent(SummaryDialog, {
        sessionID,
        mode
      }), () => setModalFor(undefined));
      ui.dialog.set({
        size: "large",
        centered: true
      });
    }
    ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "summary.open",
            title: "Open summary modal",
            description: "View or generate a summary of this session",
            group: "Summary",
            palette: true,
            slash: {
              name: "summary"
            },
            run() {
              const sessionID = currentSession();
              if (sessionID)
                openModal(sessionID);
            }
          }, {
            id: "summary.generate",
            title: "Generate summary",
            description: "Generate a summary without opening the modal",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (sessionID)
                startGenerate(sessionID);
            }
          }, {
            id: "summary.copy",
            title: "Copy summary",
            description: "Copy the stored summary to the clipboard",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (!sessionID)
                return;
              loadSummary(sessionID).then((record) => record ? copyText(record.text) : ui.toast.show({
                message: "No summary yet"
              }), toastError);
            }
          }, {
            id: "summary.delete",
            title: "Delete summary",
            description: "Remove the stored summary of this session",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (sessionID)
                deleteSummary(sessionID).catch(toastError);
            }
          }, {
            id: "summary.prompt.view",
            title: "View summary prompt",
            description: "Show the prompt used for summaries",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (sessionID)
                openModal(sessionID, "prompt");
            }
          }, {
            id: "summary.prompt.edit",
            title: "Edit summary prompt",
            description: "Edit the prompt used for summaries",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (!sessionID)
                return;
              const editor = externalEditor();
              if (editor)
                editWithEditor(sessionID, editor).catch(toastError);
              else
                openModal(sessionID, "edit");
            }
          }, {
            id: "summary.prompt.reset",
            title: "Reset summary prompt",
            description: "Restore the default summary prompt",
            group: "Summary",
            palette: true,
            run() {
              const sessionID = currentSession();
              if (sessionID)
                resetPrompt(sessionID, false).catch(toastError);
            }
          }, {
            id: "summary.indicator.toggle",
            title: "Toggle summary footer indicator",
            description: "Show or hide the turns-ago indicator in the prompt footer",
            group: "Summary",
            palette: true,
            run() {
              const next = !settings.indicator;
              setSettings((draft) => void (draft.indicator = next)).then(() => ui.toast.show({
                message: next ? "Footer indicator shown" : "Footer indicator hidden"
              }), toastError);
            }
          }]
        }));
        return null;
      }
    });
    return () => {
      clearTimeout(pending);
      stops.forEach((stop) => stop());
      context.renderer.idle().then(() => syntax.destroy());
    };
  }
});
export {
  tui_default as default
};
