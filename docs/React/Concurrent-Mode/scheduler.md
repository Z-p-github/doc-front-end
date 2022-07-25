## 任务过期时间

在 `scheduler` 中不同的优先级对应着不同的任务过期事件，如下所示：

```js
//每个优先级对应的任务对应一个过期时间
let maxSigned31BitInt = 1073741823;
let IMMEDIATE_PRIORITY_TIMEOUT = -1; //为负数，表明当前的任务时间已经过期了，需要立即执行
let USER_BLOCKING_PRIORITY_TIMEOUT = 250;
let NORMAL_PRIORITY_TIMEOUT = 5000;
let LOW_PRIORITY_TIMEOUT = 10000;
let IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;
```

## 任务队列

在 `scheduler` 中会存在两个队列，一个叫做 `taskQueue` 这个用来存放已经开始了的任务队列，还有一个叫做 `timerQueue` ，这个用来存放尚未开始的任务队列。

每当有新的未就绪的任务被注册，我们将其插入`timerQueue`并根据开始时间重新排列`timerQueue`中任务的顺序。

当`timerQueue`中有任务就绪，即`startTime <= currentTime `，我们将其取出并加入`taskQueue`。

取出`taskQueue`中最早过期的任务并执行他。

为了能在 O(1)复杂度找到两个队列中时间最早的那个任务，`Scheduler`使用[小顶堆](https://www.cnblogs.com/lanhaicode/p/10546257.html)实现了`优先级队列`。

> 你可以在[这里](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/scheduler/src/SchedulerMinHeap.js)看到`优先级队列`的实现

## scheduleCallback

在 `scheduler` 有一个 `scheduleCallback` 方法去负责调度任务，该方法接受三个参数

```js
/**
 * 调度一个任务
 * @param {*} priorityLevel  任务优先级
 * @param {*} callback  需要调度的方法
 * @param {*} options  选项，包括设置任务的一个延时时间
 */
function scheduleCallback(priorityLevel, callback, options) {}
```

方法执行开始，首先会去获取到一个当前时间，然后判断 options 是不是一个对象，如果是的话，会取出里面的一个过期时间字段加上当前的时间和一个任务的过期时间，来表示这个任务的一个优先级。

```js
function scheduleCallback(priorityLevel, callback, options) {
  //获取当前的时间
  let currentTime = getCurrentTime();
  //此任务的开始时间
  let startTime = currentTime;
  if (typeof options === "object" && options !== null) {
    let delay = options.delay;
    //如果delay是一个数字，那么开始时间等于当前时间加上延迟的时间
    if (typeof delay === "number" && delay > 0) {
      startTime = currentTime + delay;
    } else {
      //开始时间等于当前时间，也就是立刻开始
      startTime = currentTime;
    }
  }
  //计算超时时间
  let timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
  }
  //计算一个过期时间 当前时间加上超时时间
  let expirationTime = startTime + timeout;
  let newTask = {
    id: taskIdCounter++, //每个任务有一个自增的ID
    callback, //真正要执行的函数calculate
    priorityLevel, //优先级
    expirationTime, //过期时间
    startTime, //开始时间
    sortIndex: -1, //排序值
  };
}
``;
```

然后我们需要判断 任务开始时间是不是大于当前时间 ，说明此任务不需要立刻开始，需要等一段时间后才开始，那么我们就会把这个任务放到 `timerQueue` 这个最小堆中去，否则就方法 `taskQueue` 里面去

```js
//如果说任务开始时间大于当前里说 ，说明此任务不需要立刻开始，需要等一段时间后才开始
if (startTime > currentTime) {
  //如果是延迟任务，那么在timeQueue中的排序依赖就是开始时间了
  newTask.sortIndex = startTime;
  //添加到延迟任务最小堆里，优先队列里
  push(timerQueue, newTask);
  //如果现在开始队列里已经为空了，并且新添加的这个延迟任务是延迟任务队队列优先级最高的那个任务
  if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
    //开启一个定时器，等到此任务的开始时间到达的时候检查延迟任务并添加到taskQueue中
    requestHostTimeout(handleTimeout, startTime - currentTime);
  }
} else {
  //任务在最小堆里的排序依赖就是过期时间
  newTask.sortIndex = expirationTime;
  //向最小堆里添加一个新的任务
  push(taskQueue, newTask);
  //taskQueue.push(callback);
  requestHostCallback(flushWork);
}
```

在`requestHostCallback`这个 方法里面，会去调用 MessageChannel 的方法，让调度的任务在浏览器的下一帧去执行，并且把当前的需要调度的方法赋值给 `scheduledHostCallback`

```js
export function requestHostCallback(callback) {
  scheduledHostCallback = callback;
  //一旦port2发消息了，会向宏任务队列中添加一个宏任务，执行por1.onmessage方法
  //告诉 浏览器在下一帧执行performWorkUntilDeadline
  messageChannel.port2.postMessage(null);
  //requestAnimationFrame(performWorkUntilDeadline);
}
```

## shouleYield

在 `scheduler` 内部有一个 `shouldYieldToHost`方法，以下俗称 `shouleYield` 该方法主要用来判断浏览器当前渲染的这一帧是不是还有剩余时间，因为在 `scheduler` 内部，每一帧会请求浏=浏览器的 `5ms` 的时间去执行 `js任务`，如果发现 `5ms` 已经使用完了，但是 `js任务` 却还没执行完毕，那么该任务就会暂停，等待浏览器再下一帧渲染时去执行。

<strong>每一个任务在执行的过程中会去执行 `shouleYield` 方法去判断是不是需要暂停。</strong>

```js
let yieldInterval = 5; //每一帧我会申请5ms

export function getCurrentTime() {
  return performance.now();
}

export function shouldYieldToHost() {
  //获取当前时间
  const currentTime = getCurrentTime();
  //计算截止时间  deadline 就是任务执行时的一个当前时间加上了5ms的一个申请时间 deadline = currentTime + yieldInterval;
  //如果当前时间大于截止时间了，说明到期了，时间片已经用完了，需要返回true,放弃 执行了
  return currentTime >= deadline;
}
```

## 任务调度的开始 flushWork

在 `flushWork` 函数中，会去执行 `workLoop` 函数去依次执行队列里面的任务

```js
/**
 * 依次执行任务队列中的任务
 */
function flushWork(currentTime) {
  return workLoop(currentTime);
}
```

这里我们简单的看一下 mini 版本的 `workLoop` 方法吧

```js
/**
 * 依次执行任务队列中的任务
 * 在这里有两个打断或者到停止 执行
 * 在执行每上任务的时候，如果时间片到到期了会退出workLoop
 * 另一个是在执行currentTask的时候，如果时间片到期了，也会退出执行
 */
function workLoop(currentTime) {
  //其实每次在执行workLoop的时候才会检查 延迟任务哪些可以开始执行了就放到任务队列里
  //无时无刻都在检查 的
  //advanceTimers(currentTime);
  //取出任务队列中的第一个任务
  //currentTask = taskQueue[0];
  //取出优先队列中的优先最高的堆顶元素，也就是过期时间最早的元素
  currentTask = peek(taskQueue);
  while (currentTask) {
    //如果说时间片到期了，就退出循环
    //如果说过期时间大于当前时间，并且时间片到期就退出执行
    //如果说已经过期了，及时时间处到期了，也需要继续执行
    // 如果一个任务过期了，则不再考虑所有谓时间配额问题了，立刻马上全力执行结束
    if (currentTask.expirationTime > currentTime && shouldYield()) {
      break;
    }
    //取出当前的任务的回调函数calculate
    const callback = currentTask.callback;
    //如果它是一个函数的话
    if (typeof callback === "function") {
      //先清空callback属性
      currentTask.callback = null;
      //判断此任务是否过期
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);
      if (typeof continuationCallback === "function") {
        currentTask.callback = continuationCallback;
      } else {
        pop(taskQueue);
      }
    } else {
      //如果任务的callback属性不是函数，则将此任务出队，这个在后面的取消任务的会用到
      pop(taskQueue);
    }
    //继续取出最小堆堆顶的任务
    currentTask = peek(taskQueue);
  }
  if (currentTask) {
    return true;
  } else {
    //说明taskQueue已经空了
    const firstTimer = peek(timerQueue);
    if (firstTimer) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false;
  }
}
```
