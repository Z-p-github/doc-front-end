今天我们来聊聊 `schedule`， `schedule`是一个独立的包，跟 `React`本身没多大关系，它主要是的作用就是

- 时间切片

- 优先级调度

接下来让我门来了解一下这两个功能

## 时间切片

### 为什么需要时间切片？

react16 开始整个架构分成了三层，`scheduler，Reconciler，renderer`，因为为了实现将一个同步任务变成异步的可中断的任务，`react` 提出了 fiber，因为最开始用的是 stack，任务是无法中断的，js 执行时间太长时会影响页面的渲染造成卡顿，fiber 中任务是可以终端，但是中断的任务怎么连上，什么时间执行，哪个先执行，这都属于是新的问题，因此 `scheduler` 出生了，以浏览器是否有剩余时间作为任务中断的标准，那么我们需要一种机制，当浏览器有剩余时间时，scheduler 会通知我们，同时 scheduler 会进行一系列的任务优先级判断，保证任务时间合理分配

JS 脚本执行和浏览器布局、绘制不能同时执行。在每 16.6ms 时间内，需要完成 JS 脚本执行 ----- 样式布局 ----- 样式绘制，当 JS 执行时间过长，超出了 16.6ms，这次刷新就没有时间执行样式布局和样式绘制了。页面掉帧，造成卡顿。时间切片是在浏览器每一帧的时间中，预留一些时间给 JS 线程，`React` 利用这部分时间更新组件，预留的初始时间是 5ms。超过 5ms，`React` 将中断 js，等下一帧时间到来继续执行 js。其实浏览器本身已经实现了时间切片的功能，这个 API 叫 `requestIdleCallback`，`requestIdleCallback` 是 window 属性上的方法，它的作用是在浏览器一帧的剩余空闲时间内执行优先度相对较低的任务。

但是由于 `requestIdleCallback` 的这两个缺陷，`react` 决定自己模拟时间切片

- 1.浏览器兼容不好的问题

- 2.`requestIdleCallback` 的 FPS 只有 20，也就是 50ms 刷新一次，远远低于页面流畅度的要求，而且 `requestIdleCallback` 在你切换了浏览器的 tab 之后，刷新频率还不稳定

我们可以一起来看下时间切片应该放在哪里，首先排除 `requestIdleCallback`，缺点上文已经提到了，实际上时间切片是放在宏任务里面的，可以先说下为什么不放在其他地方的原因：

- 1.为什么不是微任务里面

  微任务将在页面更新前全部执行完，所以达不到「将主线程还给浏览器」的目的。

- 2.为什么不使用 `requestAnimationFrame`

  如果第一次任务调度不是由 rAF() 触发的，例如直接执行 `scheduler.scheduleTask()`，那么在本次页面更新前会执行一次 rAF() 回调，该回调就是第二次任务调度。所以使用 rAF() 实现会导致在本次页面更新前执行了两次任务。

- 为什么是两次，而不是三次、四次？因为在 rAF() 的回调中再次调用 rAF()，会将第二次 rAF() 的回调放到下一帧前执行，而不是在当前帧前执行。

  另一个原因是 rAF() 的触发间隔时间不确定，如果浏览器间隔了 10ms 才更新页面，那么这 10ms 就浪费了。（现有 WEB 技术中并没有规定浏览器应该什么何时更新页面，所以通常认为是在一次宏任务完成之后，浏览器自行判断当前是否应该更新页面。如果需要更新页面，则执行 rAF() 的回调并更新页面。否则，就执行下一个宏任务。）

- 3.既然是宏任务，那么是 `settimeout` 吗？

  递归执行 `setTimeout(fn, 0)` 时，最后间隔时间会变成 4 毫秒，而不是最初的 1 毫秒，因为 `settimeout` 的执行时机是和 js 执行有关的，递归是会不准，最终使用 `MessageChannel` 产生宏任务，但是由于兼容，如果当前宿主环境不支持 `MessageChannel`，则使用 `setTimeout。`

在 React 的 render 阶段，开启 `Concurrent Mode` 时，每次遍历前，都会通过 `Scheduler` 提供的 `shouldYield` 方法判断是否需要中断遍历，使浏览器有时间渲染：

```js
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

## MessageChannel

[基本使用](https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel)

```js
let messageChannel = new MessageChannel();
let port1 = messageChannel.port1;
let port2 = messageChannel.port2;
port1.onmessage = (event) => {
  console.log("port1.onmessage", event.data); //456
};
port2.onmessage = (event) => {
  console.log("port2.onmessage", event.data); //123
};
port1.postMessage(123);
port2.postMessage(456);
```

一个 `MessageChannel` 对象会暴露两个端口 `port`,这两个端口之间可以互相的发送消息和监听消息，并且 onmessage 回调函数是一个宏任务，如果是放在浏览器端执行的话，那么这个任务会在浏览器的每一帧渲染中去执行

浏览器的一帧执行：
![一帧执行](@assets/fps.png "一帧执行")

## 优先级调度

那什么是优先级调度呢？
`scheduler`内部有一套自己的事件优先级，当高优先级任务调度的时候，可以优先执行，低优先级任务就会往后排，直到高优先级的任务执行完了之后才会去执行低优先级任务，这样可以保证事件执行的先后顺序和重要的任务先执行。

可以看到，Scheduler 内部存在 5 种优先级。

```js
export const NoPriority = 0; // 没有任何优先级
export const ImmediatePriority = 1; // 立即执行的优先级，级别最高
export const UserBlockingPriority = 2; // 用户阻塞级别的优先级
export const NormalPriority = 3; // 正常的优先级
export const LowPriority = 4; // 较低的优先级
export const IdlePriority = 5; // 优先级最低，表示任务可以闲置
```

接下来我们去看看 scheduler 是如何实现的优先级调度任务
