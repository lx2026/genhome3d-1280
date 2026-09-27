#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

const DISCOVERY_URL = "http://127.0.0.1:9222/json/version";
const COMMAND_TIMEOUT_MS = 30_000;

function fail(message) {
  throw new Error(message);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  fail(
    "Usage: cdp-browser.mjs status | tabs | open <url> | " +
      "capture <url> <absolute-output.png> [--close] | " +
      "screenshot <target-id> <absolute-output.png> | close <target-id>",
  );
}

function validateUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`Invalid URL: ${raw}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    fail("Only http:// and https:// URLs are allowed");
  }
  return url.href;
}

function validateOutput(raw) {
  if (!path.isAbsolute(raw)) {
    fail("Screenshot output path must be absolute");
  }
  if (path.extname(raw).toLowerCase() !== ".png") {
    fail("Screenshot output path must end in .png");
  }
  return path.normalize(raw);
}

async function discover() {
  let response;
  try {
    response = await fetch(DISCOVERY_URL, {
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    fail(
      `Approved browser is unavailable at 127.0.0.1:9222: ${error.message}. ` +
        "Check hermes-chromium-cdp.service; do not launch another browser.",
    );
  }
  if (!response.ok) {
    fail(`CDP discovery returned HTTP ${response.status}`);
  }
  const version = await response.json();
  if (!version.webSocketDebuggerUrl) {
    fail("CDP discovery did not return webSocketDebuggerUrl");
  }
  return version;
}

class CDP {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out connecting to CDP WebSocket")),
        5_000,
      );
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Failed to connect to CDP WebSocket"));
        },
        { once: true },
      );
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!Object.hasOwn(message, "id")) return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) {
        waiter.reject(
          new Error(
            `CDP ${waiter.method} failed: ${message.error.message || JSON.stringify(message.error)}`,
          ),
        );
      } else {
        waiter.resolve(message.result || {});
      }
    });
  }

  call(method, params = {}, sessionId = undefined) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP WebSocket is not open"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer, method });
      const request = { id, method, params };
      if (sessionId) request.sessionId = sessionId;
      this.socket.send(JSON.stringify(request));
    });
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close();
    }
  }
}

async function withClient(callback) {
  const version = await discover();
  const client = new CDP(version.webSocketDebuggerUrl);
  await client.connect();
  try {
    return await callback(client, version);
  } finally {
    client.close();
  }
}

async function attach(client, targetId) {
  const result = await client.call("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  if (!result.sessionId) fail(`Could not attach to target ${targetId}`);
  await client.call("Page.enable", {}, result.sessionId);
  await client.call("Runtime.enable", {}, result.sessionId);
  return result.sessionId;
}

async function waitForReady(client, sessionId) {
  const deadline = Date.now() + COMMAND_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await client.call(
      "Runtime.evaluate",
      {
        expression: "document.readyState",
        returnByValue: true,
      },
      sessionId,
    );
    if (result.result?.value === "complete") {
      await new Promise((resolve) => setTimeout(resolve, 750));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("Timed out waiting for the page to finish loading");
}

async function saveScreenshot(client, targetId, output) {
  const sessionId = await attach(client, targetId);
  await waitForReady(client, sessionId);
  const metrics = await client.call("Page.getLayoutMetrics", {}, sessionId);
  const size = metrics.cssContentSize || metrics.contentSize || {};
  const width = Math.max(1, Math.ceil(size.width || 1400));
  const height = Math.max(1, Math.ceil(size.height || 860));
  const result = await client.call(
    "Page.captureScreenshot",
    {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    },
    sessionId,
  );
  if (!result.data) fail("Page.captureScreenshot returned no image data");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(result.data, "base64"));
  return { output, width, height };
}

// Attach only to the approved persistent browser. Each run owns exactly one new
// tab, closes only that tab, and never starts or stops a browser or context.
const baseURL = (process.argv[2] || "http://127.0.0.1:8791").replace(/\/$/, "");
const outputDir = path.resolve(process.argv[3] || "/tmp/astra-website-check");
await mkdir(outputDir, { recursive: true });
const report = { url: baseURL, started_at: new Date().toISOString(), checks: [], errors: [] };
await withClient(async client => {
 const { targetId } = await client.call("Target.createTarget", { url: "about:blank" });
 const sid = await attach(client, targetId);
 const errors = [], packageRequests = [];
 client.socket.addEventListener("message", event => {
  const item = JSON.parse(event.data);
  if (item.sessionId !== sid) return;
  if (item.method === "Runtime.exceptionThrown") errors.push(item.params.exceptionDetails.exception?.description || item.params.exceptionDetails.text);
  if (item.method === "Network.requestWillBeSent" && /\.usdz(?:[?#]|$)/.test(item.params.request.url)) packageRequests.push(item.params.request.url);
 });
 await client.call("Network.enable", {}, sid);
 const evaluate = async expression => {
  const r = await client.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
 };
 const wait = async (expression, timeout=30000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline) { if(await evaluate(expression)) return; await new Promise(resolve=>setTimeout(resolve,150)); }
  throw Error("Timed out: " + expression);
 };
 const check = async (name, fn) => { await fn(); report.checks.push({name,result:"pass"}); print({check:name,result:"pass"}); };
 const navigate = async suffix => { await client.call("Page.navigate", {url:baseURL+suffix},sid); await wait('document.body.dataset.benchmarkState==="ready" && document.querySelector(".bench")'); };
 const set = async (id,value) => { await evaluate(`{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='INPUT'?'input':'change',{bubbles:true}));}`); if(id==='bench-search') await wait(`(new URL(location.href).searchParams.get('q')||'')===${JSON.stringify(value)}`); };
 const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const model = name => evaluate(`{const b=[...document.querySelectorAll('#bench-models button')].find(e=>e.textContent.includes(${JSON.stringify(name)}));if(!b)throw Error('Missing model button');b.click();}`);
 const count = number => wait(`document.querySelector('#bench-count').textContent.includes(${JSON.stringify(number.toLocaleString('en-US'))})`);
 const images = async selector => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  await wait(`document.querySelectorAll(${JSON.stringify(selector)}).length>0 && [...document.querySelectorAll(${JSON.stringify(selector)})].every(im=>im.complete&&im.naturalWidth>0)`);
 };
 try {
  await client.call("Emulation.setDeviceMetricsOverride", {width:1440,height:1100,deviceScaleFactor:1,mobile:false},sid);
  await navigate('/bench.html');
  await check('full publication and default Astra coverage',async()=>{
   await count(1280);
   assert.equal(await evaluate("document.querySelectorAll('.bench').length"),12);
   const stats=await evaluate("Object.fromEntries([...document.querySelectorAll('[data-stat]')].map(e=>[e.dataset.stat,e.textContent]))");
   assert.equal(stats.benches,'1,319');assert.equal(stats.builds,'2,854');
   assert.equal(await evaluate("document.querySelectorAll('#bench-models button').length"),4);
   assert.equal(await evaluate("document.querySelectorAll('#bench-category option').length"),65);
   assert.equal(packageRequests.length,0); report.publication=stats;
   await images('.bench:first-child .tile-reference img');
   await images('.bench:first-child .tile-build:first-of-type img');
  });
  await check('leaf-category filtering and pagination',async()=>{
   await set('bench-category','seating/armchairs');await count(20);
   await click('#bench-next');await wait("document.querySelectorAll('.bench').length===8");
   await click('#bench-prev');await wait("document.querySelectorAll('.bench').length===12");
   await set('bench-page-size','24');await wait("document.querySelectorAll('.bench').length===20");
  });
  await check('exact asset search, rear views, empty state and reset',async()=>{
   await click('#bench-clear');await set('bench-search','CHS-3018');await wait("document.querySelectorAll('.bench').length===1");
   assert.match(await evaluate("document.querySelector('.bench').textContent"),/Natural.Rattan Oval Pod Chest/i);
   await evaluate("document.querySelector('.bench').scrollIntoView({block:'start'})");await images('.bench .tile img');
   const compareShot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);await writeFile(path.join(outputDir,'benchmark-comparison.png'),Buffer.from(compareShot.data,'base64'));
   await click('.bench-more summary');await images('.bench-more .detail:first-child img');
   await set('bench-search','no-object-has-this-token-zzzz');await wait("document.querySelectorAll('.bench').length===0");
   await click('#bench-clear');await count(1280);
  });
  await check('historical coverage and unambiguous target identity',async()=>{
   await model('Claude Opus 5');await count(241);
   await model('Claude Fable 5');await count(14);
   await click('#bench-all-models');await count(1319);
   await set('bench-search','CHR-0002');await wait("document.querySelectorAll('.bench').length===1");
   const old=await evaluate("document.querySelector('.bench').id");
   await set('bench-search','ARM-3003');await wait("document.querySelectorAll('.bench').length===1");
   const newer=await evaluate("document.querySelector('.bench').id");assert.notEqual(old,newer);report.windsor_targets={historical:old,astra:newer};
   await click('#bench-clear');
  });
  await check('filter URL survives reload',async()=>{
   await set('bench-category','bathroom/accessories');
   const selectedURL=await evaluate('location.href');
   await client.call('Page.reload',{ignoreCache:true},sid);
   await wait("document.querySelector('#bench-category')?.value==='bathroom/accessories' && document.querySelectorAll('.bench').length>0");
   assert.equal(new URL(await evaluate('location.href')).searchParams.get('category'),new URL(selectedURL).searchParams.get('category'));
   await click('#bench-clear');
  });
  await check('room and Claude-comparison filters',async()=>{
   await set('bench-room','bathroom');await count(60);assert.equal(await evaluate("document.querySelectorAll('#bench-category option').length"),4);
   await click('#bench-clear');await click('#bench-comparisons-only');await count(216);
   await click('#bench-all-models');await count(255);await click('#bench-clear');
  });
  await check('historical reference deep link',async()=>{
   await navigate('/bench.html#bench-windsor-comb-back-armchair');
   await wait("!!document.querySelector('#bench-windsor-comb-back-armchair')");
   assert.equal(await evaluate("document.querySelector('#benches').dataset.model"),'all');
   await click('#bench-clear');
  });
  report.webgl_available=await evaluate("!!document.createElement('canvas').getContext('webgl2')");
  report.viewer_checks=[];
  const sampleModels=[['COF-3002','GPT-6 Astra'],['DSK-3019','GPT-6 Astra'],['BAC-3018','GPT-6 Astra'],['BAC-1001','Claude Opus 5']];
  for(const [assetId,modelName] of sampleModels) await check('USDZ model and viewer behavior '+assetId,async()=>{
   await click('#bench-all-models');await set('bench-search',assetId);await wait("document.querySelectorAll('.bench').length===1");
   await evaluate(`{const b=[...document.querySelectorAll('.tile-build')].find(e=>e.textContent.includes(${JSON.stringify(modelName)}));if(!b)throw Error('Missing build');b.click();}`);
   await wait("['ready','error'].includes(document.querySelector('#bench-viewer')?.dataset.state)",60000);
   const viewerState=await evaluate("document.querySelector('#bench-viewer').dataset.state");
   if(report.webgl_available) assert.equal(viewerState,'ready');
   else {
    assert.equal(viewerState,'error');
    assert.match(await evaluate("document.querySelector('#bench-viewer-status').textContent"),/download/i);
    assert.equal(await evaluate("document.querySelector('#bench-viewer-poster').hidden"),false);
   }
   const parsed=await evaluate(`(async()=>{const {USDLoader}=await import(new URL('./vendor/addons/loaders/USDLoader.js',location.href).href);const object=await new USDLoader().loadAsync(document.querySelector('#bench-viewer-download').href);let meshes=0,vertices=0,materials=0;object.traverse(child=>{if(child.isMesh){meshes++;vertices+=child.geometry?.attributes.position?.count||0;materials+=Array.isArray(child.material)?child.material.length:1}});return {meshes,vertices,materials}})()`);
   assert(parsed.meshes>0&&parsed.vertices>0&&parsed.materials>0);report.viewer_checks.push({asset_id:assetId,state:viewerState,parsed});
   await images('#bench-viewer-reference');
   assert.match(await evaluate("document.querySelector('#bench-viewer-title').textContent"),new RegExp(modelName.replaceAll('.','\\.')));
   const dimensions=await evaluate("({w:document.querySelector('#bench-viewer-canvas').width,h:document.querySelector('#bench-viewer-canvas').height,download:document.querySelector('#bench-viewer-download').href})");
   if(report.webgl_available) assert(dimensions.w>200&&dimensions.h>200);
   await click('#bench-viewer-background');await click('#bench-viewer-reset');
   if(assetId==='COF-3002') {const shot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);await writeFile(path.join(outputDir,'viewer-largest-package.png'),Buffer.from(shot.data,'base64'));}
   await click('#bench-viewer-close');await wait("!document.querySelector('#bench-viewer').open");
  });
  await check('desktop and mobile layout',async()=>{
   await click('#bench-clear');await evaluate('scrollTo(0,0)');
   await new Promise(resolve=>setTimeout(resolve,300));
   const shot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);await writeFile(path.join(outputDir,'benchmark-desktop.png'),Buffer.from(shot.data,'base64'));
   await client.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sid);
   const width=await evaluate('({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,innerWidth})');assert.equal(width.viewport,390);assert(width.scroll<=390);assert.equal(width.innerWidth,390);report.mobile=width;
   await set('bench-search','BAC-3018');await wait("document.querySelectorAll('.bench').length===1");
   const mobileShot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);await writeFile(path.join(outputDir,'benchmark-mobile.png'),Buffer.from(mobileShot.data,'base64'));
   await evaluate("document.querySelector('#bench-browser').scrollIntoView({block:'start',behavior:'instant'})");
   const comparisonShot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);await writeFile(path.join(outputDir,'benchmark-mobile-comparison.png'),Buffer.from(comparisonShot.data,'base64'));
   await click('#bench-clear');
  });
  await check('original catalog and benchmark navigation',async()=>{
   await client.call('Page.navigate',{url:baseURL+'/'},sid);await wait("document.querySelectorAll('.asset-card').length===24");
   assert.equal(await evaluate("document.querySelector('#result-count').textContent"),'1,280');
   const catalogWidth=await evaluate('({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth})');assert.equal(catalogWidth.width,390);assert(catalogWidth.scroll<=390);report.catalog_mobile=catalogWidth;
   await set('search','MXB-0014');await wait("document.querySelectorAll('.asset-card').length===1");
   const link=await evaluate("document.querySelector('.bench-band-card a').href");assert.equal(link,baseURL+'/bench.html');
  });
  assert.deepEqual(errors,[]);report.package_requests=packageRequests.length;report.result='pass';
 } catch(error) { report.result='fail';report.errors.push(error.stack||String(error));throw error; }
 finally {report.browser_errors=errors;report.completed_at=new Date().toISOString();await writeFile(path.join(outputDir,'browser-check.json'),JSON.stringify(report,null,2)+'\n');await client.call('Target.closeTarget',{targetId});}
});
print(report);
